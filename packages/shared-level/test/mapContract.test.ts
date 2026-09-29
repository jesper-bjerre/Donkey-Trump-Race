import { describe, expect, it } from 'vitest';
import {
  getBossSpawn,
  getPlayableBounds,
  getRescueZone,
  MVP_VERTICAL_MAP,
  validateLevelMetadata,
} from '../src/index.js';
import committed from './fixtures/mvpVerticalMap.json' with { type: 'json' };

describe('mapContract', () => {
  const bounds = getPlayableBounds(MVP_VERTICAL_MAP);

  it('names the rescue zone after Motzfeldt', () => {
    expect(getRescueZone(MVP_VERTICAL_MAP).id).toBe('motzfeldt-rescue');
  });

  it('puts the boss on the right, next to the fall edge', () => {
    expect(getBossSpawn(MVP_VERTICAL_MAP).x).toBeGreaterThan(bounds.rightFallEdgeX - 2);
  });

  it('keeps the left wall at or left of every floor start', () => {
    for (const floor of MVP_VERTICAL_MAP.floors) {
      expect(bounds.leftWallX).toBeLessThanOrEqual(floor.startX);
    }
  });

  it('matches the committed serialized fixture', () => {
    expect(JSON.parse(JSON.stringify(MVP_VERTICAL_MAP))).toEqual(committed);
    expect(validateLevelMetadata(committed as typeof MVP_VERTICAL_MAP).valid).toBe(true);
  });
});
