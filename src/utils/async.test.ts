import { describe, expect, test } from 'bun:test';
import { combinedTimeoutSignal, withTimeout } from './async.js';

describe('async utilities', () => {
  test('retorna operação concluída antes do timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'operação')).resolves.toBe('ok');
  });

  test('rejeita operação lenta com mensagem contextual', async () => {
    const never = new Promise<never>(() => undefined);
    await expect(withTimeout(never, 5, 'Spotify')).rejects.toThrow(
      'Spotify excedeu o limite de 5ms',
    );
  });

  test('combina cancelamento externo com timeout', async () => {
    const controller = new AbortController();
    const signal = combinedTimeoutSignal(1_000, controller.signal);
    controller.abort(new Error('cancelado'));

    expect(signal.aborted).toBe(true);
  });
});
