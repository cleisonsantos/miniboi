import { SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed } from '../utils/embed.js';

export const volumeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Define o volume (0-100)')
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('level')
        .setDescription('Volume %')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    const level = interaction.options.getInteger('level', true)!;
    queue.setVolume(level);

    interaction.reply({ embeds: [successEmbed(`🔊 Volume definido para ${level}%`)] });
  },
};
