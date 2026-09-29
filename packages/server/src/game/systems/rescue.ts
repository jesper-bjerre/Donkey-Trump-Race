import { getFloorById, type LevelMetadata } from '@dtr/shared-level';
import { orderRescueCandidates } from '@dtr/shared-simulation';
import type { PlayerSim } from '../types.js';
import { isActive } from './status.js';

export const RescueObjective = {
  isInRescueZone(level: LevelMetadata, player: PlayerSim): boolean {
    const zone = level.rescueZone;
    const floor = getFloorById(level, zone.floorId);
    const m = player.motion;
    return m.grounded && m.floor === floor.index && m.x >= zone.minX && m.x <= zone.maxX;
  },

  /**
   * Records every player that reached Motzfeldt this tick. Same-tick arrivals are
   * ordered by slot index so results never depend on iteration order.
   */
  checkCompletion(
    level: LevelMetadata,
    players: PlayerSim[],
    tick: number,
    alreadyFinished: number,
  ): PlayerSim[] {
    const arrivals = players.filter((p) => isActive(p) && RescueObjective.isInRescueZone(level, p));
    const bySlot = new Map(arrivals.map((p) => [p.info.slotIndex, p]));
    const ranked = orderRescueCandidates(
      arrivals.map((p) => ({ playerSlot: p.info.slotIndex, serverTick: tick })),
      alreadyFinished,
    );
    return ranked.map((r) => {
      const player = bySlot.get(r.playerSlot)!;
      player.finishRank = r.rank;
      player.finishTick = r.serverTick;
      return player;
    });
  },
};
