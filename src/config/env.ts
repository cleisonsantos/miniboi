import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, { message: 'DISCORD_TOKEN is required' }),
  DISCORD_CLIENT_ID: z.string().min(1, { message: 'DISCORD_CLIENT_ID is required' }),
  SPOTIFY_CLIENT_ID: z.string().min(1, { message: 'SPOTIFY_CLIENT_ID is required' }),
  SPOTIFY_CLIENT_SECRET: z.string().min(1, { message: 'SPOTIFY_CLIENT_SECRET is required' }),
});

export const env = envSchema.parse(process.env);
