import { Client, GatewayIntentBits, Collection, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { BotCommand } from './types/index.js';

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
  console.log(`✅ MiniBoi logged in as ${client.user?.tag}`);
  const { commands } = await import('./commands/index.js');
  commands.forEach((command) => client.commands.set(command.data.name, command));
  console.log(`Carregados ${commands.length} comandos localmente.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: 'Comando não encontrado!', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command execution error:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Erro ao executar o comando!', flags: MessageFlags.Ephemeral });
    }
  }
});
