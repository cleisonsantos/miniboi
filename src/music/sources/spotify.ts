import { env } from '../../config/env.js';
import type { Track } from '../../types/index.js';
import { SpotifyClient } from './spotify-client.js';

let spotifyClient: SpotifyClient | null = null;

export async function initSpotify(): Promise<void> {
  spotifyClient?.destroy();
  const client = new SpotifyClient({
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
  });

  try {
    await client.init();
    spotifyClient = client;
  } catch (error) {
    client.destroy();
    spotifyClient = null;
    throw error;
  }
}

export function shutdownSpotify(): void {
  spotifyClient?.destroy();
  spotifyClient = null;
}

export function isSpotifyReady(): boolean {
  return spotifyClient?.isReady() ?? false;
}

export async function resolveSpotifyTrack(url: string, requestedBy: string): Promise<Track> {
  if (!spotifyClient) throw new Error('Spotify não inicializado');
  return spotifyClient.resolveTrack(url, requestedBy);
}

export async function resolveSpotifyPlaylist(url: string, requestedBy: string): Promise<Track[]> {
  if (!spotifyClient) throw new Error('Spotify não inicializado');
  return spotifyClient.resolvePlaylist(url, requestedBy);
}
