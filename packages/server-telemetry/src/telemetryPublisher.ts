import type {
  TelemetryEvent,
  TelemetryEventName,
  TelemetryEventPayloadMap,
} from '@dtr/shared-protocol';
import type { TelemetryBatchExporter } from './blobBatchExporter.js';
import { buildTelemetryEvent, type TelemetryContext } from './eventTaxonomy.js';

export type PublishContext = Omit<TelemetryContext, 'environment'>;

/**
 * Game code publishes through this interface. Implementations must never throw:
 * telemetry failures are logged and gameplay continues.
 */
export interface TelemetryPublisher {
  publish<K extends TelemetryEventName>(
    name: K,
    context: PublishContext,
    payload: TelemetryEventPayloadMap[K],
  ): void;
  /** Flushes pending events (match close, shutdown). */
  flush(): Promise<void>;
}

type Warn = (message: string, fields?: Record<string, unknown>) => void;

export class BatchTelemetryPublisher implements TelemetryPublisher {
  constructor(
    private readonly exporter: TelemetryBatchExporter,
    private readonly environment: string,
    private readonly warn: Warn = () => undefined,
  ) {}

  publish<K extends TelemetryEventName>(
    name: K,
    context: PublishContext,
    payload: TelemetryEventPayloadMap[K],
  ): void {
    try {
      this.exporter.enqueue(
        buildTelemetryEvent(name, { ...context, environment: this.environment }, payload),
      );
    } catch (error) {
      this.warn('telemetry_publish_failed', { event: name, error: (error as Error).message });
    }
  }

  flush(): Promise<void> {
    return this.exporter.flush().catch((error: unknown) => {
      this.warn('telemetry_flush_failed', { error: (error as Error).message });
    });
  }
}

/** Test double that records validated events in memory. */
export class RecordingTelemetryPublisher implements TelemetryPublisher {
  readonly events: TelemetryEvent[] = [];
  readonly failures: Array<{ name: string; reason: string }> = [];

  constructor(private readonly environment = 'test') {}

  publish<K extends TelemetryEventName>(
    name: K,
    context: PublishContext,
    payload: TelemetryEventPayloadMap[K],
  ): void {
    try {
      this.events.push(
        buildTelemetryEvent(name, { ...context, environment: this.environment }, payload),
      );
    } catch (error) {
      this.failures.push({ name, reason: (error as Error).message });
    }
  }

  named<K extends TelemetryEventName>(name: K): Array<TelemetryEvent<K>> {
    return this.events.filter((e): e is TelemetryEvent<K> => e.name === name);
  }

  async flush(): Promise<void> {}
}

/**
 * Mirrors validated events to structured logs (`msg: "telemetry"`). In Azure these land in
 * Log Analytics via the Container Apps environment and feed the dashboards and alerts,
 * while Blob storage keeps the long-term JSONL evidence.
 */
export class LoggingTelemetryPublisher implements TelemetryPublisher {
  constructor(
    private readonly environment: string,
    private readonly log: (message: string, fields: Record<string, unknown>) => void,
  ) {}

  publish<K extends TelemetryEventName>(
    name: K,
    context: PublishContext,
    payload: TelemetryEventPayloadMap[K],
  ): void {
    try {
      const event = buildTelemetryEvent(
        name,
        { ...context, environment: this.environment },
        payload,
      );
      this.log('telemetry', {
        event: event.name,
        roomHash: event.roomHash,
        matchId: event.matchId,
        ...event.payload,
      });
    } catch {
      // Invalid events are reported by the primary publisher.
    }
  }

  async flush(): Promise<void> {}
}

/** Fans one event out to several publishers (e.g. Blob batches plus structured logs). */
export class TeeTelemetryPublisher implements TelemetryPublisher {
  constructor(private readonly publishers: TelemetryPublisher[]) {}

  publish<K extends TelemetryEventName>(
    name: K,
    context: PublishContext,
    payload: TelemetryEventPayloadMap[K],
  ): void {
    for (const publisher of this.publishers) publisher.publish(name, context, payload);
  }

  async flush(): Promise<void> {
    await Promise.all(this.publishers.map((p) => p.flush()));
  }
}

export class NoopTelemetryPublisher implements TelemetryPublisher {
  publish(): void {}
  async flush(): Promise<void> {}
}
