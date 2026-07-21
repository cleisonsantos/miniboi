import { Readable } from 'node:stream';
import youtubedl from 'youtube-dl-exec';
import { createAudioResource, demuxProbe } from '@discordjs/voice';
import type { Track, AudioStream } from '../types/index.js';
import { logger } from '../utils/logger.js';
import {
  combinedTimeoutSignal,
  HTTP_TIMEOUT_MS,
  YTDLP_TIMEOUT_MS,
} from '../utils/async.js';
import { measure, metrics } from '../utils/metrics.js';

const OPUS_AUDIO_FORMAT = [
  'bestaudio[acodec=opus][ext=webm]',
  'bestaudio[acodec=opus]',
  'bestaudio[ext=webm]',
  'bestaudio/best',
].join('/');
const AUDIO_URL_CACHE_TTL_MS = 120_000;
const AUDIO_URL_CACHE_MAX_SIZE = 200;

type CachedAudioUrl = {
  url: string;
  expiresAt: number;
};

const audioUrlCache = new Map<string, CachedAudioUrl>();
const audioUrlInFlight = new Map<string, Promise<string>>();

export type PlayerDependencies = {
  ytdlp?: typeof youtubedl;
  fetcher?: typeof fetch;
  probe?: typeof demuxProbe;
  createResource?: typeof createAudioResource;
};

export async function createAudioStream(
  track: Track,
  volume: number,
  signal?: AbortSignal,
  dependencies: PlayerDependencies = {},
): Promise<AudioStream> {
  const startedAt = performance.now();
  let directUrl = await resolveDirectAudioUrl(track, signal, false, dependencies);
  logger.info('Stream URL obtida, abrindo conexão...');

  let response = await openAudioUrl(directUrl, signal, dependencies);
  if (response.status === 403 || response.status === 410) {
    invalidateAudioUrl(track);
    directUrl = await resolveDirectAudioUrl(track, signal, true, dependencies);
    response = await openAudioUrl(directUrl, signal, dependencies);
  }
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao abrir stream de áudio (${response.status})`);
  }

  const stream = Readable.fromWeb(response.body as unknown as ReadableStream);
  logger.info('Probe de áudio...');
  const probe = await measure('audio_probe_ms', () => (
    dependencies.probe ?? demuxProbe
  )(stream));

  logger.info('Criando AudioResource...');
  const resource = (dependencies.createResource ?? createAudioResource)(probe.stream, {
    inputType: probe.type,
    // Volume dinâmico impede passthrough Opus, mas preserva /volume durante a faixa.
    inlineVolume: true,
  });

  resource.volume?.setVolume(volume / 100);
  metrics.observe('audio_stream_prepare_ms', performance.now() - startedAt);
  logger.info(`AudioResource criado com volume ${volume}%`);
  return resource;
}

export async function prefetchAudioUrl(
  track: Track,
  signal?: AbortSignal,
  dependencies: PlayerDependencies = {},
): Promise<void> {
  await resolveDirectAudioUrl(track, signal, false, dependencies);
}

export function clearAudioUrlCache(): void {
  audioUrlCache.clear();
  audioUrlInFlight.clear();
}

async function resolveDirectAudioUrl(
  track: Track,
  signal?: AbortSignal,
  force = false,
  dependencies: PlayerDependencies = {},
): Promise<string> {
  const key = audioCacheKey(track);
  const cached = audioUrlCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) {
    metrics.increment('audio_url_cache_hit');
    return cached.url;
  }
  if (cached) audioUrlCache.delete(key);

  if (!force) {
    const pending = audioUrlInFlight.get(key);
    if (pending) {
      metrics.increment('audio_url_inflight_hit');
      return waitWithSignal(pending, signal);
    }
  }

  metrics.increment('audio_url_cache_miss');
  const operation = extractDirectAudioUrl(track, signal, dependencies)
    .then((url) => {
      setCachedAudioUrl(key, url);
      return url;
    })
    .finally(() => {
      if (audioUrlInFlight.get(key) === operation) audioUrlInFlight.delete(key);
    });
  audioUrlInFlight.set(key, operation);
  return waitWithSignal(operation, signal);
}

async function extractDirectAudioUrl(
  track: Track,
  signal: AbortSignal | undefined,
  dependencies: PlayerDependencies,
): Promise<string> {
  const target = track.source === 'spotify'
    ? `ytsearch1:${track.title} ${track.artist ?? ''}`
    : track.url;
  if (!target) throw new Error('URL inválida');

  logger.info(`Obtendo URL de áudio do YouTube para: ${track.title}`);
  const direct = await measure('audio_url_resolution_ms', () => (
    dependencies.ytdlp ?? youtubedl
  )(target, {
    getUrl: true,
    format: OPUS_AUDIO_FORMAT,
    noWarnings: true,
    preferFreeFormats: true,
    socketTimeout: HTTP_TIMEOUT_MS / 1000,
  }, {
    timeout: YTDLP_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    signal,
  }));

  const directUrl = String(direct).split('\n')[0]?.trim();
  if (!directUrl) throw new Error('Falha ao obter stream de áudio do YouTube');
  return directUrl;
}

async function openAudioUrl(
  url: string,
  signal: AbortSignal | undefined,
  dependencies: PlayerDependencies,
): Promise<Response> {
  return measure('audio_http_open_ms', () => (dependencies.fetcher ?? fetch)(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
    signal: combinedTimeoutSignal(HTTP_TIMEOUT_MS, signal),
  }));
}

function audioCacheKey(track: Track): string {
  return track.source === 'spotify'
    ? `spotify:${track.title.toLowerCase()}:${track.artist?.toLowerCase() ?? ''}`
    : `youtube:${track.url}`;
}

function invalidateAudioUrl(track: Track): void {
  audioUrlCache.delete(audioCacheKey(track));
}

function setCachedAudioUrl(key: string, url: string): void {
  while (audioUrlCache.size >= AUDIO_URL_CACHE_MAX_SIZE) {
    const oldestKey = audioUrlCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    audioUrlCache.delete(oldestKey);
  }
  audioUrlCache.set(key, {
    url,
    expiresAt: Date.now() + AUDIO_URL_CACHE_TTL_MS,
  });
}

function waitWithSignal<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
