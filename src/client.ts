import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { BotCommand } from './types/index.js';
import { logger } from './utils/logger.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
  }
}

client.commands = new Collection();

client.once('clientReady', async () => {
  logger.info(`MiniBoi logado como ${client.user?.tag}`);
  const { commands } = await import('./commands/index.js');
  commands.forEach((command) => client.commands.set(command.data.name, command));
  logger.info(`${commands.length} comandos carregados localmente`);
});

client.on('error', (error) => {
  logger.error('Erro no client Discord', error);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  logger.info(`Comando recebido: /${interaction.commandName} de ${interaction.user.tag}`);

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`Comando não encontrado: ${interaction.commandName}`);
    await interaction.reply({ content: 'Comando não encontrado!', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
    logger.info(`Comando /${interaction.commandName} executado com sucesso`);
  } catch (error) {
    logger.error(`Erro ao executar /${interaction.commandName}`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: 'Erro ao executar o comando!' });
    } else {
      await interaction.reply({ content: 'Erro ao executar o comando!', ephemeral: true });
    }
  }
});
