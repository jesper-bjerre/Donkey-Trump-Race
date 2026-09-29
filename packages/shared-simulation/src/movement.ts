import {
  getLadderById,
  isInsideLadderFootprint,
  type FloorSegment,
  type LadderVolume,
  type LevelMetadata,
} from '@dtr/shared-level';
import {
  CLIMB_SPEED,
  FALL_CONFIRM_DEPTH,
  GRAVITY,
  JUMP_VELOCITY,
  KNOCKBACK_DECAY,
  LANE_SPEED,
  PLAYER_RADIUS,
  RUN_SPEED,
} from './constants.js';

export interface MotionState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** External knockback velocity (from shoves), decays over time. */
  kx: number;
  kz: number;
  facing: 1 | -1;
  /** Index of the floor the player stands on, or last stood on. */
  floor: number;
  grounded: boolean;
  /** Id of the ladder being climbed. */
  climbing: string | null;
}

export interface MovementInput {
  moveX: number;
  moveZ: number;
  climb: number;
  jump: boolean;
}

export interface StepOptions {
  /** Stunned/penalised players keep physics but ignore input. */
  disabled?: boolean;
  speedMultiplier?: number;
}

export interface MovementEvents {
  jumped: boolean;
  landed: boolean;
  startedClimb: boolean;
  finishedClimb: boolean;
  fallConfirmed: boolean;
}

export const NEUTRAL_INPUT: MovementInput = Object.freeze({
  moveX: 0,
  moveZ: 0,
  climb: 0,
  jump: false,
});

const CLIMB_THRESHOLD = 0.5;
const EPSILON = 1e-6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampAxis(value: number): number {
  return Number.isFinite(value) ? clamp(value, -1, 1) : 0;
}

export function createMotionState(x: number, y: number, z: number, floor: number): MotionState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    facing: 1,
    floor,
    grounded: true,
    climbing: null,
  };
}

function floorById(level: LevelMetadata, id: string): FloorSegment {
  const floor = level.floors.find((f) => f.id === id);
  if (!floor) throw new Error(`Unknown floor ${id}`);
  return floor;
}

function covers(floor: FloorSegment, x: number): boolean {
  return x >= floor.startX && x <= floor.endX;
}

/** Ladder the player could start climbing from its current grounded position, if any. */
export function findClimbableLadder(
  level: LevelMetadata,
  state: MotionState,
  climb: number,
): LadderVolume | null {
  if (!state.grounded || state.climbing) return null;
  const floor = level.floors[state.floor];
  if (!floor) return null;
  for (const ladder of level.ladders) {
    if (!isInsideLadderFootprint(ladder, state.x, state.z)) continue;
    if (climb > CLIMB_THRESHOLD && ladder.bottomFloorId === floor.id) return ladder;
    if (climb < -CLIMB_THRESHOLD && ladder.topFloorId === floor.id) return ladder;
  }
  return null;
}

export function canJump(state: MotionState): boolean {
  return state.grounded && state.climbing === null;
}

export function applyJumpVelocity(state: MotionState): void {
  state.vy = JUMP_VELOCITY;
  state.grounded = false;
}

export function applyGravity(state: MotionState, dt: number): void {
  if (!state.grounded && state.climbing === null) state.vy -= GRAVITY * dt;
}

/** Moves a climbing player along its ladder. Returns true when the climb finished this step. */
export function applyLadderTraversal(
  level: LevelMetadata,
  state: MotionState,
  climb: number,
  dt: number,
): boolean {
  if (!state.climbing) return false;
  const ladder = getLadderById(level, state.climbing);
  const bottom = floorById(level, ladder.bottomFloorId);
  const top = floorById(level, ladder.topFloorId);
  state.vx = 0;
  state.vz = 0;
  state.vy = climb * CLIMB_SPEED;
  state.kx = 0;
  state.kz = 0;
  const snap = CLIMB_SPEED * 2 * dt;
  state.x += clamp(ladder.x - state.x, -snap, snap);
  state.z = clamp(state.z, ladder.zMin, ladder.zMax);
  state.y += state.vy * dt;
  if (climb > 0 && state.y >= top.y) {
    state.y = top.y;
    state.floor = top.index;
  } else if (climb < 0 && state.y <= bottom.y) {
    state.y = bottom.y;
    state.floor = bottom.index;
  } else {
    return false;
  }
  state.climbing = null;
  state.grounded = true;
  state.vy = 0;
  return true;
}

