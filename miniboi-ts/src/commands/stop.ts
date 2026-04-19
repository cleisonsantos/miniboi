import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { MusicQueue } from '../music/queue.js';
import { successEmbed } from '../utils/embed.js';

export const stopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música, limpa a fila e desconecta o bot'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    queue.destroy();
    interaction.reply({ embeds: [successEmbed('⏹️ Parado e desconectado!')] });
  },
};
