import type { TelemetryEvent } from '@dtr/shared-protocol';
import type { BlobClient } from './blobClient.js';
import { telemetryBlobPath } from './blobPathBuilder.js';

export const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
/** Beyond this many buffered events the oldest are dropped (and counted) to bound memory. */
export const MAX_BUFFERED_EVENTS = 20_000;

export interface ExporterStats {
  exported: number;
  dropped: number;
  failedFlushes: number;
  buffered: number;
}

/**
 * Buffers telemetry and writes it as JSONL batches, one append per
 * (day, roomHash) blob. Flushes on an interval, when a match closes and on shutdown.
 * Failures keep the batch for the next attempt; the game loop is never blocked.
 */
export class TelemetryBatchExporter {
  private buffer: TelemetryEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;
  private readonly stats = { exported: 0, dropped: 0, failedFlushes: 0 };

  constructor(
    private readonly blobs: BlobClient,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  enqueue(event: TelemetryEvent): void {
    this.buffer.push(event);
    const overflow = this.buffer.length - MAX_BUFFERED_EVENTS;
    if (overflow > 0) {
      this.buffer.splice(0, overflow);
      this.stats.dropped += overflow;
    }
  }

  start(intervalMs = DEFAULT_FLUSH_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  /** Writes everything buffered so far. Concurrent calls share one in-flight flush. */
  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      if (this.buffer.length === 0) return;
    }
    this.flushing = this.flushNow().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
  }

  getStats(): ExporterStats {
    return { ...this.stats, buffered: this.buffer.length };
  }

  private async flushNow(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    const groups = new Map<string, TelemetryEvent[]>();
    for (const event of batch) {
      const path = telemetryBlobPath(new Date(event.occurredAt), event.roomHash);
      const group = groups.get(path);
      if (group) group.push(event);
      else groups.set(path, [event]);
    }
    for (const [path, events] of groups) {
      try {
        await this.blobs.append(path, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
        this.stats.exported += events.length;
      } catch (error) {
        this.stats.failedFlushes++;
        // Put the failed group back in front so ordering is preserved on retry.
        this.buffer = [...events, ...this.buffer];
        this.onError(error);
      }
    }
  }
}
