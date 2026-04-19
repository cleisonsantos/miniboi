import SpotifyWebApi from 'spotify-web-api-node';
import { env } from '../../config/env.js';
import type { Track } from '../../types/index.js';

let spotifyApi: SpotifyWebApi | null = null;
let refreshTimeout: NodeJS.Timeout | null = null;

export async function initSpotify() {
  spotifyApi = new SpotifyWebApi({
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
  });

  await refreshAccessToken();
}

async function refreshAccessToken() {
  if (!spotifyApi) return;

  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    const expiresIn = data.body.expires_in * 1000 - 60 * 1000; // 1 min early
    refreshTimeout = setTimeout(refreshAccessToken, expiresIn);
  } catch (error) {
    console.error('Spotify token refresh error:', error);
  }
}

export async function resolveSpotifyTrack(url: string, requestedBy: string): Promise<Track> {
  if (!spotifyApi) throw new Error('Spotify não inicializado');

  const trackId = new URL(url).pathname.split('/track/')[1].split('?')[0];
  const data = await spotifyApi.getTrack(trackId);
  const track = data.body;

  return {
    title: track.name,
    artist: track.artists[0]?.name ?? 'Unknown',
    spotifyUrl: url,
    url: '',
    source: 'spotify',
    duration: Math.floor(track.duration_ms / 1000),
    requestedBy,
  };
}

export async function resolveSpotifyPlaylist(url: string, requestedBy: string): Promise<Track[]> {
  if (!spotifyApi) throw new Error('Spotify não inicializado');

  const playlistId = new URL(url).pathname.split('/playlist/')[1].split('?')[0];
  const data = await spotifyApi.getPlaylistTracks(playlistId);
  const tracks: Track[] = [];
  for (const item of data.body.items) {
    const track = item.track as SpotifyApi.TrackObjectFull;
    tracks.push({
      title: track.name,
      artist: track.artists[0]?.name ?? 'Unknown',
      spotifyUrl: track.external_urls.spotify,
      url: '',
      source: 'spotify',
      duration: Math.floor(track.duration_ms / 1000),
      requestedBy,
    });
  }
  return tracks;
}
