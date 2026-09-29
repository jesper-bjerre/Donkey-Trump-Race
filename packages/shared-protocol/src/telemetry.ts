import { z } from 'zod';
import { ERROR_CODES } from './errors.js';
import { ITEM_TYPES } from './snapshot.js';

/**
 * Closed-beta telemetry taxonomy. Events carry only pseudonymous identifiers
 * (salted hashes of room codes and player ids) and bounded operational numbers:
 * never nicknames, room codes, tokens, IP addresses or user agents.
 */
export const TELEMETRY_SCHEMA_VERSION = 1;

export const TELEMETRY_EVENT_NAMES = [
  'room_create',
  'join_attempt',
  'join_success',
  'join_failure',
  'match_start',
  'match_end',
  'disconnect',
  'reconnect',
  'barrel_hit',
  'fall',
  'item_use',
  'rescue_complete',
  'desync_correction',
  'match_breaking_error',
  'rate_limited',
] as const;
export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

/** operational: no per-player identifier; pseudonymous: carries a salted player hash. */
export type TelemetryPrivacyClass = 'operational' | 'pseudonymous';

export const TELEMETRY_PRIVACY_CLASS: Record<TelemetryEventName, TelemetryPrivacyClass> = {
  room_create: 'operational',
  join_attempt: 'operational',
  join_success: 'pseudonymous',
  join_failure: 'operational',
  match_start: 'pseudonymous',
  match_end: 'operational',
  disconnect: 'pseudonymous',
  reconnect: 'pseudonymous',
  barrel_hit: 'pseudonymous',
  fall: 'pseudonymous',
  item_use: 'pseudonymous',
  rescue_complete: 'pseudonymous',
  desync_correction: 'pseudonymous',
  match_breaking_error: 'operational',
  rate_limited: 'operational',
};

const slot = z.number().int().min(0).max(4);
const ms = z
  .number()
  .finite()
  .min(0)
  .max(24 * 60 * 60 * 1000);
const hash = z.string().regex(/^[a-f0-9]{16}$/);

export const TelemetryEventPayloadSchemas = {
  room_create: z.object({}).strict(),
  join_attempt: z.object({}).strict(),
  join_success: z.object({ slotIndex: slot, joinLatencyMs: ms }).strict(),
  join_failure: z.object({ errorCode: z.enum(ERROR_CODES) }).strict(),
  match_start: z
    .object({ playerCount: z.number().int().min(1).max(5), playerHashes: z.array(hash).max(5) })
    .strict(),
  match_end: z
    .object({
      outcome: z.enum(['completed', 'interrupted']),
      durationMs: ms,
      playerCount: z.number().int().min(0).max(5),
      finishers: z.number().int().min(0).max(5),
    })
    .strict(),
  disconnect: z
    .object({ closeCode: z.number().int().min(1000).max(4999), phase: z.enum(['lobby', 'match']) })
    .strict(),
  reconnect: z.object({ offlineMs: ms }).strict(),
  barrel_hit: z.object({ slotIndex: slot, blocked: z.boolean() }).strict(),
  fall: z.object({ slotIndex: slot }).strict(),
  item_use: z.object({ slotIndex: slot, item: z.enum(ITEM_TYPES) }).strict(),
  rescue_complete: z
    .object({ slotIndex: slot, rank: z.number().int().min(1).max(5), raceTimeMs: ms })
    .strict(),
  desync_correction: z
    .object({
      playerSlot: slot,
      correctionDistance: z.number().finite().min(0).max(1000),
      tick: z.number().int().min(0),
      severity: z.enum(['minor', 'major']),
    })
    .strict(),
  match_breaking_error: z
    .object({ errorClass: z.string().regex(/^[A-Za-z]{1,40}$/), phase: z.enum(['lobby', 'match']) })
    .strict(),
  rate_limited: z
    .object({ scope: z.enum(['rest', 'ws']), policy: z.string().regex(/^[a-z_.]{1,40}$/) })
    .strict(),
} satisfies Record<TelemetryEventName, z.ZodType>;

export type TelemetryEventPayloadMap = {
  [K in TelemetryEventName]: z.infer<(typeof TelemetryEventPayloadSchemas)[K]>;
};

export const TelemetryEventSchema = z
  .object({
    schemaVersion: z.literal(TELEMETRY_SCHEMA_VERSION),
    eventId: z.string().regex(/^[a-z0-9_]{8,40}$/),
    name: z.enum(TELEMETRY_EVENT_NAMES),
    occurredAt: z.iso.datetime(),
    environment: z.string().regex(/^[a-z0-9-]{1,20}$/),
    privacyClass: z.enum(['operational', 'pseudonymous']),
    roomHash: hash.optional(),
    playerHash: hash.optional(),
    matchId: z
      .string()
      .regex(/^m_[a-f0-9]{12}$/)
      .optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type TelemetryEvent<K extends TelemetryEventName = TelemetryEventName> = Omit<
  z.infer<typeof TelemetryEventSchema>,
  'name' | 'payload'
> & { name: K; payload: TelemetryEventPayloadMap[K] };

/** Keys that must never appear anywhere in a telemetry event, at any depth. */
export const FORBIDDEN_TELEMETRY_KEYS = [
  'nickname',
  'roomCode',
  'code',
  'token',
  'roomToken',
  'ip',
  'ipAddress',
  'userAgent',
  'email',
  'playerId',
];

function findForbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenKey(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  for (const [key, inner] of Object.entries(value)) {
    if (FORBIDDEN_TELEMETRY_KEYS.includes(key)) return key;
    const found = findForbiddenKey(inner);
    if (found) return found;
  }
  return null;
}

export type TelemetryValidation =
  { ok: true; event: TelemetryEvent } | { ok: false; reason: string };

export function validateTelemetryEvent(value: unknown): TelemetryValidation {
  const forbidden = findForbiddenKey(value);
  if (forbidden) return { ok: false, reason: `forbidden field: ${forbidden}` };
  const parsed = TelemetryEventSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: 'invalid envelope' };
  const event = parsed.data;
  const payload = TelemetryEventPayloadSchemas[event.name].safeParse(event.payload);
  if (!payload.success) return { ok: false, reason: `invalid payload for ${event.name}` };
  if (event.privacyClass !== TELEMETRY_PRIVACY_CLASS[event.name]) {
    return { ok: false, reason: 'privacy class mismatch' };
  }
  return { ok: true, event: event as TelemetryEvent };
}
