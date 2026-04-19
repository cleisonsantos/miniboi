import {
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  getVoiceConnection,
  joinVoiceChannel,
  entersState,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import type { Track, LoopMode, MusicQueue as QueueInterface } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const queues = new Map<string, MusicQueue>();

export class MusicQueue implements QueueInterface {
  public tracks: Track[] = [];
  public current: Track | null = null;
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer;
  public volume: number = 50;
  public loopMode: LoopMode = 'off';
  public textChannelId: string = '';
  public guildId: string;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(guildId: string, textChannelId: string) {
    this.guildId = guildId;
    this.textChannelId = textChannelId;
    logger.info(`Nova fila criada para guild ${guildId}`);
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });

    this.player.on('stateChange', (oldState, newState) => {
      logger.info(`Player state: ${oldState.status} -> ${newState.status}`);
      if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
        this.playNext();
}
    });

    this.player.on('error', (error) => {
      logger.error('Player error', error);
      this.playNext();
    });
  }

  static from(guildId: string): MusicQueue | undefined {
    return queues.get(guildId) as MusicQueue | undefined;
  }

  static getOrCreate(guildId: string, textChannelId: string): MusicQueue {
    let queue = MusicQueue.from(guildId);
    if (!queue) {
      queue = new MusicQueue(guildId, textChannelId);
      queues.set(guildId, queue);
    }
    return queue;
  }

  async connect(channelId: string, adapterCreator: any): Promise<void> {
    let connection = getVoiceConnection(this.guildId);
    if (connection) {
      logger.info(`Reutilizando conexão de voz existente para guild ${this.guildId}`);
      this.connection = connection;
      this.connection.subscribe(this.player);
      return;
    }

    logger.info(`Conectando ao canal de voz ${channelId}...`);
    this.connection = joinVoiceChannel({
      channelId,
      guildId: this.guildId,
      adapterCreator,
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20e3);
      logger.info('Conexão de voz estabelecida com sucesso');
      this.connection.subscribe(this.player);
    } catch (error) {
      logger.error('Falha ao conectar no canal de voz', error);
      this.connection.destroy();
      this.connection = null;
      throw new Error('Falha ao conectar no canal de voz após 20s');
    }

    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      logger.warn(`Conexão de voz desconectada para guild ${this.guildId}`);
      queues.delete(this.guildId);
    });
  }

  add(tracks: Track[]): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.tracks.push(...tracks);
    logger.info(`${tracks.length} track(s) adicionada(s) à fila. Total: ${this.tracks.length}`);
    if (this.current === null && this.tracks.length > 0) {
      logger.info('Iniciando reprodução da fila');
      this.playNext();
    }
  }

  async playNext(): Promise<void> {
    // Loop logic
    if (this.loopMode === 'track' && this.current) {
      this.tracks.unshift(this.current);
      logger.info(`Loop track: ${this.current.title}`);
    } else if (this.loopMode === 'queue' && this.current) {
      this.tracks.push(this.current);
      logger.info(`Loop queue: ${this.current.title}`);
    }

    this.current = this.tracks.shift() || null;

    if (!this.current) {
      logger.info('Fila vazia, timer de idle iniciado (60s)');
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        logger.info('Timer de idle expirado, desconectando');
        this.connection?.destroy();
        queues.delete(this.guildId);
      }, 60_000);
      return;
    }

    logger.info(`Preparando: ${this.current.title} (${this.current.source})`);
    try {
      const resource = await import('./player.js').then(m => m.createAudioStream(this.current!, this.volume));
      logger.info('Stream criado, iniciando playback');
      this.player.play(resource);
    } catch (error) {
      logger.error(`Falha ao criar stream para ${this.current.title}`, error);
      this.playNext();
    }
  }

  skip(): void {
    logger.info('Skip solicitado');
    this.playNext();
  }

  clear(): void {
    this.tracks = [];
    this.current = null;
  }

  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    logger.info('Fila embaralhada');
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    logger.info(`Volume definido para ${volume}%`);
  }

  setLoop(mode: LoopMode): void {
    this.loopMode = mode;
    logger.info(`Loop definido para: ${mode}`);
  }

  destroy(): void {
    logger.info('Destruindo fila e desconectando');
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.player.stop(true);
    this.connection?.destroy();
    queues.delete(this.guildId);
  }
}
