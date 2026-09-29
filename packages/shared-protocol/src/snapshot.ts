import { z } from 'zod';
import { PLAYER_COLOR_IDS } from './colors.js';

export const ITEM_TYPES = ['speedBoost', 'shield', 'tweetStorm'] as const;
export const ItemTypeSchema = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const MatchPhaseSchema = z.enum(['countdown', 'racing', 'finished']);
export type MatchPhase = z.infer<typeof MatchPhaseSchema>;

const finite = z.number().finite();

export const PlayerSnapshotSchema = z.object({
  id: z.string(),
  slotIndex: z.number().int().min(0).max(4),
  nickname: z.string(),
  color: z.enum(PLAYER_COLOR_IDS),
  x: finite,
  y: finite,
  z: finite,
  vx: finite,
  vy: finite,
  vz: finite,
  kx: finite,
  kz: finite,
  facing: z.union([z.literal(1), z.literal(-1)]),
  floor: z.number().int(),
  grounded: z.boolean(),
  climbing: z.string().nullable(),
  /** Match time (ms) until which movement input is ignored. */
  movementDisabledUntilMs: finite,
  knockedDown: z.boolean(),
  fallPenalty: z.boolean(),
  falling: z.boolean(),
  heldItem: ItemTypeSchema.nullable(),
  speedBoostUntilMs: finite,
  shieldUntilMs: finite,
  finishRank: z.number().int().nullable(),
  lastInputSeq: z.number().int(),
  /** Ticks the acknowledged input still has to run on the server. */
  inputTicksLeft: z.number().int().min(0),
  connected: z.boolean(),
  progress: finite,
  /** Computer-controlled filler racer. */
  isBot: z.boolean().optional(),
});
export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;

export const BarrelSnapshotSchema = z.object({
  id: z.number().int(),
  x: finite,
  y: finite,
  z: finite,
  vx: finite,
  vy: finite,
  dropping: z.boolean(),
});
export type BarrelSnapshot = z.infer<typeof BarrelSnapshotSchema>;

export const ItemBoxSnapshotSchema = z.object({
  id: z.string(),
  x: finite,
  y: finite,
  z: finite,
  active: z.boolean(),
});
export type ItemBoxSnapshot = z.infer<typeof ItemBoxSnapshotSchema>;

export const BossSnapshotSchema = z.object({
  x: finite,
  y: finite,
  z: finite,
  throwing: z.boolean(),
});
export type BossSnapshot = z.infer<typeof BossSnapshotSchema>;

export const FinishEntrySchema = z.object({
  rank: z.number().int().min(1),
  playerId: z.string(),
  slotIndex: z.number().int(),
  nickname: z.string(),
  color: z.enum(PLAYER_COLOR_IDS),
  finishTick: z.number().int(),
  serverTimeMs: finite,
});
export type FinishEntry = z.infer<typeof FinishEntrySchema>;

export const AuthoritativeSnapshotSchema = z.object({
  tick: z.number().int().min(0),
  serverTimeMs: finite,
  phase: MatchPhaseSchema,
  raceStartsAtMs: finite,
  raceEndsAtMs: finite.nullable(),
  players: z.array(PlayerSnapshotSchema).max(5),
  barrels: z.array(BarrelSnapshotSchema),
  itemBoxes: z.array(ItemBoxSnapshotSchema),
  boss: BossSnapshotSchema,
  finishOrder: z.array(FinishEntrySchema),
});
export type AuthoritativeSnapshot = z.infer<typeof AuthoritativeSnapshotSchema>;

export function validateAuthoritativeSnapshot(value: unknown): AuthoritativeSnapshot | null {
  const parsed = AuthoritativeSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
