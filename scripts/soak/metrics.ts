/** Nearest-rank percentile of a sample (p in 0..100); null for an empty sample. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]!;
}

export interface Distribution {
  count: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export function distribution(values: readonly number[]): Distribution {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : null,
  };
}

export interface SoakThresholds {
  /** Snapshots are sent at 20 Hz (50 ms); p95 above this means the server is falling behind. */
  snapshotIntervalP95Ms: number;
  snapshotIntervalMaxMs: number;
  /** Unexpected disconnects allowed across the whole run. */
  maxDisconnects: number;
  /** Share of started matches that must end (completed or interrupted) within the run. */
  minMatchEndRate: number;
}

export const DEFAULT_THRESHOLDS: SoakThresholds = {
  snapshotIntervalP95Ms: 100,
  snapshotIntervalMaxMs: 500,
  maxDisconnects: 0,
  minMatchEndRate: 1,
};

export interface SoakSummary {
  config: { rooms: number; playersPerRoom: number; baseUrl: string; maxDurationSec: number };
  startedAt: string;
  durationMs: number;
  players: number;
  matchesStarted: number;
  matchesCompleted: number;
  matchesInterrupted: number;
  disconnects: number;
  errors: string[];
  snapshotIntervalMs: Distribution;
  pingRttMs: Distribution;
  thresholds: SoakThresholds;
  passed: boolean;
  failures: string[];
}

export function evaluateSoak(
  summary: Omit<SoakSummary, 'passed' | 'failures' | 'thresholds'>,
  thresholds: SoakThresholds = DEFAULT_THRESHOLDS,
): SoakSummary {
  const failures: string[] = [];
  const { p95, max } = summary.snapshotIntervalMs;
  if (p95 === null) failures.push('no snapshots received');
  else if (p95 > thresholds.snapshotIntervalP95Ms)
    failures.push(`snapshot interval p95 ${p95} ms > ${thresholds.snapshotIntervalP95Ms} ms`);
  if (max !== null && max > thresholds.snapshotIntervalMaxMs)
    failures.push(`snapshot interval max ${max} ms > ${thresholds.snapshotIntervalMaxMs} ms`);
  if (summary.disconnects > thresholds.maxDisconnects)
    failures.push(`${summary.disconnects} unexpected disconnects`);
  const ended = summary.matchesCompleted + summary.matchesInterrupted;
  const endRate = summary.matchesStarted === 0 ? 0 : ended / summary.matchesStarted;
  if (endRate < thresholds.minMatchEndRate)
    failures.push(`only ${ended}/${summary.matchesStarted} matches ended`);
  if (summary.matchesInterrupted > 0)
    failures.push(`${summary.matchesInterrupted} matches interrupted by server errors`);
  if (summary.errors.length > 0) failures.push(`${summary.errors.length} client errors`);
  return { ...summary, thresholds, passed: failures.length === 0, failures };
}
