import { beforeEach, describe, expect, test } from 'bun:test';
import { measure, metrics } from './metrics.js';

describe('metrics', () => {
  beforeEach(() => metrics.reset());

  test('agrega contadores e durações sem guardar amostras', () => {
    metrics.increment('unit_cache_hit');
    metrics.increment('unit_cache_hit', 2);
    metrics.observe('unit_request_ms', 10);
    metrics.observe('unit_request_ms', 20);

    const snapshot = metrics.snapshot();
    expect(snapshot.durations.unit_request_ms).toEqual({ count: 2, avgMs: 15, maxMs: 20 });
    expect(snapshot.counters.unit_cache_hit).toBe(3);
  });

  test('measure registra duração mesmo quando operação falha', async () => {
    await expect(measure('unit_failure_ms', async () => {
      throw new Error('falhou');
    })).rejects.toThrow('falhou');

    expect(metrics.snapshot().durations.unit_failure_ms?.count).toBe(1);
  });
});
