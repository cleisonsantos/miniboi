import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  SPOTIFY_CLIENT_ID: z.string().min(1, 'SPOTIFY_CLIENT_ID is required'),
  SPOTIFY_CLIENT_SECRET: z.string().min(1, 'SPOTIFY_CLIENT_SECRET is required'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  HEALTH_HOST: z.string().min(1).default('0.0.0.0'),
  HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Erro de validação das variáveis de ambiente:');
  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = {
  ...result.data,
  LOG_FORMAT: result.data.LOG_FORMAT
    ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
};
