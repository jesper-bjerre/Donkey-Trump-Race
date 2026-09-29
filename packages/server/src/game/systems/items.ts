import {
  getItemPickupVolumes,
  intersectsPickupVolume,
  ITEM_DEFINITIONS,
  itemWeightsForRank,
  type ItemPickupVolume,
} from '@dtr/shared-items';
import { getFloorById, type LevelMetadata } from '@dtr/shared-level';
import type { ItemBoxSnapshot } from '@dtr/shared-protocol';
import { ITEM_BOX_RESPAWN_MS, PLAYER_RADIUS, type SeededRng } from '@dtr/shared-simulation';
import type { EmitEvent, ItemBoxSim, MatchStats, PlayerSim } from '../types.js';
import { applyKnockdown, consumeShield, isActive } from './status.js';

/** Server-authoritative item boxes, awards and effects. */
export class ItemSystem {
  readonly boxes: ItemBoxSim[];
  private readonly volumes: Map<string, ItemPickupVolume>;

  constructor(
    level: LevelMetadata,
    private readonly rng: SeededRng,
  ) {
    this.volumes = new Map(getItemPickupVolumes(level).map((v) => [v.id, v]));
    this.boxes = level.itemBoxes.map((box) => ({
      id: box.id,
      x: box.x,
      y: getFloorById(level, box.floorId).y,
      z: box.z,
      active: true,
      respawnAtMs: 0,
    }));
  }

  /** `ranking` is ordered leader-first among active players. */
  resolvePickups(players: PlayerSim[], ranking: PlayerSim[], nowMs: number, emit: EmitEvent): void {
    for (const box of this.boxes) {
      if (!box.active && nowMs >= box.respawnAtMs) box.active = true;
    }
    for (const player of players) {
      if (!isActive(player) || player.heldItem !== null) continue;
      const m = player.motion;
      const box = this.boxes.find((b) => {
        const volume = this.volumes.get(b.id);
        return b.active && volume !== undefined && intersectsPickupVolume(volume, m, PLAYER_RADIUS);
      });
      if (!box) continue;
      const rank = Math.max(0, ranking.indexOf(player));
      const fraction = ranking.length > 1 ? rank / (ranking.length - 1) : 0;
      player.heldItem = this.rng.pickWeighted(itemWeightsForRank(fraction, ranking.length));
      box.active = false;
      box.respawnAtMs = nowMs + ITEM_BOX_RESPAWN_MS;
      emit({ kind: 'itemPickup', playerId: player.info.id, item: player.heldItem });
    }
  }

  useItem(
    player: PlayerSim,
    ranking: PlayerSim[],
    nowMs: number,
    emit: EmitEvent,
    stats: MatchStats,
  ): boolean {
    const item = player.heldItem;
    if (!item || !isActive(player)) return false;
    const effect = ITEM_DEFINITIONS[item].effect;
    player.heldItem = null;
    stats.itemUses++;
    switch (effect.effectType) {
      case 'SELF_SPEED_BOOST':
        player.speedBoostUntilMs = nowMs + effect.durationMs;
        emit({ kind: 'itemUse', playerId: player.info.id, item });
        break;
      case 'SELF_SHIELD':
        player.shieldUntilMs = nowMs + effect.durationMs;
        emit({ kind: 'itemUse', playerId: player.info.id, item });
        break;
      case 'OPPONENT_STUN': {
        const target = ranking.find((p) => p !== player && isActive(p));
        if (!target) {
          emit({ kind: 'itemUse', playerId: player.info.id, item });
          break;
        }
        emit({ kind: 'itemUse', playerId: player.info.id, targetId: target.info.id, item });
        if (consumeShield(target, nowMs)) {
          emit({ kind: 'shieldBlock', playerId: target.info.id, targetId: player.info.id });
        } else if (nowMs >= target.movementDisabledUntilMs) {
          applyKnockdown(target, nowMs, effect.durationMs);
        }
        break;
      }
    }
    return true;
  }

  snapshot(): ItemBoxSnapshot[] {
    return this.boxes.map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, active: b.active }));
  }
}
