import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { BotCommand } from './types/index.js';
import { logger } from './utils/logger.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
  }
}

client.commands = new Collection();

client.once('clientReady', async () => {
  logger.info('Cliente Discord conectado', { user: client.user?.tag });
  const { commands } = await import('./commands/index.js');
  commands.forEach((command) => client.commands.set(command.data.name, command));
  logger.info('Comandos carregados localmente', { count: commands.length });
});

client.on('error', (error) => {
  logger.error('Erro no client Discord', error);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  logger.info('Comando recebido', {
    command: interaction.commandName,
    guildId: interaction.guildId,
    userId: interaction.user.id,
  });

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn('Comando não encontrado', { command: interaction.commandName });
    await interaction.reply({ content: 'Comando não encontrado!', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
    logger.info('Comando executado', { command: interaction.commandName });
  } catch (error) {
    logger.error('Erro ao executar comando', error, {
      command: interaction.commandName,
      guildId: interaction.guildId,
    });
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: 'Erro ao executar o comando!' });
    } else {
      await interaction.reply({ content: 'Erro ao executar o comando!', ephemeral: true });
    }
  }
});
