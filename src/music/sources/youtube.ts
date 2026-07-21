import youtubedl from 'youtube-dl-exec';
import type { Track } from '../../types/index.js';
import { HTTP_TIMEOUT_MS, YTDLP_TIMEOUT_MS } from '../../utils/async.js';
import { measure, metrics } from '../../utils/metrics.js';

const YOUTUBE_PLAYLIST_LIMIT = 500;
const VIDEO_INFO_CACHE_TTL_MS = 300_000;
const VIDEO_INFO_CACHE_MAX_SIZE = 200;

type VideoInfo = {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
};

type YtdlpResult = {
  id?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  entries?: Array<{
    id?: string;
    title?: string;
    duration?: number;
    thumbnail?: string;
    webpage_url?: string;
    url?: string;
  }>;
};

type CachedVideoInfo = {
  value: VideoInfo;
  expiresAt: number;
};

const videoInfoCache = new Map<string, CachedVideoInfo>();

async function getVideoInfo(urlOrQuery: string, isSearch = false): Promise<VideoInfo> {
  const target = isSearch ? `ytsearch1:${urlOrQuery}` : urlOrQuery;
  const cacheKey = `${isSearch ? 'search' : 'video'}:${urlOrQuery.trim().toLowerCase()}`;
  const cached = videoInfoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.increment('youtube_metadata_cache_hit');
    return cached.value;
  }
  if (cached) videoInfoCache.delete(cacheKey);
  metrics.increment('youtube_metadata_cache_miss');

  const info = (await measure('youtube_metadata_ms', () => youtubedl(target, {
    dumpSingleJson: true,
    noWarnings: true,
    preferFreeFormats: true,
    skipDownload: true,
    socketTimeout: HTTP_TIMEOUT_MS / 1000,
  }, {
    timeout: YTDLP_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  }))) as unknown as YtdlpResult;

  const value = {
    title: info.title ?? 'Unknown title',
    url: info.webpage_url ?? (info.id ? `https://www.youtube.com/watch?v=${info.id}` : ''),
    duration: Number(info.duration ?? 0),
    thumbnail: info.thumbnail ?? '',
  };
  setVideoInfoCache(cacheKey, value);
  return value;
}

export async function resolveYoutubeVideo(url: string, requestedBy: string): Promise<Track> {
  const info = await getVideoInfo(url);
  return {
    title: info.title,
    url,
    duration: info.duration,
    thumbnail: info.thumbnail,
    source: 'youtube',
    requestedBy,
  };
}

export async function resolveYoutubePlaylist(url: string, requestedBy: string): Promise<Track[]> {
  const playlist = (await measure('youtube_playlist_ms', () => youtubedl(url, {
    dumpSingleJson: true,
    flatPlaylist: true,
    playlistEnd: YOUTUBE_PLAYLIST_LIMIT,
    noWarnings: true,
    skipDownload: true,
    socketTimeout: HTTP_TIMEOUT_MS / 1000,
  }, {
    timeout: YTDLP_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  }))) as unknown as YtdlpResult;

  const entries = (playlist.entries ?? []).slice(0, YOUTUBE_PLAYLIST_LIMIT);
  if (entries.length === YOUTUBE_PLAYLIST_LIMIT) {
    metrics.increment('youtube_playlist_limit_hit');
  }

  const tracks: Track[] = [];
  for (const entry of entries) {
    const entryUrl = entry.webpage_url
      ?? (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : entry.url ?? '');
    if (!entryUrl) continue;

    tracks.push({
      title: entry.title ?? 'Unknown title',
      url: entryUrl,
      duration: Number(entry.duration ?? 0),
      thumbnail: entry.thumbnail ?? '',
      source: 'youtube',
      requestedBy,
    });
  }
  return tracks;
}

export async function searchYoutube(query: string, requestedBy: string): Promise<Track> {
  const info = await getVideoInfo(query, true);
  if (!info.url) throw new Error('Nenhuma música encontrada no YouTube');
  return {
    title: info.title,
    url: info.url,
    duration: info.duration,
    thumbnail: info.thumbnail,
    source: 'youtube',
    requestedBy,
  };
}

export function clearYoutubeMetadataCache(): void {
  videoInfoCache.clear();
}

function setVideoInfoCache(key: string, value: VideoInfo): void {
  while (videoInfoCache.size >= VIDEO_INFO_CACHE_MAX_SIZE) {
    const oldestKey = videoInfoCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    videoInfoCache.delete(oldestKey);
  }
  videoInfoCache.set(key, {
    value,
    expiresAt: Date.now() + VIDEO_INFO_CACHE_TTL_MS,
  });
}
