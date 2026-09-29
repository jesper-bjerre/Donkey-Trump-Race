import { z } from 'zod';
import { PLAYER_COLOR_IDS } from './colors.js';

export const RoleSchema = z.enum(['host', 'participant']);
export type Role = z.infer<typeof RoleSchema>;

export const RoomStateSchema = z.enum(['lobby', 'in_progress']);
export type RoomState = z.infer<typeof RoomStateSchema>;

export const NicknameBodySchema = z.object({ nickname: z.string().max(64) });
export type NicknameBody = z.infer<typeof NicknameBodySchema>;

export const RoomSessionSchema = z.object({
  roomCode: z.string(),
  playerId: z.string(),
  slotIndex: z.number().int().min(0).max(4),
  color: z.enum(PLAYER_COLOR_IDS),
  role: RoleSchema,
  roomToken: z.string(),
  expiresAt: z.number().int(),
});
export type RoomSession = z.infer<typeof RoomSessionSchema>;

export const StartMatchResponseSchema = z.object({
  roomCode: z.string(),
  matchId: z.string(),
  state: z.literal('in_progress'),
  serverTimeMs: z.number(),
});
export type StartMatchResponse = z.infer<typeof StartMatchResponseSchema>;

export const RoomStatusSchema = z.object({
  roomCode: z.string(),
  state: RoomStateSchema,
  playerCount: z.number().int(),
  maxPlayers: z.number().int(),
  joinable: z.boolean(),
});
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomTokenClaimsSchema = z.object({
  roomCode: z.string(),
  playerId: z.string(),
  slotIndex: z.number().int().min(0).max(4),
  role: RoleSchema,
  iat: z.number().int(),
  exp: z.number().int(),
  nonce: z.string(),
});
export type RoomTokenClaims = z.infer<typeof RoomTokenClaimsSchema>;

export function validateRoomTokenClaims(value: unknown, nowMs: number): RoomTokenClaims | null {
  const parsed = RoomTokenClaimsSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.exp <= nowMs) return null;
  return parsed.data;
}
