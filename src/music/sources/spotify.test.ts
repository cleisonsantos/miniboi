import { describe, expect, mock, test } from 'bun:test';
import { SpotifyClient } from './spotify-client.js';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function tokenResponse(token: string): Response {
  return jsonResponse({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3_600,
  });
}

describe('SpotifyClient', () => {
  test('autentica por client credentials e resolve faixa', async () => {
    const fetcher = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/token')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        });
        expect(String(init?.body)).toBe('grant_type=client_credentials');
        return tokenResponse('token-1');
      }

      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });
      return jsonResponse({
        type: 'track',
        name: 'Song',
        duration_ms: 123_456,
        artists: [{ name: 'Artist' }],
        external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
        album: { images: [{ url: 'https://i.scdn.co/image/cover' }] },
      });
    }) as unknown as typeof fetch;
    const client = new SpotifyClient(credentials, fetcher);

    expect(client.isReady()).toBe(false);
    await client.init();
    expect(client.isReady()).toBe(true);
    const track = await client.resolveTrack('https://open.spotify.com/track/abc123', 'tester');

    expect(track).toMatchObject({
      title: 'Song',
      artist: 'Artist',
      duration: 123,
      thumbnail: 'https://i.scdn.co/image/cover',
      source: 'spotify',
      requestedBy: 'tester',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    client.destroy();
    expect(client.isReady()).toBe(false);
  });

  test('pagina playlist e ignora itens removidos, locais e episódios', async () => {
    const fetcher = mock(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/token')) return tokenResponse('playlist-token');
      if (url.includes('offset=100')) {
        return jsonResponse({
          items: [{
            item: {
              type: 'track',
              name: 'Second',
              duration_ms: 90_000,
              artists: [{ name: 'Artist 2' }],
              external_urls: { spotify: 'https://open.spotify.com/track/second' },
            },
          }],
          next: null,
        });
      }
      return jsonResponse({
        items: [
          { item: null },
          { item: { type: 'track', name: 'Local', duration_ms: 1_000, is_local: true } },
          { item: { type: 'episode', name: 'Podcast', duration_ms: 1_000 } },
          {
            item: {
              type: 'track',
              name: 'First',
              duration_ms: 120_000,
              artists: [{ name: 'Artist 1' }],
              external_urls: { spotify: 'https://open.spotify.com/track/first' },
            },
          },
        ],
        next: 'https://api.spotify.com/v1/playlists/list/items?limit=100&offset=100',
      });
    }) as unknown as typeof fetch;
    const client = new SpotifyClient(credentials, fetcher);

    await client.init();
    const tracks = await client.resolvePlaylist(
      'https://open.spotify.com/playlist/list123',
      'tester',
    );

    expect(tracks.map((track) => track.title)).toEqual(['First', 'Second']);
    expect(fetcher).toHaveBeenCalledTimes(3);
    client.destroy();
  });

  test('renova token uma vez após resposta 401', async () => {
    let tokenCalls = 0;
    let apiCalls = 0;
    const fetcher = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/token')) {
        tokenCalls++;
        return tokenResponse(`token-${tokenCalls}`);
      }

      apiCalls++;
      if (apiCalls === 1) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });
        return jsonResponse({ error: { message: 'expired' } }, 401);
      }
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-2' });
      return jsonResponse({
        type: 'track',
        name: 'Recovered',
        duration_ms: 60_000,
        artists: [],
      });
    }) as unknown as typeof fetch;
    const client = new SpotifyClient(credentials, fetcher);

    await client.init();
    const track = await client.resolveTrack('https://open.spotify.com/track/retry123', 'tester');

    expect(track.title).toBe('Recovered');
    expect(tokenCalls).toBe(2);
    expect(apiCalls).toBe(2);
    client.destroy();
  });

  test('rejeita URLs fora do host oficial', async () => {
    const fetcher = mock(async () => tokenResponse('token')) as unknown as typeof fetch;
    const client = new SpotifyClient(credentials, fetcher);
    await client.init();

    await expect(
      client.resolveTrack('https://open.spotify.com.evil.test/track/abc123', 'tester'),
    ).rejects.toThrow('URL do Spotify inválida');
    client.destroy();
  });
});
