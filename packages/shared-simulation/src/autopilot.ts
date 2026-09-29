import type { LevelMetadata } from '@dtr/shared-level';
import type { MotionState, MovementInput } from './movement.js';

/**
 * Simple route-following input used by tests and local bots: run toward the
 * ladder that leaves the current floor, line up with it, then climb.
 */
export function autopilotInput(level: LevelMetadata, state: MotionState): MovementInput {
  if (state.climbing) return { moveX: 0, moveZ: 0, climb: 1, jump: false };
  const floor = level.floors[state.floor];
  if (!floor) return { moveX: 0, moveZ: 0, climb: 0, jump: false };
  const ladder = level.ladders.find((l) => l.bottomFloorId === floor.id);
  if (!ladder) return { moveX: 0, moveZ: 0, climb: 0, jump: false };
  const dx = ladder.x - state.x;
  const targetZ = Math.min(ladder.zMax - 0.3, Math.max(ladder.zMin + 0.3, state.z));
  const dz = targetZ - state.z;
  return {
    moveX: Math.abs(dx) < 0.2 ? 0 : Math.sign(dx),
    moveZ: Math.abs(dz) < 0.1 ? 0 : Math.sign(dz),
    climb: 1,
    jump: false,
  };
}
