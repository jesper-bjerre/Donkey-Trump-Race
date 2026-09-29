import type { LevelMetadata } from '@dtr/shared-level';
import { createMotionState, FALL_PENALTY_MS } from '@dtr/shared-simulation';
import type { PlayerSim } from '../types.js';

const KILL_Y = -30;

export const FallRespawnSystem = {
  /** True once a player has dropped off the right edge (or out of the world entirely). */
  detectFall(level: LevelMetadata, player: PlayerSim, fallConfirmed: boolean): boolean {
    return fallConfirmed || player.motion.y < KILL_Y || player.motion.x > level.bounds.rightFallEdgeX + 20;
  },

  /** Respawns at the safe spawn of the floor the player fell from and applies the delay penalty. */
  applyRespawn(level: LevelMetadata, player: PlayerSim, nowMs: number): void {
    const floor = level.floors[player.motion.floor] ?? level.floors[0]!;
    const z = Math.max(level.bounds.zMin + 0.5, Math.min(level.bounds.zMax - 0.5, floor.spawn.z));
    player.motion = createMotionState(floor.spawn.x, floor.y, z, floor.index);
    player.motion.facing = floor.runDirection;
    player.movementDisabledUntilMs = nowMs + FALL_PENALTY_MS;
    player.fallPenalty = true;
    player.knockedDown = false;
    player.falling = false;
  },
};
