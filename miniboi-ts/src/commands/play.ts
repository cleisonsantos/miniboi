import {
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import type { BotCommand } from '../types/index.js';
import { resolveTracks } from '../music/sources/index.js';
import { MusicQueue } from '../music/queue.js';
import { requireVoiceChannel } from '../utils/permissions.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';

export const playCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música ou adiciona à fila')
    .addStringOption((option: SlashCommandStringOption) =>
      option.setName('query')
        .setDescription('URL do YouTube/Spotify ou termo de busca')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query', true)!;
    const requestedBy = interaction.user.tag;

    let tracks;
    try {
      tracks = await resolveTracks(query, requestedBy);
    } catch (error: any) {
      return interaction.editReply({ embeds: [errorEmbed(error.message)] });
    }

    const guildId = interaction.guildId!;
    const channelId = requireVoiceChannel(interaction);

    let queue = MusicQueue.getOrCreate(guildId, interaction.channelId!);
    await queue.connect(channelId, interaction.guild!.voiceAdapterCreator);
    queue.add(tracks);

    const count = tracks.length === 1 ? '1 música' : `${tracks.length} músicas`;
    const desc = tracks.length === 1 ? `Tocando agora: **${tracks[0].title}**` : `Adicionadas ${count} à fila!`;

    interaction.editReply({ embeds: [successEmbed(desc)] });
  },
};
