import { ChatInputCommandInteraction } from 'discord.js';
import { MusicQueue } from '../music/queue.js';

function getMemberVoiceChannelId(interaction: ChatInputCommandInteraction): string | null {
  const member = interaction.member;
  if (member && 'voice' in member) {
    return member.voice?.channelId ?? null;
  }

  const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
  return guildMember?.voice?.channelId ?? null;
}

export function requireVoiceChannel(interaction: ChatInputCommandInteraction): string {
  const channelId = getMemberVoiceChannelId(interaction);
  if (!channelId) {
    throw new Error('Você precisa estar em um canal de voz para usar este comando!');
  }
  return channelId;
}

export function requireQueue(interaction: ChatInputCommandInteraction): MusicQueue {
  const queue = MusicQueue.from(interaction.guildId!);
  if (!queue) {
    throw new Error('Nenhuma fila de música ativa neste servidor!');
  }
  return queue;
}

export function requireSameVoiceChannel(interaction: ChatInputCommandInteraction): void {
  const queue = requireQueue(interaction);
  const memberChannelId = getMemberVoiceChannelId(interaction);
  const botChannelId = queue.connection?.joinConfig.channelId ?? null;

  if (!memberChannelId) {
    throw new Error('Você precisa estar em um canal de voz para usar este comando!');
  }

  if (botChannelId && memberChannelId !== botChannelId) {
    throw new Error('Você precisa estar no mesmo canal de voz que o MiniBoi!');
  }
}
