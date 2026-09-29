/**
 * Deterministic replay harness for the committed shared-simulation fixtures.
 * Plain JSON in, plain JSON out: no clocks, no randomness beyond the seeded RNG,
 * no sockets or server modules, so CI and client/server code replay identically.
 */
import {
  intersectsPickupVolume,
  itemWeightsForRank,
  MVP_ITEM_PICKUP_VOLUMES,
} from '@dtr/shared-items';
import { MVP_VERTICAL_MAP } from '@dtr/shared-level';
import {
  acceptsMovementInput,
  applyBarrelStun,
  createMotionState,
  orderRescueCandidates,
  PLAYER_RADIUS,
  SeededRng,
  stepPlayerMovement,
  TICK_DT,
  type MotionState,
  type MovementInput,
  type RankedRescue,
  type RescueCandidate,
  type StatusState,
} from '../../src/index.js';
import barrelStun from './barrelStun.json' with { type: 'json' };
import halfHeightJump from './halfHeightJump.json' with { type: 'json' };
import itemPickup from './itemPickup.json' with { type: 'json' };
import ladderTraversal from './ladderTraversal.json' with { type: 'json' };
import leftWallBlock from './leftWallBlock.json' with { type: 'json' };
import rescueOrdering from './rescueOrdering.json' with { type: 'json' };
import rightEdgeFall from './rightEdgeFall.json' with { type: 'json' };
import verticalTraversal from './verticalTraversal.json' with { type: 'json' };

export interface MovementFixture {
  name: string;
  start: { x: number; y: number; z: number; floor: number };
  steps: Array<{ ticks: number; input: MovementInput }>;
}

type EventCounts = {
  jumped: number;
  landed: number;
  startedClimb: number;
  finishedClimb: number;
  fallConfirmed: number;
};

export interface MovementReplay {
  finalState: MotionState;
  ticks: number;
  maxY: number;
  events: EventCounts;
  firstFallTick: number | null;
}

/** Rounds away sub-micrometre float noise so committed JSON stays readable and stable. */
function round(value: number): number {
  const r = Math.round(value * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

function roundState(state: MotionState): MotionState {
  const out = { ...state };
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'kx', 'kz'] as const) {
    out[key] = round(out[key]);
  }
  return out;
}

export function replayMovementFixture(
  fixture: MovementFixture,
  onTick?: (state: MotionState, tick: number) => void,
): MovementReplay {
  const { start } = fixture;
  let state = createMotionState(start.x, start.y, start.z, start.floor);
  const events: EventCounts = {
    jumped: 0,
    landed: 0,
    startedClimb: 0,
    finishedClimb: 0,
    fallConfirmed: 0,
  };
  let maxY = state.y;
  let tick = 0;
  let firstFallTick: number | null = null;
  for (const step of fixture.steps) {
    for (let i = 0; i < step.ticks; i++) {
      const result = stepPlayerMovement(state, step.input, TICK_DT, MVP_VERTICAL_MAP);
      state = result.state;
      tick++;
      maxY = Math.max(maxY, state.y);
      for (const key of Object.keys(events) as Array<keyof EventCounts>) {
        if (result.events[key]) events[key]++;
      }
      if (result.events.fallConfirmed && firstFallTick === null) firstFallTick = tick;
      onTick?.(state, tick);
    }
  }
  return { finalState: roundState(state), ticks: tick, maxY: round(maxY), events, firstFallTick };
}

export interface ItemPickupReplay {
  volumeId: string | null;
  serverTick: number | null;
  heldItem: string | null;
}

export function replayItemPickupFixture(fixture: typeof itemPickup): ItemPickupReplay {
  let hit: { volumeId: string; serverTick: number } | null = null;
  replayMovementFixture(fixture, (state, tick) => {
    if (hit) return;
    const volume = MVP_ITEM_PICKUP_VOLUMES.find((v) =>
      intersectsPickupVolume(v, state, PLAYER_RADIUS),
    );
    if (volume) hit = { volumeId: volume.id, serverTick: tick };
  });
  const found = hit as { volumeId: string; serverTick: number } | null;
  if (!found) return { volumeId: null, serverTick: null, heldItem: null };
  const fraction = fixture.playerCount > 1 ? fixture.rankIndex / (fixture.playerCount - 1) : 0;
  const heldItem = new SeededRng(fixture.rngSeed).pickWeighted(
    itemWeightsForRank(fraction, fixture.playerCount),
  );
  return { ...found, heldItem };
}

export interface BarrelStunReplay {
  hitAtMs: number;
  stunnedUntilMs: number;
  inputs: Array<{ atMs: number; accepted: boolean }>;
}

export function replayBarrelStunFixture(fixture: typeof barrelStun): BarrelStunReplay {
  const status: StatusState = { movementDisabledUntilMs: 0, knockedDown: false, shieldUntilMs: 0 };
  const { stunnedUntilMs } = applyBarrelStun(status, fixture.hitAtMs);
  return {
    hitAtMs: fixture.hitAtMs,
    stunnedUntilMs,
    inputs: fixture.inputAtMs.map((atMs) => ({
      atMs,
      accepted: acceptsMovementInput(status, atMs),
    })),
  };
}

export function replayRescueOrderingFixture(fixture: {
  alreadyFinished: number;
  candidates: RescueCandidate[];
}): RankedRescue[] {
  return orderRescueCandidates(fixture.candidates, fixture.alreadyFinished);
}

export const MOVEMENT_FIXTURES: Record<string, MovementFixture> = {
  halfHeightJump,
  ladderTraversal,
  leftWallBlock,
  rightEdgeFall,
  verticalTraversal,
};

export const FIXTURES = { itemPickup, barrelStun, rescueOrdering };

/** Replays every fixture; used by the tests and by `pnpm fixtures:regenerate`. */
export function buildSimulationFixtures(): { expected: Record<string, unknown> } {
  const expected: Record<string, unknown> = {};
  for (const [name, fixture] of Object.entries(MOVEMENT_FIXTURES)) {
    expected[name] = replayMovementFixture(fixture);
  }
  expected.itemPickup = replayItemPickupFixture(itemPickup);
  expected.barrelStun = replayBarrelStunFixture(barrelStun);
  expected.rescueOrdering = replayRescueOrderingFixture(rescueOrdering);
  return { expected };
}
