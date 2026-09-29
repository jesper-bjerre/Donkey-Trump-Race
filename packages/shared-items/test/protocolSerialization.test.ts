import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPlayableBounds, MVP_VERTICAL_MAP } from '@dtr/shared-level';
import { ItemBoxSnapshotSchema, PlayerSnapshotSchema } from '@dtr/shared-protocol';
import {
  intersectsPickupVolume,
  ITEM_DEFINITIONS,
  MVP_ITEM_PICKUP_VOLUMES,
  validateItemEffect,
} from '../src/index.js';
import heldItem from './fixtures/heldItem.snapshot.json' with { type: 'json' };
import opponentStun from './fixtures/opponentStun.effect.json' with { type: 'json' };
import committedVolumes from './fixtures/itemPickupVolumes.mvp.json' with { type: 'json' };
import selfSpeedBoost from './fixtures/selfSpeedBoost.effect.json' with { type: 'json' };
import serverSnapshot from '../../shared-protocol/test/fixtures/serverSnapshot.v1.json' with { type: 'json' };

describe('itemSchemas', () => {
  it('accepts the committed SELF_SPEED_BOOST and OPPONENT_STUN descriptors', () => {
    expect(validateItemEffect(selfSpeedBoost)).toBe(true);
    expect(validateItemEffect(opponentStun)).toBe(true);
    expect(selfSpeedBoost).toEqual(ITEM_DEFINITIONS.speedBoost.effect);
    expect(opponentStun).toEqual(ITEM_DEFINITIONS.tweetStorm.effect);
  });

  it('rejects unknown effectType values', () => {
    expect(validateItemEffect({ ...selfSpeedBoost, effectType: 'TELEPORT' })).toBe(false);
  });

  it('keeps effect modules free of randomness, clocks and platform imports', () => {
    for (const file of ['effects.ts', 'pickups.ts']) {
      const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/Math\.random|Date\.now|from '(ws|react|three)/);
    }
  });
});

describe('pickupVolumes', () => {
  const bounds = getPlayableBounds(MVP_VERTICAL_MAP);

  it('has positive size and sits inside the playable bounds', () => {
    expect(MVP_ITEM_PICKUP_VOLUMES.length).toBeGreaterThan(0);
    for (const v of MVP_ITEM_PICKUP_VOLUMES) {
      expect(v.width).toBeGreaterThan(0);
      expect(v.height).toBeGreaterThan(0);
      expect(v.depth).toBeGreaterThan(0);
      expect(v.x - v.width / 2).toBeGreaterThanOrEqual(bounds.leftWallX);
      expect(v.x + v.width / 2).toBeLessThanOrEqual(bounds.rightFallEdgeX);
      expect(v.z - v.depth / 2).toBeGreaterThanOrEqual(bounds.zMin);
      expect(v.z + v.depth / 2).toBeLessThanOrEqual(bounds.zMax);
    }
  });

  it('matches the committed volume fixture', () => {
    expect(JSON.parse(JSON.stringify(MVP_ITEM_PICKUP_VOLUMES))).toEqual(committedVolumes);
  });

  it('detects intersection only near the box', () => {
    const v = MVP_ITEM_PICKUP_VOLUMES[0]!;
    const floorY = v.y - 1;
    expect(intersectsPickupVolume(v, { x: v.x, y: floorY, z: v.z }, 0.45)).toBe(true);
    expect(intersectsPickupVolume(v, { x: v.x + 3, y: floorY, z: v.z }, 0.45)).toBe(false);
    expect(intersectsPickupVolume(v, { x: v.x, y: floorY + 4, z: v.z }, 0.45)).toBe(false);
  });
});

describe('protocolSerialization', () => {
  it('serializes held item and pickup state into the protocol snapshot shapes', () => {
    const player = { ...serverSnapshot.players[0], ...heldItem, itemBox: undefined };
    delete (player as { itemBox?: unknown }).itemBox;
    const roundTripped = JSON.parse(JSON.stringify(player));
    expect(PlayerSnapshotSchema.safeParse(roundTripped).success).toBe(true);
    expect(
      ItemBoxSnapshotSchema.safeParse(JSON.parse(JSON.stringify(heldItem.itemBox))).success,
    ).toBe(true);
  });
});
