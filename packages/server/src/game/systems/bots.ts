import type { LevelMetadata } from '@dtr/shared-level';
import {
  autopilotInput,
  BARREL_HALF_LENGTH,
  BARREL_RADIUS,
  PLAYER_RADIUS,
  RUN_SPEED,
  type MovementInput,
  type SeededRng,
} from '@dtr/shared-simulation';
import type { BarrelSim, PlayerSim } from '../types.js';

/** Barrels closer than this (seconds to contact) trigger a jump. */
const JUMP_LEAD_S = 0.2;
/** Barrels closer than this (seconds to contact) make a bot that will not jump step aside. */
const DODGE_LEAD_S = 0.7;
/** Within this distance of the next ladder the bot lines up with it instead of keeping its lane. */
const LADDER_APPROACH_X = 4;
const CONTACT_X = PLAYER_RADIUS + BARREL_RADIUS;
const CONTACT_Z = PLAYER_RADIUS + BARREL_HALF_LENGTH + 0.15;

interface BotBrain {
  /** Fraction of full run speed; below 1 so a good human can beat the bots. */
  pace: number;
  /** Chance of spotting and jumping an incoming barrel. */
  jumpSkill: number;
  /** Preferred lane (z) while running along a floor. */
  laneZ: number;
  nextLaneChangeMs: number;
  /** Per-barrel decision (jump or not), made once when the barrel is first noticed. */
  barrelPlans: Map<number, boolean>;
  itemHeldSinceMs: number | null;
  itemDelayMs: number;
}

/**
 * Drives computer players with the same inputs a human could send: follow the ladder
 * route, keep a lane, jump or sidestep barrels and use picked-up items after a short pause.
 * Uses its own seeded RNG, so a match with bots stays deterministic for a given seed.
 */
export class BotController {
  private readonly brains = new Map<string, BotBrain>();

  constructor(
    private readonly level: LevelMetadata,
    private readonly rng: SeededRng,
  ) {}

  input(player: PlayerSim, barrels: readonly BarrelSim[], nowMs: number): MovementInput {
    const brain = this.brainFor(player);
    this.planItemUse(player, brain, nowMs);
    const m = player.motion;
    if (m.climbing) return { moveX: 0, moveZ: 0, climb: 1, jump: false };

    const route = autopilotInput(this.level, m);
    if (nowMs >= brain.nextLaneChangeMs) {
      brain.laneZ = this.randomLane();
      brain.nextLaneChangeMs = nowMs + this.rng.range(2500, 7000);
    }
    const ladder = this.level.ladders.find(
      (l) => l.bottomFloorId === this.level.floors[m.floor]?.id,
    );
    const nearLadder = ladder !== undefined && Math.abs(ladder.x - m.x) < LADDER_APPROACH_X;
    let moveZ = nearLadder ? route.moveZ : laneStep(brain.laneZ - m.z);
    let jump = false;

    for (const barrel of barrels) {
      if (barrel.dropping || barrel.floor !== m.floor) continue;
      const dx = barrel.x - m.x;
      const closing = -Math.sign(dx) * (barrel.vx - route.moveX * brain.pace * RUN_SPEED);
      if (closing <= 0.1) continue;
      const ttc = (Math.abs(dx) - CONTACT_X) / closing;
      if (ttc > DODGE_LEAD_S || ttc < -0.05) continue;
      if (Math.abs(barrel.z - m.z) >= CONTACT_Z) continue;
      let plan = brain.barrelPlans.get(barrel.id);
      if (plan === undefined) {
        plan = this.rng.next() < brain.jumpSkill;
        brain.barrelPlans.set(barrel.id, plan);
      }
      if (plan) {
        if (ttc <= JUMP_LEAD_S) jump = true;
      } else {
        // Step to whichever side of the barrel is further from the lane edges.
        const side = m.z === barrel.z ? (m.z > 0 ? -1 : 1) : Math.sign(m.z - barrel.z);
        const roomy =
          side > 0 ? m.z < this.level.bounds.zMax - 1 : m.z > this.level.bounds.zMin + 1;
        moveZ = roomy ? side : -side;
      }
    }
    if (brain.barrelPlans.size > 32) {
      const live = new Set(barrels.map((b) => b.id));
      for (const id of brain.barrelPlans.keys()) if (!live.has(id)) brain.barrelPlans.delete(id);
    }

    return { moveX: route.moveX * brain.pace, moveZ, climb: route.climb, jump };
  }

  private brainFor(player: PlayerSim): BotBrain {
    let brain = this.brains.get(player.info.id);
    if (!brain) {
      brain = {
        pace: this.rng.range(0.8, 0.93),
        jumpSkill: this.rng.range(0.55, 0.85),
        laneZ: this.randomLane(),
        nextLaneChangeMs: 0,
        barrelPlans: new Map(),
        itemHeldSinceMs: null,
        itemDelayMs: 0,
      };
      this.brains.set(player.info.id, brain);
    }
    return brain;
  }

  private planItemUse(player: PlayerSim, brain: BotBrain, nowMs: number): void {
    if (player.heldItem === null) {
      brain.itemHeldSinceMs = null;
      return;
    }
    if (brain.itemHeldSinceMs === null) {
      brain.itemHeldSinceMs = nowMs;
      brain.itemDelayMs = this.rng.range(600, 3500);
    } else if (nowMs - brain.itemHeldSinceMs >= brain.itemDelayMs) {
      player.useItemRequested = true;
    }
  }

  private randomLane(): number {
    const { zMin, zMax } = this.level.bounds;
    return this.rng.range(zMin + 0.8, zMax - 0.8);
  }
}

function laneStep(dz: number): number {
  if (Math.abs(dz) < 0.15) return 0;
  return Math.max(-1, Math.min(1, dz * 1.5));
}
