import { applyBarrelStun, hasActiveShield, isMovementDisabled } from '@dtr/shared-simulation';
import type { PlayerSim } from '../types.js';

export function isDisabled(player: PlayerSim, nowMs: number): boolean {
  return isMovementDisabled(player, nowMs);
}

export function hasShield(player: PlayerSim, nowMs: number): boolean {
  return hasActiveShield(player, nowMs);
}

/** Consumes an active shield. Returns true if the hit was blocked. */
export function consumeShield(player: PlayerSim, nowMs: number): boolean {
  if (!hasShield(player, nowMs)) return false;
  player.shieldUntilMs = 0;
  return true;
}

/** Knocks a player down for `durationMs` of match time; stunned players are immune to re-stun. */
export function applyKnockdown(player: PlayerSim, nowMs: number, durationMs: number): void {
  applyBarrelStun(player, nowMs, durationMs);
  player.motion.vx = 0;
  player.motion.vz = 0;
  player.motion.kx = 0;
  player.motion.kz = 0;
}

export function isActive(player: PlayerSim): boolean {
  return !player.removed && player.finishRank === null;
}
