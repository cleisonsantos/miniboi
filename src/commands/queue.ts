import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { queueEmbed } from '../utils/embed.js';

export const queueCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Mostra a fila de músicas'),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    const allTracks = queue.current ? [queue.current, ...queue.tracks] : queue.tracks;
    const embed = queueEmbed(allTracks, 0, 1); // simple no pagination for now

    interaction.reply({ embeds: [embed] });
  },
};
