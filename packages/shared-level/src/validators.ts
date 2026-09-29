import type { LevelMetadata } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLevelMetadata(level: LevelMetadata): ValidationResult {
  const errors: string[] = [];
  const floorIds = new Set(level.floors.map((f) => f.id));
  const { leftWallX, rightFallEdgeX, zMin, zMax } = level.bounds;

  if (level.floors.length < 3) errors.push('level needs at least 3 floors');
  if (level.ladders.length < 2) errors.push('level needs at least 2 ladders');

  level.floors.forEach((floor, i) => {
    if (floor.index !== i) errors.push(`floor ${floor.id} index ${floor.index} != position ${i}`);
    if (floor.startX < leftWallX) errors.push(`floor ${floor.id} starts behind the left wall`);
    if (floor.endX > rightFallEdgeX) errors.push(`floor ${floor.id} extends past the fall edge`);
    if (floor.spawn.x < floor.startX || floor.spawn.x > floor.endX) {
      errors.push(`floor ${floor.id} spawn is off the floor`);
    }
    if (i > 0 && floor.y <= (level.floors[i - 1]?.y ?? -Infinity)) {
      errors.push(`floor ${floor.id} is not above the previous floor`);
    }
  });

  for (const ladder of level.ladders) {
    if (!floorIds.has(ladder.bottomFloorId)) {
      errors.push(`ladder ${ladder.id} bottomFloorId ${ladder.bottomFloorId} not found`);
    }
    if (!floorIds.has(ladder.topFloorId)) {
      errors.push(`ladder ${ladder.id} topFloorId ${ladder.topFloorId} not found`);
    }
    if (ladder.zMin < zMin || ladder.zMax > zMax || ladder.zMin >= ladder.zMax) {
      errors.push(`ladder ${ladder.id} has invalid z range`);
    }
    for (const floorId of [ladder.bottomFloorId, ladder.topFloorId]) {
      const floor = level.floors.find((f) => f.id === floorId);
      if (floor && (ladder.x < floor.startX || ladder.x > floor.endX)) {
        errors.push(`ladder ${ladder.id} is not over floor ${floorId}`);
      }
    }
  }

  if (!floorIds.has(level.rescueZone.floorId)) errors.push('rescue zone floor not found');
  if (!floorIds.has(level.bossSpawn.floorId)) errors.push('boss floor not found');
  for (const box of level.itemBoxes) {
    if (!floorIds.has(box.floorId)) errors.push(`item box ${box.id} floor not found`);
    if (box.x <= leftWallX || box.x >= rightFallEdgeX)
      errors.push(`item box ${box.id} out of bounds`);
    if (box.z < zMin || box.z > zMax) errors.push(`item box ${box.id} z out of bounds`);
  }
  if (level.playerSpawns.length < 5) errors.push('level needs 5 player spawns');

  return { valid: errors.length === 0, errors };
}
