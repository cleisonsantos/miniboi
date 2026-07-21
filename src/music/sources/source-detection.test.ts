import { describe, expect, test } from 'bun:test';
import { detectSource } from './source-detection.js';

describe('detectSource', () => {
  test('detecta URLs oficiais suportadas', () => {
    expect(detectSource('https://youtu.be/video123')).toBe('youtube_video');
    expect(detectSource('https://www.youtube.com/watch?v=video123')).toBe('youtube_video');
    expect(detectSource('https://www.youtube.com/playlist?list=list123')).toBe('youtube_playlist');
    expect(detectSource('https://open.spotify.com/track/track123')).toBe('spotify_track');
    expect(detectSource('https://open.spotify.com/intl-pt/playlist/list123')).toBe('spotify_playlist');
  });

  test('não confia em host parecido nem em list= dentro de texto', () => {
    expect(detectSource('https://open.spotify.com.evil.test/track/track123')).toBe('search');
    expect(detectSource('https://youtube.com.evil.test/watch?v=video123')).toBe('search');
    expect(detectSource('minha busca list=qualquer')).toBe('search');
  });
});
