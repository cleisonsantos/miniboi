import type { Track } from '../../types/index.js';
import { resolveYoutubeVideo, resolveYoutubePlaylist, searchYoutube } from './youtube.js';
import { resolveSpotifyTrack, resolveSpotifyPlaylist } from './spotify.js';

type SourceType = 'youtube_video' | 'youtube_playlist' | 'spotify_track' | 'spotify_playlist' | 'search';

function detectSource(input: string): SourceType {
  const ytVideo = /^(https?:\/\/)?(www\.youtube\.com\/watch\?v=|youtu\.be\/)/.test(input);
  if (ytVideo) return 'youtube_video';

  const ytPlaylist = /list=/.test(input);
  if (ytPlaylist) return 'youtube_playlist';

  const spTrack = /open\.spotify\.com\/track\//.test(input);
  if (spTrack) return 'spotify_track';

  const spPlaylist = /open\.spotify\.com\/playlist\//.test(input);
  if (spPlaylist) return 'spotify_playlist';

  return 'search';
}

export { detectSource };

export async function resolveTracks(input: string, requestedBy: string): Promise<Track[]> {
  const type = detectSource(input);
  switch (type) {
    case 'youtube_video':
      return [await resolveYoutubeVideo(input, requestedBy)];
    case 'youtube_playlist':
      return await resolveYoutubePlaylist(input, requestedBy);
    case 'spotify_track':
      return [await resolveSpotifyTrack(input, requestedBy)];
    case 'spotify_playlist':
      return await resolveSpotifyPlaylist(input, requestedBy);
    case 'search':
      return [await searchYoutube(input, requestedBy)];
    default:
      throw new Error('Tipo de entrada não suportado');
  }
}
