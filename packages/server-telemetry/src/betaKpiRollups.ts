import type { TelemetryEvent } from '@dtr/shared-protocol';

/** Join attempts must reach the first WebSocket welcome within this window to count. */
export const JOIN_SUCCESS_WINDOW_MS = 10_000;

export interface BetaKpis {
  roomsCreated: number;
  joinAttempts: number;
  joinSuccesses: number;
  /** Joins that completed (REST join to realtime welcome) within 10 s, over attempts. */
  joinSuccessWithin10sRate: number | null;
  matchesStarted: number;
  matchesCompleted: number;
  matchesInterrupted: number;
  matchCompletionRate: number | null;
  matchBreakingErrorRate: number | null;
  /** Matches with at least one major reconciliation correction, over matches started. */
  desyncMatchRate: number | null;
  /** Players (per room slot) who started 2+ matches, over players who started any. */
  repeatMatchRate: number | null;
  medianMatchDurationMs: number | null;
  disconnects: number;
  barrelHits: number;
  falls: number;
  itemUses: number;
}

const ratio = (num: number, den: number): number | null =>
  den === 0 ? null : Math.round((num / den) * 10_000) / 10_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Pure rollup of closed-beta KPIs from validated telemetry events. */
export function rollupBetaKpis(events: readonly TelemetryEvent[]): BetaKpis {
  const count = (name: TelemetryEvent['name']) => events.filter((e) => e.name === name).length;
  const matchStarts = events.filter((e) => e.name === 'match_start') as Array<
    TelemetryEvent<'match_start'>
  >;
  const matchEnds = events.filter((e) => e.name === 'match_end') as Array<
    TelemetryEvent<'match_end'>
  >;
  const joinSuccesses = events.filter((e) => e.name === 'join_success') as Array<
    TelemetryEvent<'join_success'>
  >;
  const majorDesyncMatches = new Set(
    events
      .filter(
        (e): e is TelemetryEvent<'desync_correction'> =>
          e.name === 'desync_correction' &&
          (e as TelemetryEvent<'desync_correction'>).payload.severity === 'major',
      )
      .map((e) => e.matchId)
      .filter((id): id is string => id !== undefined),
  );
  const matchesPerPlayer = new Map<string, number>();
  for (const start of matchStarts) {
    for (const player of start.payload.playerHashes) {
      matchesPerPlayer.set(player, (matchesPerPlayer.get(player) ?? 0) + 1);
    }
  }
  const completed = matchEnds.filter((e) => e.payload.outcome === 'completed');
  const interrupted = matchEnds.filter((e) => e.payload.outcome === 'interrupted');
  const joinAttempts = count('join_attempt');
  return {
    roomsCreated: count('room_create'),
    joinAttempts,
    joinSuccesses: joinSuccesses.length,
    joinSuccessWithin10sRate: ratio(
      joinSuccesses.filter((e) => e.payload.joinLatencyMs <= JOIN_SUCCESS_WINDOW_MS).length,
      joinAttempts,
    ),
    matchesStarted: matchStarts.length,
    matchesCompleted: completed.length,
    matchesInterrupted: interrupted.length,
    matchCompletionRate: ratio(
      completed.filter((e) => e.payload.finishers > 0).length,
      matchStarts.length,
    ),
    matchBreakingErrorRate: ratio(interrupted.length, matchStarts.length),
    desyncMatchRate: ratio(majorDesyncMatches.size, matchStarts.length),
    repeatMatchRate: ratio(
      [...matchesPerPlayer.values()].filter((n) => n >= 2).length,
      matchesPerPlayer.size,
    ),
    medianMatchDurationMs: median(completed.map((e) => e.payload.durationMs)),
    disconnects: count('disconnect'),
    barrelHits: count('barrel_hit'),
    falls: count('fall'),
    itemUses: count('item_use'),
  };
}
