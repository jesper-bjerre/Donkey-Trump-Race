import { getFloorById, type LevelMetadata } from '@dtr/shared-level';
import type { BarrelSnapshot, BossSnapshot } from '@dtr/shared-protocol';
import {
  BARREL_GRAVITY,
  BARREL_HALF_LENGTH,
  BARREL_LADDER_DROP_CHANCE,
  BARREL_MAX_ACTIVE,
  BARREL_RADIUS,
  BARREL_SPEED,
  BOSS_FIRST_THROW_DELAY_MS,
  BOSS_THROW_INTERVAL_MS,
  BOSS_THROW_JITTER_MS,
  BOSS_THROW_WINDUP_MS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  STUN_MS,
  type SeededRng,
} from '@dtr/shared-simulation';
import type { BarrelSim, EmitEvent, MatchStats, PlayerSim } from '../types.js';
import { applyKnockdown, consumeShield, isActive, isDisabled } from './status.js';

const BARREL_LANES = [-2, -1, 0, 1, 2];

export interface BossState {
  x: number;
  y: number;
  z: number;
  floor: number;
}

/** Computer-controlled boss: stands far right on the top floor and throws barrels on a timer. */
export class BossBarrelSystem {
  readonly boss: BossState;
  readonly barrels: BarrelSim[] = [];
  private nextThrowAtMs: number;
  private nextBarrelId = 1;

  constructor(
    private readonly level: LevelMetadata,
    private readonly rng: SeededRng,
    raceStartsAtMs: number,
  ) {
    const floor = getFloorById(level, level.bossSpawn.floorId);
    this.boss = { x: level.bossSpawn.x, y: floor.y, z: level.bossSpawn.z, floor: floor.index };
    this.nextThrowAtMs = raceStartsAtMs + BOSS_FIRST_THROW_DELAY_MS;
  }

  isThrowing(nowMs: number): boolean {
    return nowMs >= this.nextThrowAtMs - BOSS_THROW_WINDUP_MS;
  }

  advanceTick(nowMs: number, dt: number): void {
    if (nowMs >= this.nextThrowAtMs) {
      if (this.barrels.length < BARREL_MAX_ACTIVE) this.spawnBarrel();
      this.nextThrowAtMs +=
        BOSS_THROW_INTERVAL_MS + this.rng.range(-BOSS_THROW_JITTER_MS, BOSS_THROW_JITTER_MS);
    }
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      if (!this.moveBarrel(this.barrels[i]!, dt)) this.barrels.splice(i, 1);
    }
  }

  /** Stuns every active player touched by a barrel. Stunned players are immune until they recover. */
  resolveHits(players: PlayerSim[], nowMs: number, emit: EmitEvent, stats: MatchStats): void {
    for (const player of players) {
      if (!isActive(player) || isDisabled(player, nowMs)) continue;
      const hitIndex = this.barrels.findIndex((b) => barrelTouchesPlayer(b, player));
      if (hitIndex < 0) continue;
      if (consumeShield(player, nowMs)) {
        this.barrels.splice(hitIndex, 1);
        emit({ kind: 'shieldBlock', playerId: player.info.id });
        continue;
      }
      applyKnockdown(player, nowMs, STUN_MS);
      stats.barrelHits++;
      emit({ kind: 'barrelHit', playerId: player.info.id });
    }
  }

  snapshotBoss(nowMs: number): BossSnapshot {
    return { x: this.boss.x, y: this.boss.y, z: this.boss.z, throwing: this.isThrowing(nowMs) };
  }

  snapshotBarrels(): BarrelSnapshot[] {
    return this.barrels.map((b) => ({
      id: b.id,
      x: round(b.x),
      y: round(b.y),
      z: round(b.z),
      vx: round(b.vx),
      vy: round(b.vy),
      dropping: b.dropping,
    }));
  }

  /** Test hook: place a barrel directly. */
  spawnBarrelAt(x: number, floor: number, z: number, vx: number): BarrelSim {
    const floorSeg = this.level.floors[floor]!;
    const barrel: BarrelSim = {
      id: this.nextBarrelId++,
      x,
      y: floorSeg.y,
      z,
      vx,
      vy: 0,
      floor,
      dropping: false,
      targetFloor: floor,
      ladderDecisions: new Set(),
    };
    this.barrels.push(barrel);
    return barrel;
  }

  private spawnBarrel(): void {
    const floor = this.level.floors[this.boss.floor]!;
    const lane = BARREL_LANES[this.rng.int(0, BARREL_LANES.length - 1)] ?? 0;
    this.spawnBarrelAt(this.boss.x - 1.2, floor.index, lane, BARREL_SPEED * floor.barrelDirection);
  }

  /** Returns false when the barrel should be removed. */
  private moveBarrel(barrel: BarrelSim, dt: number): boolean {
    if (barrel.dropping) {
      barrel.vy -= BARREL_GRAVITY * dt;
      barrel.y += barrel.vy * dt;
      const target = this.level.floors[barrel.targetFloor]!;
      if (barrel.y > target.y) return true;
      barrel.y = target.y;
      barrel.vy = 0;
      barrel.floor = target.index;
      barrel.dropping = false;
      barrel.vx = BARREL_SPEED * target.barrelDirection;
      return target.barrelDirection !== 0;
    }

    const floor = this.level.floors[barrel.floor]!;
    const prevX = barrel.x;
    barrel.x += barrel.vx * dt;

    for (const ladder of this.level.ladders) {
      if (ladder.topFloorId !== floor.id || barrel.ladderDecisions.has(ladder.id)) continue;
      const crossed = (prevX - ladder.x) * (barrel.x - ladder.x) <= 0;
      if (!crossed || barrel.z < ladder.zMin || barrel.z > ladder.zMax) continue;
      barrel.ladderDecisions.add(ladder.id);
      if (this.rng.next() < BARREL_LADDER_DROP_CHANCE) {
        this.startDrop(barrel, ladder.x, getFloorById(this.level, ladder.bottomFloorId).index);
        return true;
      }
    }

    const atEnd =
      (barrel.vx < 0 && barrel.x <= Math.max(floor.startX + 1, this.level.barrelSinkX)) ||
      (barrel.vx > 0 && barrel.x >= floor.endX - 1);
    if (!atEnd) return true;
    if (floor.index === 0) return false; // rolled into the oil drum
    this.startDrop(barrel, barrel.x, floor.index - 1);
    return true;
  }

  private startDrop(barrel: BarrelSim, x: number, targetFloor: number): void {
    barrel.x = x;
    barrel.vx = 0;
    barrel.vy = 0;
    barrel.dropping = true;
    barrel.targetFloor = targetFloor;
    barrel.ladderDecisions.clear();
  }
}

export function barrelTouchesPlayer(barrel: BarrelSim, player: PlayerSim): boolean {
  const m = player.motion;
  if (Math.abs(m.x - barrel.x) >= PLAYER_RADIUS + BARREL_RADIUS) return false;
  if (Math.abs(m.z - barrel.z) >= PLAYER_RADIUS + BARREL_HALF_LENGTH) return false;
  // Players whose feet clear the top of the barrel (a well-timed jump) are safe.
  const barrelTop = barrel.y + BARREL_RADIUS * 2;
  return m.y < barrelTop - 0.15 && m.y + PLAYER_HEIGHT > barrel.y;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
