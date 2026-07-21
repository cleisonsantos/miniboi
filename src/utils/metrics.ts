import { logger } from './logger.js';

type DurationMetric = {
  count: number;
  totalMs: number;
  maxMs: number;
};

export type MetricsSnapshot = {
  durations: Record<string, { count: number; avgMs: number; maxMs: number }>;
  counters: Record<string, number>;
};

const durations = new Map<string, DurationMetric>();
const counters = new Map<string, number>();
let reporter: ReturnType<typeof setInterval> | null = null;

export const metrics = {
  observe(name: string, durationMs: number): void {
    const current = durations.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 };
    current.count++;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    durations.set(name, current);
  },

  increment(name: string, amount = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + amount);
  },

  snapshot(): MetricsSnapshot {
    const durationSnapshot: MetricsSnapshot['durations'] = {};
    for (const [name, value] of durations) {
      durationSnapshot[name] = {
        count: value.count,
        avgMs: round(value.totalMs / value.count),
        maxMs: round(value.maxMs),
      };
    }

    return {
      durations: durationSnapshot,
      counters: Object.fromEntries(counters),
    };
  },

  reset(): void {
    durations.clear();
    counters.clear();
  },
};

export function startMetricsReporter(intervalMs = 300_000): void {
  if (reporter) return;
  reporter = setInterval(() => {
    const snapshot = metrics.snapshot();
    if (Object.keys(snapshot.durations).length || Object.keys(snapshot.counters).length) {
      logger.info('Métricas agregadas', { metrics: snapshot });
    }
  }, intervalMs);
  reporter.unref?.();
}

export function stopMetricsReporter(): void {
  if (reporter) clearInterval(reporter);
  reporter = null;
}

export async function measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    metrics.observe(name, performance.now() - startedAt);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
