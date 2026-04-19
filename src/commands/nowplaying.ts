import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { nowPlayingEmbed, errorEmbed } from '../utils/embed.js';

export const nowplayingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra a música atual'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    if (!queue.current) {
      return interaction.reply({ embeds: [errorEmbed('Nenhuma música tocando!')] });
    }

    const embed = nowPlayingEmbed(queue.current);
    interaction.reply({ embeds: [embed] });
  },
};
