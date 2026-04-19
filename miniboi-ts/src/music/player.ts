import { Readable } from 'node:stream';
import youtubedl from 'youtube-dl-exec';
import { createAudioResource, demuxProbe } from '@discordjs/voice';
import type { Track, AudioStream } from '../types/index.js';

export async function createAudioStream(track: Track, volume: number): Promise<AudioStream> {
  const target = track.source === 'spotify'
    ? `ytsearch1:${track.title} ${track.artist ?? ''}`
    : track.url;

  if (!target) throw new Error('URL inválida');

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

  const response = await fetch(directUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao abrir stream de áudio (${response.status})`);
  }

  const stream = Readable.fromWeb(response.body as unknown as ReadableStream);
  const probe = await demuxProbe(stream);

  const resource = createAudioResource(probe.stream, {
    inputType: probe.type,
    inlineVolume: true,
  });

  resource.volume?.setVolume(volume / 100);

  return resource;
}
