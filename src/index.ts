import './config/env.js';
import { client } from './client.js';
import {
  initSpotify,
  isSpotifyReady,
  shutdownSpotify,
} from './music/sources/spotify.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { queues } from './music/queue.js';
import { clearAudioUrlCache } from './music/player.js';
import { startMetricsReporter, stopMetricsReporter } from './utils/metrics.js';
import {
  startHealthServer,
  stopHealthServer,
  type RuntimeStatus,
} from './health.js';

const startedAt = Date.now();
let runtimeStatus: RuntimeStatus = 'starting';
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  logger.info('Iniciando MiniBoi', { version: '1.0' });
  startMetricsReporter();
  startHealthServer({
    hostname: env.HEALTH_HOST,
    port: env.HEALTH_PORT,
    getSnapshot: () => ({
      status: runtimeStatus,
      discordReady: client.isReady(),
      spotifyReady: isSpotifyReady(),
      activeQueues: queues.size,
      startedAt,
    }),
  });
  logger.info('Health server iniciado', {
    host: env.HEALTH_HOST,
    port: env.HEALTH_PORT,
  });

  await initSpotify();
  logger.info('Spotify API inicializado');

  await client.login(env.DISCORD_TOKEN);
  runtimeStatus = 'ready';
  logger.info('Bot pronto', { user: client.user?.tag });
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  runtimeStatus = 'stopping';
  logger.info('Iniciando shutdown', { signal, activeQueues: queues.size });

  for (const queue of queues.values()) queue.destroy();
  shutdownSpotify();
  clearAudioUrlCache();
  stopMetricsReporter();
  client.destroy();
  await stopHealthServer();
  logger.info('Shutdown concluído');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void gracefulShutdown(signal).then(
      () => process.exit(0),
      (error) => {
        logger.error('Falha durante shutdown', error);
        process.exit(1);
      },
    );
  });
}

bootstrap().catch(async (error) => {
  runtimeStatus = 'failed';
  logger.error('Falha fatal no bootstrap', error);
  await stopHealthServer();
  process.exit(1);
});
