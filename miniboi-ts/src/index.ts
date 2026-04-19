import './config/env.js'; // Validates env on load
import { client } from './client.js';
import { deployCommands } from './commands/index.js';
import { initSpotify } from './music/sources/spotify.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('🚀 Iniciando MiniBoi v1.0 - Discord Music Bot');

  await initSpotify();
  logger.info('Spotify API inicializado');

  await deployCommands(env.DISCORD_TOKEN, env.DISCORD_CLIENT_ID);
  logger.info('Comandos slash registrados');

  await client.login(env.DISCORD_TOKEN);
  logger.info('Bot logado e pronto!');
}

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    logger.info('Recebido sinal de desligamento, fechando graciosamente...');
    client.destroy();
    process.exit(0);
  });
});

bootstrap().catch(error => {
  logger.error('Falha fatal no bootstrap', error);
  process.exit(1);
});
