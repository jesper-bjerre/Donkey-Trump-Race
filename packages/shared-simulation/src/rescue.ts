export interface RescueCandidate {
  playerSlot: number;
  /** Server tick on which the player was confirmed inside the rescue zone. */
  serverTick: number;
}

export interface RankedRescue extends RescueCandidate {
  rank: number;
}

/**
 * Orders rescues by server tick first and player slot second, so simultaneous
 * arrivals never depend on iteration order or client timing.
 */
export function orderRescueCandidates(
  candidates: readonly RescueCandidate[],
  alreadyFinished = 0,
): RankedRescue[] {
  return [...candidates]
    .sort((a, b) => a.serverTick - b.serverTick || a.playerSlot - b.playerSlot)
    .map((c, i) => ({ ...c, rank: alreadyFinished + i + 1 }));
}
