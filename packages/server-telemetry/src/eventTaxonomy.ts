import { randomBytes } from 'node:crypto';
import {
  TELEMETRY_PRIVACY_CLASS,
  TELEMETRY_SCHEMA_VERSION,
  validateTelemetryEvent,
  type TelemetryEvent,
  type TelemetryEventName,
  type TelemetryEventPayloadMap,
} from '@dtr/shared-protocol';

export { validateTelemetryEvent };

export interface TelemetryContext {
  environment: string;
  roomHash?: string;
  playerHash?: string;
  matchId?: string;
  /** Defaults to now; injectable for deterministic tests. */
  occurredAt?: Date;
  eventId?: string;
}

/** Builds and validates a telemetry event; throws when the payload breaks the taxonomy. */
export function buildTelemetryEvent<K extends TelemetryEventName>(
  name: K,
  context: TelemetryContext,
  payload: TelemetryEventPayloadMap[K],
): TelemetryEvent<K> {
  const event: Record<string, unknown> = {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    eventId: context.eventId ?? `evt_${randomBytes(8).toString('hex')}`,
    name,
    occurredAt: (context.occurredAt ?? new Date()).toISOString(),
    environment: context.environment,
    privacyClass: TELEMETRY_PRIVACY_CLASS[name],
    payload,
  };
  if (context.roomHash) event.roomHash = context.roomHash;
  if (context.playerHash) event.playerHash = context.playerHash;
  if (context.matchId) event.matchId = context.matchId;
  const result = validateTelemetryEvent(event);
  if (!result.ok) throw new Error(`Invalid telemetry event ${name}: ${result.reason}`);
  return result.event as TelemetryEvent<K>;
}
