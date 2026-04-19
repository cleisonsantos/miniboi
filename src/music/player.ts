import { Readable } from 'node:stream';
import youtubedl from 'youtube-dl-exec';
import { createAudioResource, demuxProbe } from '@discordjs/voice';
import type { Track, AudioStream } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function createAudioStream(track: Track, volume: number): Promise<AudioStream> {
  const target = track.source === 'spotify'
    ? `ytsearch1:${track.title} ${track.artist ?? ''}`
    : track.url;

  if (!target) throw new Error('URL inválida');

  logger.info(`Obtendo URL de áudio do YouTube para: ${track.title}`);
  const direct = await youtubedl(target, {
    getUrl: true,
    format: 'bestaudio/best',
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
  });

  const directUrl = String(direct).split('\n')[0]?.trim();
  if (!directUrl) {
    throw new Error('Falha ao obter stream de áudio do YouTube');
  }

  logger.info('Stream URL obtida, abrindo conexão...');
  const response = await fetch(directUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao abrir stream de áudio (${response.status})`);
  }

  const stream = Readable.fromWeb(response.body as unknown as ReadableStream);
  logger.info('Probe de áudio...');
  const probe = await demuxProbe(stream);

  logger.info('Criando AudioResource...');
  const resource = createAudioResource(probe.stream, {
    inputType: probe.type,
    inlineVolume: true,
  });

  resource.volume?.setVolume(volume / 100);
  logger.info(`AudioResource criado com volume ${volume}%`);

  return resource;
}
