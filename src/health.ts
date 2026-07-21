export type RuntimeStatus = 'starting' | 'ready' | 'stopping' | 'failed';

export type HealthSnapshot = {
  status: RuntimeStatus;
  discordReady: boolean;
  spotifyReady: boolean;
  activeQueues: number;
  startedAt: number;
};

type HealthServerOptions = {
  hostname: string;
  port: number;
  getSnapshot: () => HealthSnapshot;
};

let server: Bun.Server<unknown> | null = null;

export function createHealthHandler(getSnapshot: () => HealthSnapshot) {
  return (request: Request): Response => {
    const snapshot = getSnapshot();
    const pathname = new URL(request.url).pathname;
    const ready = snapshot.status === 'ready'
      && snapshot.discordReady
      && snapshot.spotifyReady;
    const body = {
      status: snapshot.status,
      ready,
      discordReady: snapshot.discordReady,
      spotifyReady: snapshot.spotifyReady,
      activeQueues: snapshot.activeQueues,
      uptimeSeconds: Math.floor((Date.now() - snapshot.startedAt) / 1_000),
    };

    if (pathname === '/health/live') return json(body, 200);
    if (pathname === '/health/ready') return json(body, ready ? 200 : 503);
    return json({ error: 'Not found' }, 404);
  };
}

export function startHealthServer(options: HealthServerOptions): Bun.Server<unknown> {
  if (server) return server;
  server = Bun.serve({
    hostname: options.hostname,
    port: options.port,
    fetch: createHealthHandler(options.getSnapshot),
  });
  return server;
}

export async function stopHealthServer(): Promise<void> {
  const current = server;
  server = null;
  if (current) await current.stop(true);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
