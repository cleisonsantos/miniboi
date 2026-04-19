import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { AudioPlayerStatus } from '@discordjs/voice';

export const pauseCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa a música atual'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    if (queue.player.state.status === AudioPlayerStatus.Paused) {
      return interaction.reply({ embeds: [errorEmbed('A música já está pausada!')] });
    }

    queue.player.pause();
    interaction.reply({ embeds: [successEmbed('⏸️ Música pausada!')] });
  },
};
