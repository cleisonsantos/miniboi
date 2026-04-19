import './config/env.js';
import { client } from './client.js';
import { deployCommands } from './commands/index.js';
import { initSpotify } from './music/sources/spotify.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { queues } from './music/queue.js';

async function bootstrap() {
  logger.info('🚀 Iniciando MiniBoi v1.0 - Discord Music Bot');

  await initSpotify();
  logger.info('Spotify API inicializado');

  await deployCommands(env.DISCORD_TOKEN, env.DISCORD_CLIENT_ID);
  logger.info('Comandos slash registrados');

  await client.login(env.DISCORD_TOKEN);
  logger.info('Bot logado e pronto!');
}

async function gracefulShutdown() {
  logger.info('Recebido sinal de desligamento, fechando graciosamente...');
  for (const queue of queues.values()) {
    queue.destroy();
  }
  client.destroy();
  process.exit(0);
}

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    gracefulShutdown();
  });
});

bootstrap().catch(error => {
  logger.error('Falha fatal no bootstrap', error);
  process.exit(1);
});
