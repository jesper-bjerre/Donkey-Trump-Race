import { describe, expect, it } from 'vitest';
import { getPlayableBounds, MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import { PLAYER_COLOR_IDS, validateAuthoritativeSnapshot } from '@dtr/shared-protocol';
import {
  autopilotInput,
  BOSS_FIRST_THROW_DELAY_MS,
  COUNTDOWN_MS,
  createMotionState,
  FALL_PENALTY_MS,
  STUN_MS,
  TICK_MS,
  type MovementInput,
} from '@dtr/shared-simulation';
import { MatchRunner } from '../src/game/MatchRunner.js';
import { PlayerShoveSystem } from '../src/game/systems/shove.js';

function makeMatch(count = 5, countdownMs = 0) {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    slotIndex: i,
    nickname: `Player ${i}`,
    color: PLAYER_COLOR_IDS[i]!,
    connected: true,
  }));
  const match = new MatchRunner({
    matchId: 'm_test',
    level: LEVEL,
    players,
    seed: 1234,
    countdownMs,
  });
  let seq = 0;
  const send = (id: string, input: Partial<MovementInput>) =>
    match.submitInput(id, { seq: ++seq, moveX: 0, moveZ: 0, climb: 0, jump: false, ...input });
  return { match, send };
}

function ticks(match: MatchRunner, n: number) {
  for (let i = 0; i < n; i++) match.advanceTick();
}

function clearBarrels(match: MatchRunner) {
  match.bossSystem.barrels.length = 0;
}

describe('MatchRunner timing', () => {
  it('ticks at 60 Hz and snapshots every third tick', () => {
    const { match } = makeMatch(1);
    const broadcasts: number[] = [];
    for (let i = 0; i < 12; i++) {
      match.advanceTick();
      if (match.shouldBroadcastSnapshot()) broadcasts.push(match.tick);
    }
    expect(match.nowMs).toBeCloseTo(12 * TICK_MS);
    expect(broadcasts).toEqual([3, 6, 9, 12]);
  });

  it('spawns one player per slot with its color and a valid snapshot', () => {
    const { match } = makeMatch(5);
    const snapshot = match.snapshot();
    expect(validateAuthoritativeSnapshot(snapshot)).not.toBeNull();
    expect(snapshot.players.map((p) => p.color)).toEqual(PLAYER_COLOR_IDS);
  });

  it('holds players during the countdown', () => {
    const { match, send } = makeMatch(1, COUNTDOWN_MS);
    send('p0', { moveX: 1 });
    ticks(match, 60);
    expect(match.phase).toBe('countdown');
    expect(match.snapshot().players[0]!.x).toBe(2);
    ticks(match, 180);
    expect(match.phase).toBe('racing');
  });
});

describe('boss and barrels', () => {
  it('places the boss far right and throws barrels on its interval', () => {
    const { match } = makeMatch(1);
    const bounds = getPlayableBounds(LEVEL);
    expect(match.snapshot().boss.x).toBeGreaterThan(bounds.rightFallEdgeX - 2);
    ticks(match, Math.floor(BOSS_FIRST_THROW_DELAY_MS / TICK_MS) - 2);
    expect(match.snapshot().barrels).toHaveLength(0);
    ticks(match, 3);
    const barrels = match.snapshot().barrels;
    expect(barrels).toHaveLength(1);
    expect(barrels[0]!.y).toBe(LEVEL.floors[4]!.y);
    expect(barrels[0]!.vx).toBeLessThan(0);
  });

  it('knocks a player down for exactly 2000 ms and ignores movement until then', () => {
    const { match, send } = makeMatch(1);
    ticks(match, 1);
    clearBarrels(match);
    const player = match.debugPlayer('p0')!;
    player.motion = createMotionState(20, 0, 0, 0);
    match.bossSystem.spawnBarrelAt(20.5, 0, 0, -5);
    ticks(match, 1);
    const hitAt = match.nowMs;
    const snap = match.snapshot().players[0]!;
    expect(snap.knockedDown).toBe(true);
    expect(snap.movementDisabledUntilMs).toBe(hitAt + STUN_MS);

    clearBarrels(match);
    send('p0', { moveX: 1 });
    for (let i = 0; i < 20; i++) send('p0', { moveX: 1 });
    const x = player.motion.x;
    while (match.nowMs + TICK_MS < hitAt + STUN_MS) match.advanceTick();
    expect(player.motion.x).toBe(x);
    ticks(match, 3);
    expect(player.knockedDown).toBe(false);
    expect(player.motion.x).toBeGreaterThan(x);
  });

  it('lets a jumping player clear a barrel', () => {
    const { match, send } = makeMatch(1);
    ticks(match, 1);
    clearBarrels(match);
    const player = match.debugPlayer('p0')!;
    player.motion = createMotionState(20, 0, 0, 0);
    send('p0', { jump: true });
    ticks(match, 12); // rising well above barrel height
    match.bossSystem.spawnBarrelAt(player.motion.x, 0, 0, -5);
    ticks(match, 1);
    expect(player.knockedDown).toBe(false);
  });

  it('blocks a barrel with a shield', () => {
    const { match } = makeMatch(1);
    ticks(match, 1);
    clearBarrels(match);
    const player = match.debugPlayer('p0')!;
    player.motion = createMotionState(20, 0, 0, 0);
    player.shieldUntilMs = match.nowMs + 6000;
    match.bossSystem.spawnBarrelAt(20.5, 0, 0, -5);
    ticks(match, 1);
    expect(player.knockedDown).toBe(false);
    expect(player.shieldUntilMs).toBe(0);
    expect(match.drainEvents().map((e) => e.kind)).toContain('shieldBlock');
  });
});

