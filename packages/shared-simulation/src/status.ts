import { STUN_MS } from './constants.js';

/** Minimal status fields shared by server authority and client prediction. */
export interface StatusState {
  /** Match time (ms) until which movement input is ignored. */
  movementDisabledUntilMs: number;
  knockedDown: boolean;
  shieldUntilMs: number;
}

export function isMovementDisabled(state: StatusState, nowMs: number): boolean {
  return nowMs < state.movementDisabledUntilMs;
}

export function hasActiveShield(state: StatusState, nowMs: number): boolean {
  return nowMs < state.shieldUntilMs;
}

/**
 * Applies the barrel-hit knockdown. The penalty is exactly `durationMs` of match
 * time (2000 ms by default) and is measured from the server tick of the hit.
 */
export function applyBarrelStun(
  state: StatusState,
  hitAtMs: number,
  durationMs: number = STUN_MS,
): { stunnedUntilMs: number } {
  state.movementDisabledUntilMs = hitAtMs + durationMs;
  state.knockedDown = true;
  return { stunnedUntilMs: state.movementDisabledUntilMs };
}

/** Whether a movement input issued at `atMs` is honoured. */
export function acceptsMovementInput(state: StatusState, atMs: number): boolean {
  return !isMovementDisabled(state, atMs);
}
