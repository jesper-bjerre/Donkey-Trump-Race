/**
 * Deterministic telemetry fixtures. `telemetry-events.json` and `betaTelemetry.jsonl`
 * are generated from here by `pnpm fixtures:regenerate` and compared by the tests.
 */
import type { TelemetryEventName, TelemetryEventPayloadMap } from '@dtr/shared-protocol';
import { buildTelemetryEvent } from '../../src/eventTaxonomy.js';
import { createPseudonymHasher } from '../../src/hashing.js';

export const FIXTURE_SALT = 'fixture-salt-not-a-secret-000000';
const hasher = createPseudonymHasher(FIXTURE_SALT);
const base = Date.parse('2026-12-10T18:00:00.000Z');

let seq = 0;
function event<K extends TelemetryEventName>(
  name: K,
  offsetMs: number,
  payload: TelemetryEventPayloadMap[K],
  ids: { room?: string; player?: string; matchId?: string } = {},
) {
  seq++;
  return buildTelemetryEvent(
    name,
    {
      environment: 'beta',
      eventId: `evt_fixture${String(seq).padStart(5, '0')}`,
      occurredAt: new Date(base + offsetMs),
      ...(ids.room ? { roomHash: hasher.roomHash(ids.room) } : {}),
      ...(ids.player ? { playerHash: hasher.playerHash(ids.player) } : {}),
      ...(ids.matchId ? { matchId: ids.matchId } : {}),
    },
    payload,
  );
}

/** One valid example of every event name in the taxonomy. */
export function buildTaxonomyExamples() {
  seq = 0;
  const room = { room: 'A7K2Q' };
  const player = { room: 'A7K2Q', player: 'p_sample1', matchId: 'm_0123456789ab' };
  return [
    event('room_create', 0, {}, room),
    event('join_attempt', 10, {}, room),
    event('join_success', 20, { slotIndex: 1, joinLatencyMs: 850 }, { ...room, player: 'p_2' }),
    event('join_failure', 30, { errorCode: 'ROOM_FULL' }, room),
    event(
      'match_start',
      40,
      { playerCount: 2, playerHashes: [hasher.playerHash('p_sample1'), hasher.playerHash('p_2')] },
      { ...room, matchId: player.matchId },
    ),
    event('barrel_hit', 50, { slotIndex: 0, blocked: false }, player),
    event('fall', 60, { slotIndex: 0 }, player),
    event('item_use', 70, { slotIndex: 0, item: 'tweetStorm' }, player),
    event(
      'desync_correction',
      80,
      { playerSlot: 0, correctionDistance: 0.8, tick: 900, severity: 'minor' },
      player,
    ),
    event('disconnect', 90, { closeCode: 1006, phase: 'match' }, player),
    event('reconnect', 100, { offlineMs: 4200 }, player),
    event('rescue_complete', 110, { slotIndex: 0, rank: 1, raceTimeMs: 150_000 }, player),
    event(
      'match_end',
      120,
      { outcome: 'completed', durationMs: 180_000, playerCount: 2, finishers: 2 },
      { ...room, matchId: player.matchId },
    ),
    event(
      'match_breaking_error',
      130,
      { errorClass: 'TypeError', phase: 'match' },
      { ...room, matchId: 'm_ba9876543210' },
    ),
    event('rate_limited', 140, { scope: 'rest', policy: 'rooms.join' }),
  ];
}

/**
 * A small closed-beta session: 10 rooms, 10 matches, one interrupted, one major
 * desync, one slow join. Chosen so every KPI gate has a known pass/fail outcome.
 */
export function buildBetaSession() {
  seq = 0;
  const events = [];
  let t = 0;
  for (let r = 0; r < 10; r++) {
    const room = `R${r}AAA`;
    const players = [`p_${r}a`, `p_${r}b`, `p_${r}c`];
    events.push(event('room_create', (t += 1000), {}, { room }));
    players.forEach((p, i) => {
      events.push(event('join_attempt', (t += 100), {}, { room }));
      const slow = r === 3 && i === 2;
      events.push(
        event(
          'join_success',
          (t += 100),
          { slotIndex: i, joinLatencyMs: slow ? 12_000 : 900 + i * 100 },
          { room, player: p },
        ),
      );
    });
    // Rooms 0-7 play two matches (repeat play); rooms 8-9 play one.
    const matchCount = r < 8 ? 2 : 1;
    for (let m = 0; m < matchCount; m++) {
      const matchId = `m_${String(r).padStart(2, '0')}${String(m).padStart(2, '0')}00000000`;
      events.push(
        event(
          'match_start',
          (t += 1000),
          { playerCount: 3, playerHashes: players.map((p) => hasher.playerHash(p)) },
          { room, matchId },
        ),
      );
      if (r === 5 && m === 0) {
        events.push(
          event(
            'desync_correction',
            (t += 500),
            { playerSlot: 1, correctionDistance: 4.2, tick: 3000, severity: 'major' },
            { room, player: players[1], matchId },
          ),
        );
      }
      const interrupted = r === 9;
      events.push(
        event(
          'match_end',
          (t += 150_000),
          interrupted
            ? { outcome: 'interrupted', durationMs: 60_000, playerCount: 3, finishers: 0 }
            : {
                outcome: 'completed',
                durationMs: 150_000 + r * 1000,
                playerCount: 3,
                finishers: 3,
              },
          { room, matchId },
        ),
      );
    }
  }
  return events;
}

export const LEGAL_GATE_STATES = {
  legalIpReview: { status: 'pending', notes: 'Parody names and likenesses awaiting review.' },
  privacyReview: { status: 'approved', reviewedAt: '2026-12-01' },
  accessibilityReview: { status: 'approved', reviewedAt: '2026-12-03' },
} as const;
