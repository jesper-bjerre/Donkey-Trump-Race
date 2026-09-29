import type {
  BossSpawn,
  FloorSegment,
  LadderVolume,
  LevelMetadata,
  PlayableBounds,
  RescueZone,
} from './types.js';

export const FLOOR_SPACING = 4;

export function getPlayableBounds(level: LevelMetadata): PlayableBounds {
  return level.bounds;
}

export function getRescueZone(level: LevelMetadata): RescueZone {
  return level.rescueZone;
}

export function getBossSpawn(level: LevelMetadata): BossSpawn {
  return level.bossSpawn;
}

export function getFloorById(level: LevelMetadata, id: string): FloorSegment {
  const floor = level.floors.find((f) => f.id === id);
  if (!floor) throw new Error(`Unknown floor ${id}`);
  return floor;
}

export function getFloorByIndex(level: LevelMetadata, index: number): FloorSegment {
  const floor = level.floors[index];
  if (!floor || floor.index !== index) throw new Error(`Unknown floor index ${index}`);
  return floor;
}

export function getLadderById(level: LevelMetadata, id: string): LadderVolume {
  const ladder = level.ladders.find((l) => l.id === id);
  if (!ladder) throw new Error(`Unknown ladder ${id}`);
  return ladder;
}

export function isInsideLadderFootprint(ladder: LadderVolume, x: number, z: number): boolean {
  return Math.abs(x - ladder.x) <= ladder.width / 2 && z >= ladder.zMin && z <= ladder.zMax;
}

/** Floor that barrels land on when leaving `floorIndex` (the next lower barrel floor). */
export function getFloorBelow(level: LevelMetadata, floorIndex: number): FloorSegment | null {
  if (floorIndex <= 0) return null;
  return level.floors[floorIndex - 1] ?? null;
}

/** Scalar race progress used for ranking and item weighting. Higher = closer to Motzfeldt. */
export function computeProgress(level: LevelMetadata, floorIndex: number, x: number): number {
  const floor = level.floors[floorIndex];
  if (!floor) return 0;
  const width = level.bounds.rightFallEdgeX - level.bounds.leftWallX;
  const along =
    floor.runDirection > 0 ? x - level.bounds.leftWallX : level.bounds.rightFallEdgeX - x;
  return floorIndex * width + Math.max(0, Math.min(width, along));
}
