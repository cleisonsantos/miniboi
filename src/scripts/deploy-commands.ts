import { deployCommands, commands } from '../commands/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

logger.info('Publicando comandos slash', { count: commands.length });

deployCommands(env.DISCORD_TOKEN, env.DISCORD_CLIENT_ID)
  .then(() => {
    logger.info('Comandos slash publicados', { count: commands.length });
  })
  .catch((error) => {
    logger.error('Falha ao publicar comandos slash', error);
    process.exitCode = 1;
  });
