import { describe, expect, test } from 'bun:test';
import { createHealthHandler, type HealthSnapshot } from './health.js';

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    status: 'starting',
    discordReady: false,
    spotifyReady: false,
    activeQueues: 0,
    startedAt: Date.now() - 5_000,
    ...overrides,
  };
}

describe('health handler', () => {
  test('liveness responde durante inicialização', async () => {
    const handler = createHealthHandler(() => snapshot());
    const response = handler(new Request('http://localhost/health/live'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({ status: 'starting', ready: false });
  });

  test('readiness exige runtime, Discord e Spotify prontos', async () => {
    let state = snapshot({ status: 'ready', discordReady: true });
    const handler = createHealthHandler(() => state);

    const unavailable = handler(new Request('http://localhost/health/ready'));
    expect(unavailable.status).toBe(503);

    state = { ...state, spotifyReady: true, activeQueues: 2 };
    const ready = handler(new Request('http://localhost/health/ready'));
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ ready: true, activeQueues: 2 });
  });

  test('rota desconhecida retorna 404', async () => {
    const handler = createHealthHandler(() => snapshot());
    const response = handler(new Request('http://localhost/unknown'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
