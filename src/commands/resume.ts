import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { AudioPlayerStatus } from '@discordjs/voice';

export const resumeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Retoma a música pausada'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    if (queue.player.state.status !== AudioPlayerStatus.Paused) {
      return interaction.reply({ embeds: [errorEmbed('A música não está pausada!')] });
    }

    queue.player.unpause();
    interaction.reply({ embeds: [successEmbed('▶️ Música retomada!')] });
  },
};
