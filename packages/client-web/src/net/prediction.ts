import type { LevelMetadata } from '@dtr/shared-level';
import type { PlayerSnapshot } from '@dtr/shared-protocol';
import {
  stepPlayerMovement,
  TICK_DT,
  TICKS_PER_INPUT,
  type MotionState,
  type MovementInput,
} from '@dtr/shared-simulation';

/** Corrections smaller than this are smoothed; larger ones snap immediately. */
export const SNAP_THRESHOLD = 2.5;
const SMOOTHING_PER_SECOND = 12;

export interface PredictionContext {
  disabled: boolean;
  speedMultiplier: number;
}

interface PendingInput {
  seq: number;
  input: MovementInput;
}

export function motionFromSnapshot(p: PlayerSnapshot): MotionState {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    kx: p.kx,
    kz: p.kz,
    facing: p.facing,
    floor: p.floor,
    grounded: p.grounded,
    climbing: p.climbing,
  };
}

/**
 * Client-side prediction for the local player using the same pure movement step as the
 * server. On every authoritative snapshot, unacknowledged inputs are replayed on top of
 * the server state; the visual difference is smoothed out rather than snapped.
 */
export class LocalPredictor {
  state: MotionState | null = null;
  private pending: PendingInput[] = [];
  private history = new Map<number, MovementInput>();
  private seq = 0;
  /** Visual offset (predicted-before minus predicted-after correction), decays to zero. */
  private offset = { x: 0, y: 0, z: 0 };
  lastCorrectionDistance = 0;
  corrections = 0;

  constructor(private readonly level: LevelMetadata) {}

  /** Applies a new local input for one input period and returns the command to send. */
  applyInput(
    input: MovementInput,
    context: PredictionContext,
  ): { seq: number; input: MovementInput } | null {
    if (!this.state) return null;
    const seq = ++this.seq;
    this.pending.push({ seq, input });
    this.history.set(seq, input);
    if (this.history.size > 240) this.history.delete(seq - 240);
    this.state = this.simulate(this.state, input, TICKS_PER_INPUT, context);
    return { seq, input };
  }

  reconcile(server: PlayerSnapshot, context: PredictionContext): void {
    const authoritative = motionFromSnapshot(server);
    if (!this.state) {
      this.state = authoritative;
      this.seq = Math.max(this.seq, server.lastInputSeq);
      return;
    }
    this.pending = this.pending.filter((p) => p.seq > server.lastInputSeq);
    let replayed = authoritative;
    const acked = this.history.get(server.lastInputSeq);
    if (acked && server.inputTicksLeft > 0) {
      replayed = this.simulate(replayed, acked, server.inputTicksLeft, context);
    }
    for (const pending of this.pending)
      replayed = this.simulate(replayed, pending.input, TICKS_PER_INPUT, context);

    const dx = this.state.x - replayed.x;
    const dy = this.state.y - replayed.y;
    const dz = this.state.z - replayed.z;
    const distance = Math.hypot(dx, dy, dz);
    this.lastCorrectionDistance = distance;
    if (distance > 0.05) this.corrections++;
    if (distance > SNAP_THRESHOLD) {
      this.offset = { x: 0, y: 0, z: 0 };
    } else {
      this.offset = { x: this.offset.x + dx, y: this.offset.y + dy, z: this.offset.z + dz };
    }
    this.state = replayed;
  }

  /** Hard reset, e.g. after a respawn or when prediction is not applicable. */
  reset(server: PlayerSnapshot): void {
    this.state = motionFromSnapshot(server);
    this.pending = [];
    this.offset = { x: 0, y: 0, z: 0 };
  }

  /** Smoothed render position. */
  renderPosition(dtSeconds: number): { x: number; y: number; z: number } | null {
    if (!this.state) return null;
    const decay = Math.exp(-SMOOTHING_PER_SECOND * dtSeconds);
    this.offset.x *= decay;
    this.offset.y *= decay;
    this.offset.z *= decay;
    return {
      x: this.state.x + this.offset.x,
      y: this.state.y + this.offset.y,
      z: this.state.z + this.offset.z,
    };
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  private simulate(
    start: MotionState,
    input: MovementInput,
    ticks: number,
    context: PredictionContext,
  ): MotionState {
    let state = start;
    for (let i = 0; i < ticks; i++) {
      state = stepPlayerMovement(state, input, TICK_DT, this.level, {
        disabled: context.disabled,
        speedMultiplier: context.speedMultiplier,
      }).state;
    }
    return state;
  }
}
