import { describe, expect, it } from 'vitest';
import {
  computeProgress,
  FLOOR_SPACING,
  getBossSpawn,
  getPlayableBounds,
  getRescueZone,
  MVP_VERTICAL_MAP,
  validateLevelMetadata,
  type LevelMetadata,
} from '../src/index.js';

describe('MVP vertical map', () => {
  it('passes validation', () => {
    expect(validateLevelMetadata(MVP_VERTICAL_MAP)).toEqual({ valid: true, errors: [] });
  });

  it('has enough floors and ladders connecting valid floors', () => {
    const floorIds = new Set(MVP_VERTICAL_MAP.floors.map((f) => f.id));
    expect(MVP_VERTICAL_MAP.floors.length).toBeGreaterThanOrEqual(3);
    expect(MVP_VERTICAL_MAP.ladders.length).toBeGreaterThanOrEqual(2);
    for (const ladder of MVP_VERTICAL_MAP.ladders) {
      expect(floorIds.has(ladder.bottomFloorId)).toBe(true);
      expect(floorIds.has(ladder.topFloorId)).toBe(true);
    }
  });

  it('spaces floors a full floor apart so jumping cannot skip ladders', () => {
    MVP_VERTICAL_MAP.floors.slice(1).forEach((floor, i) => {
      expect(floor.y - (MVP_VERTICAL_MAP.floors[i]?.y ?? 0)).toBe(FLOOR_SPACING);
    });
  });

  it('places Motzfeldt on top and the boss far right', () => {
    const rescue = getRescueZone(MVP_VERTICAL_MAP);
    const bounds = getPlayableBounds(MVP_VERTICAL_MAP);
    expect(rescue.id).toBe('motzfeldt-rescue');
    expect(rescue.floorId).toBe(MVP_VERTICAL_MAP.floors.at(-1)?.id);
    expect(getBossSpawn(MVP_VERTICAL_MAP).x).toBeGreaterThan(bounds.rightFallEdgeX - 2);
    for (const floor of MVP_VERTICAL_MAP.floors) {
      expect(bounds.leftWallX).toBeLessThanOrEqual(floor.startX);
    }
  });

  it('starts players between the left wall and the right fall edge', () => {
    const bounds = getPlayableBounds(MVP_VERTICAL_MAP);
    for (const spawn of MVP_VERTICAL_MAP.playerSpawns) {
      expect(spawn.x).toBeGreaterThan(bounds.leftWallX);
      expect(spawn.x).toBeLessThan(bounds.rightFallEdgeX);
    }
  });

  it('rejects a ladder pointing to a missing floor', () => {
    const broken: LevelMetadata = {
      ...MVP_VERTICAL_MAP,
      ladders: [
        ...MVP_VERTICAL_MAP.ladders,
        { ...MVP_VERTICAL_MAP.ladders[0]!, id: 'bad', topFloorId: 'nope' },
      ],
    };
    const result = validateLevelMetadata(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toMatch(/topFloorId nope/);
  });

  it('increases progress along the zigzag route', () => {
    expect(computeProgress(MVP_VERTICAL_MAP, 0, 30)).toBeGreaterThan(
      computeProgress(MVP_VERTICAL_MAP, 0, 10),
    );
    expect(computeProgress(MVP_VERTICAL_MAP, 1, 30)).toBeGreaterThan(
      computeProgress(MVP_VERTICAL_MAP, 0, 39),
    );
    expect(computeProgress(MVP_VERTICAL_MAP, 1, 10)).toBeGreaterThan(
      computeProgress(MVP_VERTICAL_MAP, 1, 30),
    );
  });
});
