import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { PassThrough } from 'node:stream';
import { StreamType } from '@discordjs/voice';
import type { AudioStream, Track } from '../types/index.js';
import { logger } from '../utils/logger.js';
import {
  clearAudioUrlCache,
  createAudioStream,
  prefetchAudioUrl,
  type PlayerDependencies,
} from './player.js';

type YtdlpRunner = NonNullable<PlayerDependencies['ytdlp']>;

const track: Track = {
  title: 'Song',
  url: 'https://www.youtube.com/watch?v=video123',
  duration: 120,
  source: 'youtube',
  requestedBy: 'tester',
};

describe('audio URL cache and stream preparation', () => {
  let restoreLogger = () => undefined;

  beforeEach(() => {
    clearAudioUrlCache();
    const info = spyOn(logger, 'info').mockImplementation(() => undefined);
    restoreLogger = () => {
      info.mockRestore();
    };
  });

  afterEach(() => restoreLogger());

  test('deduplica prefetch concorrente e prioriza WebM/Opus', async () => {
    let resolveExtraction: ((url: string) => void) | undefined;
    const extraction = new Promise<string>((resolve) => {
      resolveExtraction = resolve;
    });
    const ytdlpMock = mock(async (..._args: Parameters<YtdlpRunner>) => extraction);
    const ytdlp = ytdlpMock as unknown as YtdlpRunner;

    const first = prefetchAudioUrl(track, undefined, { ytdlp });
    const second = prefetchAudioUrl(track, undefined, { ytdlp });
    resolveExtraction?.('https://audio.example/stream');
    await Promise.all([first, second]);

    expect(ytdlpMock).toHaveBeenCalledTimes(1);
    const flags = ytdlpMock.mock.calls[0]?.[1];
    expect(String(flags?.format)).toContain('bestaudio[acodec=opus][ext=webm]');
  });

  test('reusa URL prefetched ao criar recurso e aplica volume', async () => {
    const ytdlpMock = mock(async (..._args: Parameters<YtdlpRunner>) => (
      'https://audio.example/stream'
    ));
    const ytdlp = ytdlpMock as unknown as YtdlpRunner;
    const fetcherMock = mock(async () => new Response(new Uint8Array([1, 2, 3])));
    const fetcher = fetcherMock as unknown as typeof fetch;
    const probe = mock(async () => ({
      stream: new PassThrough(),
      type: StreamType.WebmOpus,
    })) as unknown as NonNullable<PlayerDependencies['probe']>;
    const volumes: number[] = [];
    const resource = {
      playStream: new PassThrough(),
      volume: { setVolume: (volume: number) => volumes.push(volume) },
    } as unknown as AudioStream;
    const createResource = mock(() => resource) as unknown as
      NonNullable<PlayerDependencies['createResource']>;
    const dependencies = { ytdlp, fetcher, probe, createResource };

    await prefetchAudioUrl(track, undefined, dependencies);
    const result = await createAudioStream(track, 50, undefined, dependencies);

    expect(result).toBe(resource);
    expect(ytdlpMock).toHaveBeenCalledTimes(1);
    expect(fetcherMock).toHaveBeenCalledWith(
      'https://audio.example/stream',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(probe).toHaveBeenCalledTimes(1);
    expect(volumes).toEqual([0.5]);
  });
});
