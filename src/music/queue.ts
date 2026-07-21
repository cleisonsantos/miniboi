import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  getVoiceConnection,
  joinVoiceChannel,
  entersState,
  NoSubscriberBehavior,
  type AudioPlayer,
  type VoiceConnection,
} from '@discordjs/voice';
import type { InternalDiscordGatewayAdapterCreator } from 'discord.js';
import type {
  AudioStream,
  Track,
  LoopMode,
  MusicQueue as QueueInterface,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import { createAudioStream, prefetchAudioUrl } from './player.js';

const IDLE_TIMEOUT_MS = 60_000;
const CONNECTION_TIMEOUT_MS = 20_000;
const RECONNECT_TIMEOUT_MS = 5_000;

type AdvanceReason = 'start' | 'finished' | 'skip' | 'error';
type StreamFactory = (
  track: Track,
  volume: number,
  signal?: AbortSignal,
) => Promise<AudioStream>;

type Prefetcher = (track: Track, signal?: AbortSignal) => Promise<void>;

type MusicQueueOptions = {
  player?: AudioPlayer;
  createStream?: StreamFactory;
  prefetch?: Prefetcher;
  idleTimeoutMs?: number;
};

export const queues = new Map<string, MusicQueue>();

export class MusicQueue implements QueueInterface {
  public current: Track | null = null;
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer;
  public volume = 50;
  public loopMode: LoopMode = 'off';
  public textChannelId: string;
  public guildId: string;

  private trackBuffer: Track[] = [];
  private trackHead = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionTail: Promise<void> = Promise.resolve();
  private streamController: AbortController | null = null;
  private prefetchController: AbortController | null = null;
  private prefetchedTrack: Track | null = null;
  private currentResource: AudioStream | null = null;
  private playbackGeneration = 0;
  private destroyed = false;
  private suppressNextIdle = false;
  private observedConnection: VoiceConnection | null = null;
  private readonly streamFactory: StreamFactory;
  private readonly prefetcher: Prefetcher;
  private readonly idleTimeoutMs: number;

  constructor(guildId: string, textChannelId: string, options: MusicQueueOptions = {}) {
    this.guildId = guildId;
    this.textChannelId = textChannelId;
    this.streamFactory = options.createStream ?? createAudioStream;
    this.prefetcher = options.prefetch ?? prefetchAudioUrl;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    this.player = options.player ?? createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });

    logger.info(`Nova fila criada para guild ${guildId}`);

    this.player.on('stateChange', (oldState, newState) => {
      logger.info(`Player state: ${oldState.status} -> ${newState.status}`);
      if (
        !this.destroyed
        && oldState.status !== AudioPlayerStatus.Idle
        && newState.status === AudioPlayerStatus.Idle
      ) {
        if (this.suppressNextIdle) {
          this.suppressNextIdle = false;
          return;
        }
        void this.playNext('finished');
      }
    });

    this.player.on('error', (error) => {
      if (this.destroyed) return;
      logger.error('Player error', error);
      this.suppressNextIdle = true;
      void this.playNext('error');
    });
  }

  get tracks(): Track[] {
    return this.trackBuffer.slice(this.trackHead);
  }

  set tracks(tracks: Track[]) {
    this.trackBuffer = [...tracks];
    this.trackHead = 0;
  }

  static from(guildId: string): MusicQueue | undefined {
    return queues.get(guildId);
  }

  static getOrCreate(guildId: string, textChannelId: string): MusicQueue {
    let queue = MusicQueue.from(guildId);
    if (!queue) {
      queue = new MusicQueue(guildId, textChannelId);
      queues.set(guildId, queue);
    }
    return queue;
  }

  async connect(
    channelId: string,
    adapterCreator: InternalDiscordGatewayAdapterCreator,
  ): Promise<void> {
    if (this.destroyed) throw new Error('Fila já foi destruída');

    let connection = getVoiceConnection(this.guildId);
    if (
      connection
      && (
        connection.state.status === VoiceConnectionStatus.Destroyed
        || connection.joinConfig.channelId !== channelId
      )
    ) {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      connection = undefined;
    }

    if (!connection) {
      logger.info(`Conectando ao canal de voz ${channelId}...`);
      connection = joinVoiceChannel({
        channelId,
        guildId: this.guildId,
        adapterCreator,
      });
    } else {
      logger.info(`Reutilizando conexão de voz existente para guild ${this.guildId}`);
    }

    this.connection = connection;
    this.observeConnection(connection);

    try {
      if (connection.state.status !== VoiceConnectionStatus.Ready) {
        await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS);
      }
      connection.subscribe(this.player);
      logger.info('Conexão de voz estabelecida com sucesso');
    } catch (error) {
      logger.error('Falha ao conectar no canal de voz', error);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      if (this.connection === connection) this.connection = null;
      if (queues.get(this.guildId) === this) queues.delete(this.guildId);
      throw new Error('Falha ao conectar no canal de voz após 20s', { cause: error });
    }
  }

  add(tracks: Track[]): void {
    if (this.destroyed) throw new Error('Fila já foi destruída');
    this.clearIdleTimer();
    this.enqueue(...tracks);
    logger.info(`${tracks.length} track(s) adicionada(s) à fila. Total: ${this.pendingCount()}`);

    if (this.current === null && this.pendingCount() > 0) {
      logger.info('Iniciando reprodução da fila');
      void this.playNext('start');
    } else if (this.current) {
      this.schedulePrefetch();
    }
  }

  async playNext(reason: AdvanceReason = 'finished'): Promise<void> {
    if (this.destroyed) return;

    const generation = ++this.playbackGeneration;
    this.streamController?.abort(new Error('Reprodução substituída'));
    const controller = new AbortController();
    this.streamController = controller;

    const transition = this.transitionTail.then(() => (
      this.advance(reason, generation, controller)
    ));
    this.transitionTail = transition.catch((error) => {
      logger.error('Falha inesperada ao avançar fila', error);
    });
    return transition;
  }

  skip(): void {
    if (this.destroyed) return;
    logger.info('Skip solicitado');

    this.suppressNextIdle = true;
    const stopped = this.player.stop(true);
    if (!stopped) {
      this.suppressNextIdle = false;
      void this.playNext('skip');
      return;
    }

    void this.playNext('skip');
  }

  clear(): void {
    this.playbackGeneration++;
    this.streamController?.abort(new Error('Fila limpa'));
    this.streamController = null;
    this.prefetchController?.abort(new Error('Fila limpa'));
    this.prefetchController = null;
    this.prefetchedTrack = null;
    this.clearTrackBuffer();
    this.current = null;
    this.currentResource = null;
  }

  shuffle(): void {
    const pending = this.tracks;
    for (let i = pending.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pending[i], pending[j]] = [pending[j], pending[i]];
    }
    this.tracks = pending;
    this.schedulePrefetch();
    logger.info('Fila embaralhada');
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.currentResource?.volume?.setVolume(this.volume / 100);
    logger.info(`Volume definido para ${this.volume}%`);
  }

  setLoop(mode: LoopMode): void {
    this.loopMode = mode;
    logger.info(`Loop definido para: ${mode}`);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    logger.info('Destruindo fila e desconectando');

    this.clearIdleTimer();
    this.playbackGeneration++;
    this.streamController?.abort(new Error('Fila destruída'));
    this.streamController = null;
    this.prefetchController?.abort(new Error('Fila destruída'));
    this.prefetchController = null;
    this.prefetchedTrack = null;
    this.clearTrackBuffer();
    this.current = null;
    this.currentResource = null;
    this.player.stop(true);

    const connection = this.connection;
    this.connection = null;
    if (connection?.state.status !== VoiceConnectionStatus.Destroyed) connection?.destroy();
    if (queues.get(this.guildId) === this) queues.delete(this.guildId);
  }

  private async advance(
    reason: AdvanceReason,
    generation: number,
    controller: AbortController,
  ): Promise<void> {
    if (this.destroyed || generation !== this.playbackGeneration) return;
    this.clearIdleTimer();

    let repeatedTrack: Track | null = null;
    if (reason === 'finished' && this.current) {
      if (this.loopMode === 'track') {
        repeatedTrack = this.current;
        logger.info(`Loop track: ${this.current.title}`);
      } else if (this.loopMode === 'queue') {
        this.enqueue(this.current);
        logger.info(`Loop queue: ${this.current.title}`);
      }
    }

    while (!this.destroyed && generation === this.playbackGeneration) {
      const track = repeatedTrack ?? this.dequeue();
      repeatedTrack = null;
      this.current = track;
      this.currentResource = null;

      if (!track) {
        this.startIdleTimer();
        return;
      }

      logger.info(`Preparando: ${track.title} (${track.source})`);
      const prepareStartedAt = performance.now();
      try {
        const resource = await this.streamFactory(track, this.volume, controller.signal);
        if (this.destroyed || generation !== this.playbackGeneration || controller.signal.aborted) {
          resource.playStream.destroy();
          return;
        }

        this.currentResource = resource;
        metrics.observe('queue_track_prepare_ms', performance.now() - prepareStartedAt);
        logger.info('Stream criado, iniciando playback');
        this.player.play(resource);
        this.schedulePrefetch();
        return;
      } catch (error) {
        if (controller.signal.aborted || generation !== this.playbackGeneration || this.destroyed) {
          return;
        }
        metrics.observe('queue_track_prepare_ms', performance.now() - prepareStartedAt);
        metrics.increment('queue_stream_failure');
        logger.error(`Falha ao criar stream para ${track.title}`, error);
      }
    }
  }

  private enqueue(...tracks: Track[]): void {
    this.trackBuffer.push(...tracks);
  }

  private dequeue(): Track | null {
    const track = this.trackBuffer[this.trackHead++] ?? null;
    if (this.trackHead >= this.trackBuffer.length) {
      this.clearTrackBuffer();
    } else if (this.trackHead >= 1_024 && this.trackHead * 2 >= this.trackBuffer.length) {
      this.trackBuffer = this.trackBuffer.slice(this.trackHead);
      this.trackHead = 0;
    }
    return track;
  }

  private peek(): Track | null {
    return this.trackBuffer[this.trackHead] ?? null;
  }

  private pendingCount(): number {
    return this.trackBuffer.length - this.trackHead;
  }

  private clearTrackBuffer(): void {
    this.trackBuffer = [];
    this.trackHead = 0;
  }

  private schedulePrefetch(): void {
    const nextTrack = this.peek();
    if (
      nextTrack
      && this.prefetchedTrack === nextTrack
      && this.prefetchController
      && !this.prefetchController.signal.aborted
    ) return;

    this.prefetchController?.abort(new Error('Prefetch substituído'));
    this.prefetchController = null;
    this.prefetchedTrack = null;
    if (!nextTrack || this.destroyed) return;

    const controller = new AbortController();
    this.prefetchController = controller;
    this.prefetchedTrack = nextTrack;
    void this.prefetcher(nextTrack, controller.signal).then(
      () => metrics.increment('audio_prefetch_success'),
      (error) => {
        if (!controller.signal.aborted) {
          metrics.increment('audio_prefetch_failure');
          logger.warn(`Prefetch falhou para ${nextTrack.title}: ${String(error)}`);
        }
      },
    ).finally(() => {
      if (this.prefetchController === controller) {
        this.prefetchController = null;
        this.prefetchedTrack = null;
      }
    });
  }

  private observeConnection(connection: VoiceConnection): void {
    if (this.observedConnection === connection) return;
    this.observedConnection = connection;

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      void this.recoverConnection(connection);
    });
  }

  private async recoverConnection(connection: VoiceConnection): Promise<void> {
    if (this.destroyed || this.connection !== connection) return;
    logger.warn(`Conexão de voz desconectada para guild ${this.guildId}; tentando reconectar`);

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_TIMEOUT_MS),
        entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_TIMEOUT_MS),
        entersState(connection, VoiceConnectionStatus.Ready, RECONNECT_TIMEOUT_MS),
      ]);
      logger.info(`Conexão de voz recuperada para guild ${this.guildId}`);
    } catch (error) {
      logger.error(`Não foi possível recuperar conexão da guild ${this.guildId}`, error);
      this.destroy();
    }
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private startIdleTimer(): void {
    logger.info(`Fila vazia, timer de idle iniciado (${this.idleTimeoutMs}ms)`);
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      logger.info('Timer de idle expirado, desconectando');
      this.destroy();
    }, this.idleTimeoutMs);
    this.idleTimer.unref?.();
  }
}
