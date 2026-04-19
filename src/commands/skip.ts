import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed } from '../utils/embed.js';

export const skipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula para a próxima música'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    queue.skip();
    interaction.reply({ embeds: [successEmbed('⏭️ Música pulada!')] });
  },
};
