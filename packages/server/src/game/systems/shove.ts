import {
  PLAYER_RADIUS,
  RUN_SPEED,
  SHOVE_MIN_CLOSING_SPEED,
  SHOVE_PAIR_COOLDOWN_MS,
  SHOVE_STRENGTH,
} from '@dtr/shared-simulation';
import type { EmitEvent, PlayerSim } from '../types.js';
import { consumeShield, isActive } from './status.js';

export interface ShoveResult {
  pairsEvaluated: number;
  shoves: number;
}

/**
 * Resolves player-vs-player contacts: overlapping players are separated and the
 * player moving into the other imparts a knockback impulse (the "shove").
 */
export class PlayerShoveSystem {
  private readonly cooldowns = new Map<string, number>();

  resolveSideImpacts(players: PlayerSim[], nowMs: number, emit: EmitEvent): ShoveResult {
    let pairsEvaluated = 0;
    let shoves = 0;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i]!;
        const b = players[j]!;
        pairsEvaluated++;
        if (!isActive(a) || !isActive(b)) continue;
        if (a.motion.climbing || b.motion.climbing) continue;
        if (Math.abs(a.motion.y - b.motion.y) > 1) continue;
        const dx = b.motion.x - a.motion.x;
        const dz = b.motion.z - a.motion.z;
        const dist = Math.hypot(dx, dz);
        const minDist = PLAYER_RADIUS * 2;
        if (dist >= minDist) continue;
        const nx = dist > 1e-6 ? dx / dist : 0;
        const nz = dist > 1e-6 ? dz / dist : 1;

        // Separate so capsules don't interpenetrate.
        const push = (minDist - dist) / 2;
        a.motion.x -= nx * push;
        a.motion.z -= nz * push;
        b.motion.x += nx * push;
        b.motion.z += nz * push;

        const key = a.info.id < b.info.id ? `${a.info.id}|${b.info.id}` : `${b.info.id}|${a.info.id}`;
        if ((this.cooldowns.get(key) ?? -Infinity) > nowMs) continue;

        // Only self-propelled velocity counts; knockback does not chain.
        const aSpeed = (a.motion.vx - a.motion.kx) * nx + (a.motion.vz - a.motion.kz) * nz;
        const bSpeed = -((b.motion.vx - b.motion.kx) * nx + (b.motion.vz - b.motion.kz) * nz);
        const closing = aSpeed + bSpeed;
        if (closing < SHOVE_MIN_CLOSING_SPEED) continue;

        const [shover, target, sign] = aSpeed >= bSpeed ? [a, b, 1] : [b, a, -1];
        this.cooldowns.set(key, nowMs + SHOVE_PAIR_COOLDOWN_MS);
        if (consumeShield(target, nowMs)) {
          emit({ kind: 'shieldBlock', playerId: target.info.id, targetId: shover.info.id });
          continue;
        }
        const strength = SHOVE_STRENGTH * Math.min(1, Math.max(0.4, closing / RUN_SPEED));
        target.motion.kx += nx * sign * strength;
        target.motion.kz += nz * sign * strength;
        shoves++;
        emit({ kind: 'shove', playerId: shover.info.id, targetId: target.info.id });
      }
    }
    return { pairsEvaluated, shoves };
  }
}
