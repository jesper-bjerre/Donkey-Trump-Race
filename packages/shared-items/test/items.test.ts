import { describe, expect, it } from 'vitest';
import { getPlayableBounds, MVP_VERTICAL_MAP } from '@dtr/shared-level';
import {
  getItemPickupVolumes,
  ITEM_DEFINITIONS,
  itemWeightsForRank,
  validateItemEffect,
} from '../src/index.js';

describe('item definitions', () => {
  it('has self-benefit and opponent-affecting items', () => {
    const categories = Object.values(ITEM_DEFINITIONS).map((d) => d.effect.category);
    expect(categories).toContain('selfBenefit');
    expect(categories).toContain('opponentAffecting');
  });

  it('validates effect descriptors', () => {
    for (const def of Object.values(ITEM_DEFINITIONS)) expect(validateItemEffect(def.effect)).toBe(true);
    expect(validateItemEffect({ effectType: 'TELEPORT', category: 'selfBenefit', durationMs: 1 })).toBe(false);
  });

  it('places pickup volumes inside the playable bounds', () => {
    const bounds = getPlayableBounds(MVP_VERTICAL_MAP);
    for (const v of getItemPickupVolumes(MVP_VERTICAL_MAP)) {
      expect(v.width).toBeGreaterThan(0);
      expect(v.x).toBeGreaterThan(bounds.leftWallX);
      expect(v.x).toBeLessThan(bounds.rightFallEdgeX);
    }
  });

  it('favours comeback items for trailing players', () => {
    const leader = Object.fromEntries(itemWeightsForRank(0, 5));
    const last = Object.fromEntries(itemWeightsForRank(1, 5));
    expect(leader.shield).toBeGreaterThan(last.shield!);
    expect(last.tweetStorm).toBeGreaterThan(leader.tweetStorm!);
    expect(Object.fromEntries(itemWeightsForRank(0, 1)).tweetStorm).toBe(0);
  });
});
