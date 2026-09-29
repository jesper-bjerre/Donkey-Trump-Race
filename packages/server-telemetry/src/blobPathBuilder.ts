/** Blob prefixes; the Terraform lifecycle policy keys retention off these. */
export const BLOB_PREFIXES = {
  telemetry: 'telemetry/',
  audit: 'audit/',
  privacyRequests: 'privacy/requests/',
  betaReports: 'beta-reports/',
} as const;

function datePartitions(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `year=${y}/month=${m}/day=${d}`;
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

function segment(value: string, what: string): string {
  if (!SAFE_SEGMENT.test(value)) throw new Error(`Unsafe ${what} for blob path`);
  return value;
}

/** telemetry/year=YYYY/month=MM/day=DD/roomHash=<hash>/matchEvents.jsonl */
export function telemetryBlobPath(date: Date, roomHash: string | undefined): string {
  const room = roomHash ? segment(roomHash, 'roomHash') : 'none';
  return `${BLOB_PREFIXES.telemetry}${datePartitions(date)}/roomHash=${room}/matchEvents.jsonl`;
}

/** audit/year=YYYY/month=MM/day=DD/audit.jsonl */
export function auditBlobPath(date: Date): string {
  return `${BLOB_PREFIXES.audit}${datePartitions(date)}/audit.jsonl`;
}

export function privacyRequestBlobPath(requestId: string): string {
  return `${BLOB_PREFIXES.privacyRequests}${segment(requestId, 'requestId')}.json`;
}

export function betaReportBlobPath(releaseCandidateId: string): string {
  return `${BLOB_PREFIXES.betaReports}${segment(releaseCandidateId, 'releaseCandidateId')}/summary.json`;
}
