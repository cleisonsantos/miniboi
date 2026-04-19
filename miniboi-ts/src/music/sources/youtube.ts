import youtubedl from 'youtube-dl-exec';
import type { Track } from '../../types/index.js';

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

async function getVideoInfo(urlOrQuery: string, isSearch = false): Promise<{ title: string; url: string; duration: number; thumbnail: string }> {
  const target = isSearch ? `ytsearch1:${urlOrQuery}` : urlOrQuery;
  const info = (await youtubedl(target, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    skipDownload: true,
  })) as unknown as YtdlpResult;

  return {
    title: info.title ?? 'Unknown title',
    url: info.webpage_url ?? (info.id ? `https://www.youtube.com/watch?v=${info.id}` : ''),
    duration: Number(info.duration ?? 0),
    thumbnail: info.thumbnail ?? '',
  };
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
  const playlist = (await youtubedl(url, {
    dumpSingleJson: true,
    flatPlaylist: true,
    noWarnings: true,
    noCheckCertificates: true,
    skipDownload: true,
  })) as unknown as YtdlpResult;

  const entries = playlist.entries ?? [];
  const tracks: Track[] = [];
  for (const entry of entries) {
    const entryUrl = entry.webpage_url ?? (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : entry.url ?? '');
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
  if (!info.url) {
    throw new Error('Nenhuma música encontrada no YouTube');
  }
  return {
    title: info.title,
    url: info.url,
    duration: info.duration,
    thumbnail: info.thumbnail,
    source: 'youtube',
    requestedBy,
  };
}
