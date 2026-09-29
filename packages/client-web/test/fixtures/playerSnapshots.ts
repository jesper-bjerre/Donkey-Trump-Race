import type { AuthoritativeSnapshot, PlayerSnapshot } from '@dtr/shared-protocol';

/** Deterministic player snapshot with overridable fields. */
export function player(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 'me',
    slotIndex: 0,
    nickname: 'Me',
    color: 'red',
    x: 10,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    facing: 1,
    floor: 0,
    grounded: true,
    climbing: null,
    movementDisabledUntilMs: 0,
    knockedDown: false,
    fallPenalty: false,
    falling: false,
    heldItem: null,
    speedBoostUntilMs: 0,
    shieldUntilMs: 0,
    finishRank: null,
    lastInputSeq: 0,
    inputTicksLeft: 0,
    connected: true,
    progress: 0,
    ...overrides,
  };
}

export function snapshot(tick: number, players: PlayerSnapshot[]): AuthoritativeSnapshot {
  return {
    tick,
    serverTimeMs: (tick * 1000) / 60,
    phase: 'racing',
    raceStartsAtMs: 0,
    raceEndsAtMs: null,
    players,
    barrels: [],
    itemBoxes: [],
    boss: { x: 38.5, y: 16, z: 0, throwing: false },
    finishOrder: [],
  };
}
