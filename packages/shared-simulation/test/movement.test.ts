import { describe, expect, it } from 'vitest';
import { getPlayableBounds, MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import {
  autopilotInput,
  createMotionState,
  JUMP_APEX,
  NEUTRAL_INPUT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  stepPlayerMovement,
  TICK_DT,
  type MotionState,
  type MovementEvents,
  type MovementInput,
} from '../src/index.js';

function run(
  start: MotionState,
  input: MovementInput | ((s: MotionState) => MovementInput),
  ticks: number,
  onStep?: (s: MotionState, e: MovementEvents) => void,
): MotionState {
  let state = start;
  for (let i = 0; i < ticks; i++) {
    const cmd = typeof input === 'function' ? input(state) : input;
    const result = stepPlayerMovement(state, cmd, TICK_DT, LEVEL);
    state = result.state;
    onStep?.(state, result.events);
  }
  return state;
}

const input = (partial: Partial<MovementInput>): MovementInput => ({
  ...NEUTRAL_INPUT,
  ...partial,
});

describe('half-height jump', () => {
  it('cannot reach the next floor from a standing jump', () => {
    let maxY = 0;
    const end = run(createMotionState(10, 0, 0, 0), input({ jump: true }), 40, (s) => {
      maxY = Math.max(maxY, s.y);
    });
    expect(maxY).toBeGreaterThan(JUMP_APEX * 0.95);
    expect(maxY).toBeLessThanOrEqual(JUMP_APEX + 1e-6);
    expect(maxY + PLAYER_HEIGHT).toBeLessThan(LEVEL.floors[1]!.y);
    expect(end.floor).toBe(0);
  });

  it('lands back on the same floor', () => {
    const end = run(createMotionState(10, 0, 0, 0), input({ jump: true }), 1);
    const landed = run(end, NEUTRAL_INPUT, 60);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(0);
  });
});

describe('ladder traversal', () => {
  it('climbs only when inside a ladder volume', () => {
    const outside = run(createMotionState(30, 0, 0, 0), input({ climb: 1 }), 120);
    expect(outside.y).toBe(0);
    expect(outside.climbing).toBeNull();

    const wrongLane = run(createMotionState(36, 0, 2.2, 0), input({ climb: 1 }), 120);
    expect(wrongLane.y).toBe(0);
  });

  it('climbs from floor 0 to floor 1 and down again', () => {
    const up = run(createMotionState(36, 0, 0, 0), input({ climb: 1 }), 120);
    expect(up.floor).toBe(1);
    expect(up.y).toBe(LEVEL.floors[1]!.y);
    expect(up.grounded).toBe(true);

    const down = run(up, input({ climb: -1 }), 120);
    expect(down.floor).toBe(0);
    expect(down.y).toBe(0);
  });

  it('does not move while stunned on the ladder', () => {
    const climbing = run(createMotionState(36, 0, 0, 0), input({ climb: 1 }), 20);
    const frozen = stepPlayerMovement(climbing, input({ climb: 1 }), TICK_DT, LEVEL, {
      disabled: true,
    }).state;
    expect(frozen.y).toBe(climbing.y);
  });
});

describe('bounds', () => {
  it('blocks the left wall', () => {
    const end = run(createMotionState(2, 0, 0, 0), input({ moveX: -1 }), 120);
    expect(end.x).toBe(getPlayableBounds(LEVEL).leftWallX + PLAYER_RADIUS);
  });

  it('clamps lanes to the floor width', () => {
    const end = run(createMotionState(10, 0, 0, 0), input({ moveZ: 1 }), 120);
    expect(end.z).toBe(getPlayableBounds(LEVEL).zMax - PLAYER_RADIUS);
  });

  it('detects falling off the right edge', () => {
    let fell = false;
    run(createMotionState(38, 0, 0, 0), input({ moveX: 1 }), 120, (_s, e) => {
      fell ||= e.fallConfirmed;
    });
    expect(fell).toBe(true);
  });

  it('dropping off the small rescue platform lands on the floor below without a fall penalty', () => {
    let fell = false;
    let tick = 0;
    const walkOff = () => (tick++ < 20 ? input({ moveX: 1 }) : NEUTRAL_INPUT);
    const end = run(createMotionState(33, 20, 0, 5), walkOff, 90, (_s, e) => {
      fell ||= e.fallConfirmed;
    });
    expect(fell).toBe(false);
    expect(end.floor).toBe(4);
    expect(end.grounded).toBe(true);
  });
});

describe('determinism', () => {
  it('replays the same inputs to identical states', () => {
    const script = (s: MotionState) => autopilotInput(LEVEL, s);
    const a = run(createMotionState(2, 0, -2, 0), script, 600);
    const b = run(createMotionState(2, 0, -2, 0), script, 600);
    expect(a).toEqual(b);
  });

  it('the autopilot route reaches the rescue platform', () => {
    const end = run(createMotionState(2, 0, -2, 0), (s) => autopilotInput(LEVEL, s), 60 * 60);
    expect(end.floor).toBe(LEVEL.floors.length - 1);
  });

  it('ignores all input while disabled', () => {
    const start = createMotionState(10, 0, 0, 0);
    const end = stepPlayerMovement(start, input({ moveX: 1, jump: true }), TICK_DT, LEVEL, {
      disabled: true,
    });
    expect(end.state.x).toBe(10);
    expect(end.state.grounded).toBe(true);
  });
});
