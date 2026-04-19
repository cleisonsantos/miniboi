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
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });

    this.player.on('stateChange', (oldState, newState) => {
      if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
        this.playNext();
      }
    });

    this.player.on('error', (error) => {
      console.error('Player error:', error);
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
      this.connection = connection;
      this.connection.subscribe(this.player);
      return;
    }

    this.connection = joinVoiceChannel({
      channelId,
      guildId: this.guildId,
      adapterCreator,
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20e3);
      this.connection.subscribe(this.player);
    } catch (error) {
      this.connection.destroy();
      this.connection = null;
      throw new Error('Falha ao conectar no canal de voz após 20s');
    }

    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      queues.delete(this.guildId);
    });
  }

  add(tracks: Track[]): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.tracks.push(...tracks);
    if (this.current === null && this.tracks.length > 0) {
      this.playNext();
    }
  }

  async playNext(): Promise<void> {
    // Loop logic
    if (this.loopMode === 'track' && this.current) {
      this.tracks.unshift(this.current);
    } else if (this.loopMode === 'queue' && this.current) {
      this.tracks.push(this.current);
    }

    this.current = this.tracks.shift() || null;

    if (!this.current) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.connection?.destroy();
        queues.delete(this.guildId);
      }, 60_000);
      return;
    }

    const resource = await import('./player.js').then(m => m.createAudioStream(this.current!, this.volume));
    this.player.play(resource);
  }

  skip(): void {
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
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    // TODO: Apply to current resource if inlineVolume
  }

  setLoop(mode: LoopMode): void {
    this.loopMode = mode;
  }

  destroy(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.player.stop(true);
    this.connection?.destroy();
    queues.delete(this.guildId);
  }
}
