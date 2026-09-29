import { z } from 'zod';
import { PLAYER_COLOR_IDS } from './colors.js';
import { ERROR_CODES } from './errors.js';
import { RoleSchema, RoomStateSchema } from './rest.js';
import { AuthoritativeSnapshotSchema, FinishEntrySchema, ItemTypeSchema } from './snapshot.js';

export const PROTOCOL_VERSION = 1;
/** Inbound frames above this size are rejected before JSON parsing. */
export const MAX_CLIENT_MESSAGE_BYTES = 4096;
/** Close codes used by the realtime gateway. */
export const CLOSE_CODES = {
  unauthenticated: 4401,
  forbidden: 4403,
  payloadTooLarge: 4413,
  rateLimited: 4429,
  heartbeatTimeout: 4408,
  replaced: 4409,
  roomClosed: 4410,
} as const;

const v = z.literal(PROTOCOL_VERSION);
const axis = z.number().finite().min(-1).max(1);

export const ClientInputCommandSchema = z.object({
  seq: z
    .number()
    .int()
    .min(0)
    .max(2 ** 31),
  /** World-space run axis along x. */
  moveX: axis,
  /** Lane change axis along z. */
  moveZ: axis,
  /** +1 climbs up a ladder, -1 climbs down. */
  climb: axis,
  jump: z.boolean(),
});
export type ClientInputCommand = z.infer<typeof ClientInputCommandSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('client.hello'),
    protocolVersion: v,
    roomToken: z.string().max(1024),
  }),
  z.object({ type: z.literal('client.ready'), protocolVersion: v, ready: z.boolean() }),
  z.object({
    type: z.literal('client.input'),
    protocolVersion: v,
    input: ClientInputCommandSchema,
  }),
  z.object({ type: z.literal('client.useItem'), protocolVersion: v }),
  z.object({ type: z.literal('client.ping'), protocolVersion: v, t: z.number().finite() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const LobbyPlayerSchema = z.object({
  id: z.string(),
  slotIndex: z.number().int(),
  nickname: z.string(),
  color: z.enum(PLAYER_COLOR_IDS),
  role: RoleSchema,
  ready: z.boolean(),
  connected: z.boolean(),
});
export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const GameEventSchema = z.object({
  kind: z.enum([
    'barrelHit',
    'fall',
    'respawn',
    'shove',
    'itemPickup',
    'itemUse',
    'shieldBlock',
    'rescue',
  ]),
  playerId: z.string(),
  targetId: z.string().optional(),
  item: ItemTypeSchema.optional(),
  serverTimeMs: z.number(),
});
export type GameEvent = z.infer<typeof GameEventSchema>;

export const MatchHighlightsSchema = z.object({
  barrelHits: z.number().int(),
  falls: z.number().int(),
  shoves: z.number().int(),
  itemUses: z.number().int(),
});
export type MatchHighlights = z.infer<typeof MatchHighlightsSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('server.welcome'),
    protocolVersion: v,
    roomCode: z.string(),
    playerId: z.string(),
    slotIndex: z.number().int(),
    color: z.enum(PLAYER_COLOR_IDS),
  }),
  z.object({
    type: z.literal('server.session'),
    protocolVersion: v,
    roomToken: z.string(),
    expiresAt: z.number().int(),
  }),
  z.object({
    type: z.literal('server.lobbyState'),
    protocolVersion: v,
    roomCode: z.string(),
    state: RoomStateSchema,
    hostId: z.string(),
    maxPlayers: z.number().int(),
    minPlayers: z.number().int(),
    players: z.array(LobbyPlayerSchema),
  }),
  z.object({
    type: z.literal('server.matchStart'),
    protocolVersion: v,
    matchId: z.string(),
    mapId: z.string(),
  }),
  z.object({
    type: z.literal('server.snapshot'),
    protocolVersion: v,
    snapshot: AuthoritativeSnapshotSchema,
  }),
  z.object({ type: z.literal('server.event'), protocolVersion: v, event: GameEventSchema }),
  z.object({
    type: z.literal('server.matchEnded'),
    protocolVersion: v,
    matchId: z.string(),
    finishOrder: z.array(FinishEntrySchema),
    highlights: MatchHighlightsSchema,
  }),
  z.object({
    type: z.literal('server.error'),
    protocolVersion: v,
    code: z.enum(ERROR_CODES),
    message: z.string(),
  }),
  z.object({
    type: z.literal('server.pong'),
    protocolVersion: v,
    t: z.number(),
    serverTimeMs: z.number(),
  }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ServerMessageBody = DistributiveOmit<ServerMessage, 'protocolVersion'>;
export type ClientMessageBody = DistributiveOmit<ClientMessage, 'protocolVersion'>;

/** UTF-8 byte length without relying on platform-specific encoders. */
export function byteLength(raw: string): number {
  let bytes = 0;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export type ParseResult<T> =
  { ok: true; message: T } | { ok: false; reason: 'too_large' | 'invalid_json' | 'invalid_schema' };

function parseWith<T>(schema: z.ZodType<T>, raw: string): ParseResult<T> {
  if (byteLength(raw) > MAX_CLIENT_MESSAGE_BYTES) return { ok: false, reason: 'too_large' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, message: parsed.data }
    : { ok: false, reason: 'invalid_schema' };
}

export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseWith(ClientMessageSchema, raw);
}

export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  // Snapshots can exceed the client cap; the size limit only protects the server.
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  const parsed = ServerMessageSchema.safeParse(json);
  return parsed.success
    ? { ok: true, message: parsed.data }
    : { ok: false, reason: 'invalid_schema' };
}

export function validateClientInputCommand(value: unknown): ClientInputCommand | null {
  const parsed = ClientInputCommandSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function encodeServerMessage(body: ServerMessageBody): string {
  return JSON.stringify({ ...body, protocolVersion: PROTOCOL_VERSION });
}

export function encodeClientMessage(body: ClientMessageBody): string {
  return JSON.stringify({ ...body, protocolVersion: PROTOCOL_VERSION });
}
