import { validateTelemetryEvent, type TelemetryEvent } from '@dtr/shared-protocol';
import {
  calculateBetaSignoffReport,
  type BetaSignoffReport,
  type ReleaseGateStates,
} from './BetaSignoffReport.js';
import type { BlobClient } from './blobClient.js';
import { BLOB_PREFIXES, betaReportBlobPath } from './blobPathBuilder.js';

/** Parses JSONL telemetry, skipping (and counting) lines that fail validation. */
export function parseTelemetryJsonl(text: string): { events: TelemetryEvent[]; rejected: number } {
  const events: TelemetryEvent[] = [];
  let rejected = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const result = validateTelemetryEvent(JSON.parse(line));
      if (result.ok) events.push(result.event);
      else rejected++;
    } catch {
      rejected++;
    }
  }
  return { events, rejected };
}

/** Reads telemetry blobs (optionally from a `year=YYYY/month=MM` partition prefix). */
export async function loadTelemetryEvents(
  blobs: BlobClient,
  partitionPrefix = '',
): Promise<{ events: TelemetryEvent[]; rejected: number; blobCount: number }> {
  const paths = (await blobs.list(BLOB_PREFIXES.telemetry + partitionPrefix)).filter((p) =>
    p.endsWith('.jsonl'),
  );
  const events: TelemetryEvent[] = [];
  let rejected = 0;
  for (const path of paths) {
    const parsed = parseTelemetryJsonl((await blobs.read(path)) ?? '');
    events.push(...parsed.events);
    rejected += parsed.rejected;
  }
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return { events, rejected, blobCount: paths.length };
}

/** Builds the beta evidence summary and stores it at beta-reports/{rc}/summary.json. */
export async function generateBetaReport(options: {
  blobs: BlobClient;
  releaseCandidateId: string;
  reviews: ReleaseGateStates;
  partitionPrefix?: string;
  now?: Date;
}): Promise<{ report: BetaSignoffReport; path: string; rejectedLines: number }> {
  const { events, rejected, blobCount } = await loadTelemetryEvents(
    options.blobs,
    options.partitionPrefix,
  );
  const report = calculateBetaSignoffReport({
    releaseCandidateId: options.releaseCandidateId,
    events,
    reviews: options.reviews,
    now: options.now,
    blobCount,
    rejectedLines: rejected,
  });
  const path = betaReportBlobPath(options.releaseCandidateId);
  await options.blobs.create(path, JSON.stringify(report, null, 2) + '\n');
  return { report, path, rejectedLines: rejected };
}
