import { SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { VoiceConnection, AudioPlayer, AudioResource } from '@discordjs/voice';

export type TrackSource = 'youtube' | 'spotify';

export type LoopMode = 'off' | 'track' | 'queue';

export interface Track {
  title: string;
  url: string;
  duration: number; // seconds
  thumbnail?: string;
  source: TrackSource;
  requestedBy: string; // user tag
  artist?: string;
  spotifyUrl?: string;
}

export interface MusicQueue {
  tracks: Track[];
  current: Track | null;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  volume: number;
  loopMode: LoopMode;
  textChannelId: string;
}

export type BotCommandExecute = (interaction: ChatInputCommandInteraction) => Promise<unknown>;

export interface BotCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: BotCommandExecute;
}

export type AudioStream = AudioResource;