describe('shoves', () => {
  it('evaluates ten pairs for five players', () => {
    const { match } = makeMatch(5);
    const players = (['p0', 'p1', 'p2', 'p3', 'p4'] as const).map((id) => match.debugPlayer(id)!);
    const result = new PlayerShoveSystem().resolveSideImpacts(players, 0, () => undefined);
    expect(result.pairsEvaluated).toBe(10);
  });

  it('pushes the impacted player sideways', () => {
    const { match, send } = makeMatch(2);
    ticks(match, 1);
    clearBarrels(match);
    const a = match.debugPlayer('p0')!;
    const b = match.debugPlayer('p1')!;
    a.motion = createMotionState(10, 0, -1, 0);
    b.motion = createMotionState(10, 0, 0, 0);
    for (let i = 0; i < 10; i++) send('p0', { moveZ: 1 });
    ticks(match, 20);
    expect(b.motion.z).toBeGreaterThan(0.8);
    expect(match.result().highlights.shoves).toBeGreaterThanOrEqual(1);
  });
});

describe('falls', () => {
  it('respawns a player inside the bounds with a fall penalty', () => {
    const { match, send } = makeMatch(1);
    ticks(match, 1);
    clearBarrels(match);
    const player = match.debugPlayer('p0')!;
    player.motion = createMotionState(39, 4, 0, 1);
    for (let i = 0; i < 30; i++) send('p0', { moveX: 1 });
    let fellAt: number | null = null;
    for (let i = 0; i < 120 && fellAt === null; i++) {
      match.advanceTick();
      if (match.drainEvents().some((e) => e.kind === 'fall')) fellAt = match.nowMs;
    }
    expect(fellAt).not.toBeNull();
    const snap = match.snapshot().players[0]!;
    expect(snap.fallPenalty).toBe(true);
    expect(snap.movementDisabledUntilMs).toBe(fellAt! + FALL_PENALTY_MS);
    const bounds = getPlayableBounds(LEVEL);
    expect(snap.x).toBeGreaterThan(bounds.leftWallX);
    expect(snap.x).toBeLessThan(bounds.rightFallEdgeX);
    expect(snap.floor).toBe(1);
    expect(snap.grounded).toBe(true);
  });
});

describe('items', () => {
  it('awards an item from a box and applies self and opponent effects', () => {
    const { match } = makeMatch(2);
    ticks(match, 1);
    clearBarrels(match);
    const a = match.debugPlayer('p0')!;
    const b = match.debugPlayer('p1')!;
    const box = match.itemSystem.boxes[0]!;
    a.motion = createMotionState(box.x, box.y, box.z, 1);
    b.motion = createMotionState(30, 12, 0, 3); // far ahead
    ticks(match, 1);
    expect(a.heldItem).not.toBeNull();
    expect(match.snapshot().itemBoxes.find((i) => i.id === box.id)?.active).toBe(false);

    a.heldItem = 'speedBoost';
    match.requestUseItem('p0');
    ticks(match, 1);
    expect(a.speedBoostUntilMs).toBeGreaterThan(match.nowMs);
    expect(a.heldItem).toBeNull();

    a.heldItem = 'tweetStorm';
    match.requestUseItem('p0');
    ticks(match, 1);
    expect(b.knockedDown).toBe(true);
    expect(match.result().highlights.itemUses).toBe(2);
  });
});

describe('rescue and results', () => {
  it('orders same-tick finishers by slot and ends the match', () => {
    const { match } = makeMatch(3);
    ticks(match, 1);
    clearBarrels(match);
    const zone = LEVEL.rescueZone;
    const top = LEVEL.floors.length - 1;
    match.debugPlayer('p2')!.motion = createMotionState(zone.minX + 2, 20, 0, top);
    match.debugPlayer('p1')!.motion = createMotionState(zone.minX + 3, 20, 1, top);
    ticks(match, 1);
    const order = match.snapshot().finishOrder;
    expect(order.map((f) => [f.rank, f.playerId])).toEqual([
      [1, 'p1'],
      [2, 'p2'],
    ]);
    expect(order[0]!.finishTick).toBe(order[1]!.finishTick);
    expect(match.snapshot().raceEndsAtMs).not.toBeNull();

    match.debugPlayer('p0')!.motion = createMotionState(zone.minX + 1, 20, -1, top);
    ticks(match, 1);
    expect(match.isFinished()).toBe(true);
    expect(match.result().finishOrder.map((f) => f.playerId)).toEqual(['p1', 'p2', 'p0']);
  });

  it('is deterministic for the same seed and inputs', () => {
    const run = () => {
      const { match, send } = makeMatch(2, 500);
      for (let t = 0; t < 1200; t++) {
        if (t % 2 === 0) {
          for (const id of ['p0', 'p1'])
            send(id, autopilotInput(LEVEL, match.debugPlayer(id)!.motion));
        }
        match.advanceTick();
      }
      return match.snapshot();
    };
    expect(run()).toEqual(run());
  });

  it('a bot following the route can finish a solo match', () => {
    const { match, send } = makeMatch(1);
    for (let t = 0; t < 60 * 120 && !match.isFinished(); t++) {
      if (t % 2 === 0) send('p0', autopilotInput(LEVEL, match.debugPlayer('p0')!.motion));
      match.advanceTick();
    }
    expect(match.isFinished()).toBe(true);
    expect(match.result().finishOrder[0]?.playerId).toBe('p0');
  });
});
