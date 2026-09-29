import { describe, expect, it } from 'vitest';
import { distribution, evaluateSoak, percentile } from './metrics.js';

const base = {
  config: { rooms: 2, playersPerRoom: 5, baseUrl: 'http://x', maxDurationSec: 10 },
  startedAt: '2026-12-10T00:00:00Z',
  durationMs: 1000,
  players: 10,
  matchesStarted: 2,
  matchesCompleted: 2,
  matchesInterrupted: 0,
  disconnects: 0,
  errors: [],
  pingRttMs: distribution([5, 6]),
};

describe('soak metrics', () => {
  it('computes nearest-rank percentiles', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([], 50)).toBeNull();
    expect(distribution([50, 49, 51, 200])).toEqual({ count: 4, p50: 50, p95: 200, max: 200 });
  });

  it('passes a healthy 20 Hz run and fails slow or broken ones', () => {
    const healthy = evaluateSoak({ ...base, snapshotIntervalMs: distribution([50, 50, 51, 49]) });
    expect(healthy).toMatchObject({ passed: true, failures: [] });

    const slow = evaluateSoak({
      ...base,
      snapshotIntervalMs: distribution([...Array(90).fill(50), ...Array(10).fill(180)]),
      disconnects: 1,
      matchesCompleted: 1,
    });
    expect(slow.passed).toBe(false);
    expect(slow.failures).toEqual([
      'snapshot interval p95 180 ms > 100 ms',
      '1 unexpected disconnects',
      'only 1/2 matches ended',
    ]);
  });
});
