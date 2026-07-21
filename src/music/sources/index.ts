import type { Track } from '../../types/index.js';
import { resolveYoutubeVideo, resolveYoutubePlaylist, searchYoutube } from './youtube.js';
import { resolveSpotifyTrack, resolveSpotifyPlaylist } from './spotify.js';
import { detectSource } from './source-detection.js';

export { detectSource } from './source-detection.js';

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
