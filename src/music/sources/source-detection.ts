export type SourceType =
  | 'youtube_video'
  | 'youtube_playlist'
  | 'spotify_track'
  | 'spotify_playlist'
  | 'search';

export function detectSource(input: string): SourceType {
  const trimmed = input.trim();
  const candidate = /^(?:www\.|music\.|m\.|open\.)/.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();

    if (host === 'open.spotify.com') {
      if (/\/(?:intl-[^/]+\/)?track\/[A-Za-z0-9]+/.test(url.pathname)) return 'spotify_track';
      if (/\/(?:intl-[^/]+\/)?playlist\/[A-Za-z0-9]+/.test(url.pathname)) return 'spotify_playlist';
    }

    if (host === 'youtu.be' && url.pathname.length > 1) return 'youtube_video';
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      if (url.pathname === '/watch' && url.searchParams.has('v')) return 'youtube_video';
      if (url.pathname === '/playlist' || url.searchParams.has('list')) return 'youtube_playlist';
    }
  } catch {
    // Texto comum segue como busca.
  }

  return 'search';
}