/** Lands a descending player on the highest floor crossed this step. */
export function resolveFloorCollision(
  level: LevelMetadata,
  state: MotionState,
  previousY: number,
): boolean {
  if (state.vy > 0) return false;
  let landing: FloorSegment | null = null;
  for (const floor of level.floors) {
    if (!covers(floor, state.x)) continue;
    if (previousY >= floor.y - EPSILON && state.y <= floor.y) {
      if (!landing || floor.y > landing.y) landing = floor;
    }
  }
  if (!landing) return false;
  state.y = landing.y;
  state.vy = 0;
  state.grounded = true;
  state.floor = landing.index;
  return true;
}

export function blockLeftWall(level: LevelMetadata, state: MotionState): void {
  const minX = level.bounds.leftWallX + PLAYER_RADIUS;
  if (state.x < minX) {
    state.x = minX;
    if (state.vx < 0) state.vx = 0;
    if (state.kx < 0) state.kx = 0;
  }
}

export function clampLanes(level: LevelMetadata, state: MotionState): void {
  const minZ = level.bounds.zMin + PLAYER_RADIUS;
  const maxZ = level.bounds.zMax - PLAYER_RADIUS;
  if (state.z < minZ || state.z > maxZ) {
    state.z = clamp(state.z, minZ, maxZ);
    state.vz = 0;
    state.kz = 0;
  }
}

export function detectRightEdgeFall(level: LevelMetadata, state: MotionState): boolean {
  if (state.grounded || state.climbing) return false;
  const lastFloor = level.floors[state.floor];
  const referenceY = lastFloor?.y ?? 0;
  return state.x > level.bounds.rightFallEdgeX && state.y < referenceY - FALL_CONFIRM_DEPTH;
}

/**
 * Advances one player by `dt` seconds. Pure with respect to its inputs apart from
 * mutating and returning a copy of `previous`; no clocks or randomness.
 */
export function stepPlayerMovement(
  previous: MotionState,
  rawInput: MovementInput,
  dt: number,
  level: LevelMetadata,
  options: StepOptions = {},
): { state: MotionState; events: MovementEvents } {
  const state: MotionState = { ...previous };
  const events: MovementEvents = {
    jumped: false,
    landed: false,
    startedClimb: false,
    finishedClimb: false,
    fallConfirmed: false,
  };
  const input: MovementInput = options.disabled
    ? NEUTRAL_INPUT
    : {
        moveX: clampAxis(rawInput.moveX),
        moveZ: clampAxis(rawInput.moveZ),
        climb: clampAxis(rawInput.climb),
        jump: rawInput.jump === true,
      };
  const speed = options.speedMultiplier ?? 1;

  if (state.climbing) {
    events.finishedClimb = applyLadderTraversal(level, state, input.climb, dt);
    return { state, events };
  }

  const ladder = findClimbableLadder(level, state, input.climb);
  if (ladder) {
    state.climbing = ladder.id;
    state.grounded = false;
    events.startedClimb = true;
    events.finishedClimb = applyLadderTraversal(level, state, input.climb, dt);
    return { state, events };
  }

  const decay = Math.exp(-KNOCKBACK_DECAY * dt);
  state.kx *= decay;
  state.kz *= decay;
  if (Math.abs(state.kx) < 0.01) state.kx = 0;
  if (Math.abs(state.kz) < 0.01) state.kz = 0;

  state.vx = input.moveX * RUN_SPEED * speed + state.kx;
  state.vz = input.moveZ * LANE_SPEED * speed + state.kz;
  if (input.moveX > 0.1) state.facing = 1;
  else if (input.moveX < -0.1) state.facing = -1;

  if (input.jump && canJump(state)) {
    applyJumpVelocity(state);
    events.jumped = true;
  }

  if (state.grounded) {
    const floor = level.floors[state.floor];
    const nextX = state.x + state.vx * dt;
    if (!floor || !covers(floor, nextX)) state.grounded = false;
  }

  applyGravity(state, dt);
  const previousY = state.y;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  if (!state.grounded) state.y += state.vy * dt;

  blockLeftWall(level, state);
  clampLanes(level, state);

  if (!state.grounded && resolveFloorCollision(level, state, previousY)) events.landed = true;
  if (detectRightEdgeFall(level, state)) events.fallConfirmed = true;

  return { state, events };
}
