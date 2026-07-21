import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { AudioPlayerStatus, type AudioPlayer } from '@discordjs/voice';
import type { AudioStream, Track } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { MusicQueue, queues } from './queue.js';

class FakePlayer extends EventEmitter {
  public state: { status: string; resource?: AudioStream } = {
    status: AudioPlayerStatus.Idle,
  };
  public readonly played: AudioStream[] = [];

  play(resource: AudioStream): void {
    const oldState = this.state;
    this.state = { status: AudioPlayerStatus.Playing, resource };
    this.played.push(resource);
    this.emit('stateChange', oldState, this.state);
  }

  stop(): boolean {
    if (this.state.status === AudioPlayerStatus.Idle) return false;
    const oldState = this.state;
    this.state = { status: AudioPlayerStatus.Idle };
    this.emit('stateChange', oldState, this.state);
    return true;
  }

  finish(): void {
    this.stop();
  }
}

function makeTrack(title: string): Track {
  return {
    title,
    url: `https://example.com/${title}`,
    duration: 120,
    source: 'youtube',
    requestedBy: 'tester',
  };
}

function makeResource(onVolume?: (volume: number) => void): AudioStream {
  return {
    playStream: new PassThrough(),
    volume: {
      setVolume: (volume: number) => {
        onVolume?.(volume);
      },
    },
  } as unknown as AudioStream;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Condição de teste não atingida');
    await Bun.sleep(1);
  }
}

describe('MusicQueue', () => {
  let restoreLogger = () => undefined;

  beforeEach(() => {
    const info = spyOn(logger, 'info').mockImplementation(() => undefined);
    const warn = spyOn(logger, 'warn').mockImplementation(() => undefined);
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);
    restoreLogger = () => {
      info.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    };
  });

  afterEach(() => {
    for (const queue of queues.values()) queue.destroy();
    queues.clear();
    restoreLogger();
  });

  test('cancela preparação anterior e não reproduz faixa pulada', async () => {
    const player = new FakePlayer();
    const calls: string[] = [];
    const queue = new MusicQueue('race-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: (track, _volume, signal) => {
        calls.push(track.title);
        if (track.title === 'first') {
          return new Promise((_, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
        }
        return Promise.resolve(makeResource());
      },
      idleTimeoutMs: 10_000,
    });

    queue.add([makeTrack('first'), makeTrack('second')]);
    await waitFor(() => calls.length === 1);
    queue.skip();
    await waitFor(() => player.played.length === 1);

    expect(calls).toEqual(['first', 'second']);
    expect(queue.current?.title).toBe('second');
    queue.destroy();
  });

  test('aplica volume ao recurso atual', async () => {
    const player = new FakePlayer();
    const volumes: number[] = [];
    const queue = new MusicQueue('volume-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: async () => makeResource((volume) => volumes.push(volume)),
      idleTimeoutMs: 10_000,
    });

    queue.add([makeTrack('current')]);
    await waitFor(() => player.played.length === 1);
    queue.setVolume(80);

    expect(volumes.at(-1)).toBe(0.8);
    queue.destroy();
  });

  test('pula faixa cujo stream falhou', async () => {
    const player = new FakePlayer();
    const calls: string[] = [];
    const queue = new MusicQueue('failure-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: async (track) => {
        calls.push(track.title);
        if (track.title === 'broken') throw new Error('stream inválido');
        return makeResource();
      },
      idleTimeoutMs: 10_000,
    });

    queue.add([makeTrack('broken'), makeTrack('healthy')]);
    await waitFor(() => player.played.length === 1);

    expect(calls).toEqual(['broken', 'healthy']);
    expect(queue.current?.title).toBe('healthy');
    queue.destroy();
  });

  test('repete faixa somente após término normal', async () => {
    const player = new FakePlayer();
    const queue = new MusicQueue('loop-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: async () => makeResource(),
      idleTimeoutMs: 10_000,
    });

    queue.setLoop('track');
    queue.add([makeTrack('looped')]);
    await waitFor(() => player.played.length === 1);
    player.finish();
    await waitFor(() => player.played.length === 2);

    expect(queue.current?.title).toBe('looped');
    expect(queue.tracks).toHaveLength(0);
    queue.destroy();
  });

  test('mantém somente faixas pendentes e faz prefetch da próxima', async () => {
    const player = new FakePlayer();
    const prefetched: string[] = [];
    const queue = new MusicQueue('prefetch-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: async () => makeResource(),
      prefetch: async (track) => {
        prefetched.push(track.title);
      },
      idleTimeoutMs: 10_000,
    });

    queue.add([makeTrack('first'), makeTrack('second'), makeTrack('third')]);
    await waitFor(() => player.played.length === 1 && prefetched.length === 1);

    expect(queue.current?.title).toBe('first');
    expect(queue.tracks.map((track) => track.title)).toEqual(['second', 'third']);
    expect(prefetched).toEqual(['second']);

    player.finish();
    await waitFor(() => player.played.length === 2);
    expect(queue.current?.title).toBe('second');
    expect(queue.tracks.map((track) => track.title)).toEqual(['third']);
    queue.destroy();
  });

  test('destroy cancela preparação e remove registro global', async () => {
    const player = new FakePlayer();
    let aborted = false;
    const queue = new MusicQueue('destroy-guild', 'text', {
      player: player as unknown as AudioPlayer,
      createStream: (_track, _volume, signal) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          aborted = true;
          reject(signal.reason);
        }, { once: true });
      }),
      idleTimeoutMs: 10_000,
    });
    queues.set(queue.guildId, queue);

    queue.add([makeTrack('pending')]);
    await Bun.sleep(1);
    queue.destroy();
    await waitFor(() => aborted);

    expect(queues.has(queue.guildId)).toBe(false);
  });
});
