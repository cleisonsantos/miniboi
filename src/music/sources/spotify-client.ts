import type { Track } from '../../types/index.js';
import { combinedTimeoutSignal, HTTP_TIMEOUT_MS } from '../../utils/async.js';
import { logger } from '../../utils/logger.js';
import { measure, metrics } from '../../utils/metrics.js';

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const TOKEN_RETRY_MS = 30_000;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const PLAYLIST_PAGE_SIZE = 100;
const PLAYLIST_TRACK_LIMIT = 500;

type SpotifyCredentials = {
  clientId: string;
  clientSecret: string;
};

type SpotifyTokenResponse = {
  access_token: string;
  expires_in: number;
};

type SpotifyTrack = {
  type?: string;
  name: string;
  duration_ms: number;
  artists?: Array<{ name: string }>;
  external_urls?: { spotify?: string };
  album?: { images?: Array<{ url: string }> };
  is_local?: boolean;
};

type SpotifyPlaylistPage = {
  items: Array<{
    item?: SpotifyTrack | null;
    track?: SpotifyTrack | null;
  }>;
  next: string | null;
};

type Fetcher = typeof fetch;

export class SpotifyClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly credentials: SpotifyCredentials,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async init(): Promise<void> {
    await this.ensureAccessToken(true);
  }

  isReady(): boolean {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  destroy(): void {
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    this.refreshTimeout = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async resolveTrack(url: string, requestedBy: string): Promise<Track> {
    const trackId = extractSpotifyId(url, 'track');
    const track = await this.apiRequest<SpotifyTrack>(`/tracks/${trackId}`);
    return toTrack(track, requestedBy, url);
  }

  async resolvePlaylist(url: string, requestedBy: string): Promise<Track[]> {
    const playlistId = extractSpotifyId(url, 'playlist');
    const tracks: Track[] = [];
    let next: string | null = `/playlists/${playlistId}/items?limit=${PLAYLIST_PAGE_SIZE}`;

    while (next && tracks.length < PLAYLIST_TRACK_LIMIT) {
      const page: SpotifyPlaylistPage = await this.apiRequest<SpotifyPlaylistPage>(next);
      if (!Array.isArray(page.items)) throw new Error('Resposta inválida da playlist do Spotify');

      for (const entry of page.items) {
        const item = entry.item ?? entry.track;
        if (!isPlayableTrack(item)) continue;
        tracks.push(toTrack(item, requestedBy));
        if (tracks.length >= PLAYLIST_TRACK_LIMIT) break;
      }

      next = typeof page.next === 'string' ? page.next : null;
    }

    if (tracks.length === PLAYLIST_TRACK_LIMIT) {
      metrics.increment('spotify_playlist_limit_hit');
    }
    return tracks;
  }

  private async apiRequest<T>(pathOrUrl: string, retryAuth = true): Promise<T> {
    await this.ensureAccessToken();
    const url = new URL(pathOrUrl, `${SPOTIFY_API_URL}/`);
    if (url.origin !== 'https://api.spotify.com') {
      throw new Error('URL de paginação do Spotify inválida');
    }

    const response = await measure('spotify_api_request_ms', () => this.fetcher(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      signal: combinedTimeoutSignal(HTTP_TIMEOUT_MS),
    }));

    if (response.status === 401 && retryAuth) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      await this.ensureAccessToken(true);
      return this.apiRequest<T>(pathOrUrl, false);
    }

    if (!response.ok) throw await spotifyHttpError(response, 'Spotify API');
    return response.json() as Promise<T>;
  }

  private async ensureAccessToken(force = false): Promise<void> {
    if (!force && this.accessToken && Date.now() < this.tokenExpiresAt) return;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshAccessToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const authorization = Buffer.from(
        `${this.credentials.clientId}:${this.credentials.clientSecret}`,
      ).toString('base64');
      const response = await measure('spotify_token_request_ms', () => this.fetcher(
        SPOTIFY_ACCOUNTS_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ grant_type: 'client_credentials' }),
          signal: combinedTimeoutSignal(HTTP_TIMEOUT_MS),
        },
      ));

      if (!response.ok) throw await spotifyHttpError(response, 'Autenticação do Spotify');
      const token = await response.json() as Partial<SpotifyTokenResponse>;
      if (
        typeof token.access_token !== 'string'
        || typeof token.expires_in !== 'number'
        || token.expires_in <= 0
      ) {
        throw new Error('Resposta inválida da autenticação do Spotify');
      }

      this.accessToken = token.access_token;
      const lifetimeMs = token.expires_in * 1_000;
      const refreshInMs = Math.max(1_000, lifetimeMs - TOKEN_REFRESH_MARGIN_MS);
      this.tokenExpiresAt = Date.now() + lifetimeMs;
      this.scheduleTokenRefresh(refreshInMs);
    } catch (error) {
      this.scheduleTokenRefresh(TOKEN_RETRY_MS);
      throw error;
    }
  }

  private scheduleTokenRefresh(delayMs: number): void {
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => {
      void this.ensureAccessToken(true).catch((error) => {
        logger.error('Spotify token refresh error', error);
      });
    }, delayMs);
    this.refreshTimeout.unref?.();
  }
}

function extractSpotifyId(url: string, kind: 'track' | 'playlist'): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'open.spotify.com') {
    throw new Error('URL do Spotify inválida');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  const kindIndex = parts.indexOf(kind);
  const id = parts[kindIndex + 1];
  if (kindIndex < 0 || !id || !/^[A-Za-z0-9]+$/.test(id)) {
    throw new Error(`URL de ${kind} do Spotify inválida`);
  }
  return id;
}

function isPlayableTrack(track: SpotifyTrack | null | undefined): track is SpotifyTrack {
  return Boolean(
    track
    && track.type !== 'episode'
    && !track.is_local
    && typeof track.name === 'string'
    && typeof track.duration_ms === 'number',
  );
}

function toTrack(track: SpotifyTrack, requestedBy: string, fallbackUrl = ''): Track {
  return {
    title: track.name,
    artist: track.artists?.[0]?.name ?? 'Unknown',
    spotifyUrl: track.external_urls?.spotify ?? fallbackUrl,
    url: '',
    thumbnail: track.album?.images?.[0]?.url,
    source: 'spotify',
    duration: Math.floor(track.duration_ms / 1_000),
    requestedBy,
  };
}

async function spotifyHttpError(response: Response, label: string): Promise<Error> {
  let detail = '';
  try {
    const body = await response.json() as { error?: { message?: string } | string };
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? '';
  } catch {
    // Corpo de erro pode não ser JSON.
  }

  const retryAfter = response.headers.get('retry-after');
  const suffix = [detail, retryAfter ? `retry-after=${retryAfter}s` : '']
    .filter(Boolean)
    .join('; ');
  return new Error(`${label} falhou (${response.status})${suffix ? `: ${suffix}` : ''}`);
}
