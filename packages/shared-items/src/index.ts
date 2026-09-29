import { ITEM_TYPES, type ItemType } from '@dtr/shared-protocol';
import type { LevelMetadata } from '@dtr/shared-level';

export type ItemEffect =
  | {
      effectType: 'SELF_SPEED_BOOST';
      category: 'selfBenefit';
      multiplier: number;
      durationMs: number;
    }
  | { effectType: 'SELF_SHIELD'; category: 'selfBenefit'; durationMs: number }
  | {
      effectType: 'OPPONENT_STUN';
      category: 'opponentAffecting';
      target: 'leader';
      durationMs: number;
    };

export interface ItemDefinition {
  type: ItemType;
  displayName: string;
  description: string;
  icon: string;
  effect: ItemEffect;
}

export const ITEM_DEFINITIONS: Record<ItemType, ItemDefinition> = {
  speedBoost: {
    type: 'speedBoost',
    displayName: 'Kaffe Boost',
    description: 'Run 50% faster for 3 seconds.',
    icon: '☕',
    effect: {
      effectType: 'SELF_SPEED_BOOST',
      category: 'selfBenefit',
      multiplier: 1.5,
      durationMs: 3000,
    },
  },
  shield: {
    type: 'shield',
    displayName: 'Diplomatic Shield',
    description: 'Blocks the next barrel, shove or tweet for up to 6 seconds.',
    icon: '🛡️',
    effect: { effectType: 'SELF_SHIELD', category: 'selfBenefit', durationMs: 6000 },
  },
  tweetStorm: {
    type: 'tweetStorm',
    displayName: 'Tweet Storm',
    description: 'Stuns the player furthest ahead for 1.5 seconds.',
    icon: '🌪️',
    effect: {
      effectType: 'OPPONENT_STUN',
      category: 'opponentAffecting',
      target: 'leader',
      durationMs: 1500,
    },
  },
};

export const ITEM_EFFECT_TYPES = ['SELF_SPEED_BOOST', 'SELF_SHIELD', 'OPPONENT_STUN'] as const;

export function validateItemEffect(value: unknown): value is ItemEffect {
  if (typeof value !== 'object' || value === null) return false;
  const effect = value as Record<string, unknown>;
  if (!(ITEM_EFFECT_TYPES as readonly unknown[]).includes(effect.effectType)) return false;
  if (typeof effect.durationMs !== 'number' || effect.durationMs <= 0) return false;
  return effect.category === 'selfBenefit' || effect.category === 'opponentAffecting';
}

/**
 * Comeback weighting: `rankFraction` is 0 for the leader and 1 for last place.
 * Leaders mostly get shields; trailing players get boosts and tweet storms.
 */
export function itemWeightsForRank(
  rankFraction: number,
  playerCount: number,
): Array<[ItemType, number]> {
  const r = Math.min(1, Math.max(0, rankFraction));
  const weights: Record<ItemType, number> = {
    speedBoost: 1 + 2 * r,
    shield: 3 - 2 * r,
    tweetStorm: playerCount > 1 ? 0.5 + 2.5 * r : 0,
  };
  return ITEM_TYPES.map((type) => [type, weights[type]]);
}

export interface ItemPickupVolume {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export function getItemPickupVolumes(level: LevelMetadata): ItemPickupVolume[] {
  return level.itemBoxes.map((box) => {
    const floor = level.floors.find((f) => f.id === box.floorId);
    return {
      id: box.id,
      x: box.x,
      y: (floor?.y ?? 0) + 1,
      z: box.z,
      width: 1.6,
      height: 1.6,
      depth: 1.6,
    };
  });
}

export { ITEM_TYPES, type ItemType };
