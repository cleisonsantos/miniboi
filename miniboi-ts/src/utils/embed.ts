import { EmbedBuilder } from 'discord.js';
import type { Track } from '../types/index.js';

export function successEmbed(description: string) {
  return new EmbedBuilder().setColor(0x00ff00).setDescription(`✅ ${description}`);
}

export function errorEmbed(description: string) {
  return new EmbedBuilder().setColor(0xff0000).setDescription(`❌ ${description}`);
}

export function infoEmbed(description: string) {
  return new EmbedBuilder().setColor(0x0099ff).setDescription(`ℹ️ ${description}`);
}

export function nowPlayingEmbed(track: Track) {
  const barLength = 20;
  const percentage = 0; // TODO: implement real progress
  const filledLength = Math.floor(barLength * percentage);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  const durationStr = new Date(track.duration * 1000).toISOString().slice(14, 19);

  return new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(track.title)
    .setURL(track.url || track.spotifyUrl || undefined)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: 'Artista', value: track.artist || 'Desconhecido', inline: true },
      { name: 'Duração', value: durationStr, inline: true },
      { name: 'Pedida por', value: track.requestedBy, inline: true }
    )
    .setFooter({ text: bar });
}

export function queueEmbed(tracks: Track[], page = 0, totalPages = 1) {
  const perPage = 10;
  const start = page * perPage;
  const pageTracks = tracks.slice(start, start + perPage);
  const description = pageTracks.map((t, i) => `${start + i + 1}. **${t.title}** (${t.artist || ''})`).join('\n') || 'Fila vazia';

  return new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`Fila de músicas - Página ${page + 1}/${totalPages}`)
    .setDescription(description)
    .setFooter({ text: `Total: ${tracks.length} músicas` });
}
