import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed } from '../utils/embed.js';
import { MusicQueue } from '../music/queue.js';

export const shuffleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Embaralha a fila'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    queue.shuffle();
    interaction.reply({ embeds: [successEmbed('🔀 Fila embaralhada!')] });
  },
};
