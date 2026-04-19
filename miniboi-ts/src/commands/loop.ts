import { SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { requireQueue, requireSameVoiceChannel } from '../utils/permissions.js';
import { successEmbed } from '../utils/embed.js';
import { MusicQueue } from '../music/queue.js';
import type { LoopMode } from '../types/index.js';

export const loopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Define o modo de loop')
    .addStringOption((option: SlashCommandStringOption) =>
      option.setName('mode')
        .setDescription('Modo de loop')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
    ),
  async execute(interaction) {
    const queue = requireQueue(interaction);
    requireSameVoiceChannel(interaction);

    const mode = interaction.options.getString('mode') as LoopMode;
    queue.setLoop(mode);

    interaction.reply({ embeds: [successEmbed(`🔁 Loop definido para: ${mode}`)] });
  },
};
