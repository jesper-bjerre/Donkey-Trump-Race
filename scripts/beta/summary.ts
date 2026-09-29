/**
 * Closed-beta evidence summary.
 *
 *   pnpm beta:summary -- --releaseCandidateId rc-2026-12-15 \
 *     [--source file:.data/telemetry | azure:https://<account>.blob.core.windows.net] \
 *     [--container telemetry] [--partition year=2026/month=12] [--reviews docs/beta/release-gates.json]
 *
 * Reads telemetry JSONL, computes the PRD KPIs and gates, and writes
 * beta-reports/<releaseCandidateId>/summary.json next to the telemetry.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  AzureBlobClient,
  FileBlobClient,
  generateBetaReport,
  ReleaseGateStatesSchema,
  type BlobClient,
} from '../../packages/server-telemetry/src/index.js';

const { values } = parseArgs({
  // pnpm forwards a literal '--' before script arguments; drop it so options still parse.
  args: process.argv.slice(2).filter((arg, i) => !(i === 0 && arg === '--')),
  options: {
    releaseCandidateId: { type: 'string' },
    source: { type: 'string', default: 'file:.data/telemetry' },
    container: { type: 'string', default: 'telemetry' },
    partition: { type: 'string', default: '' },
    reviews: { type: 'string', default: 'docs/beta/release-gates.json' },
  },
});

if (!values.releaseCandidateId) {
  console.error('Missing --releaseCandidateId');
  process.exit(2);
}

async function openSource(source: string): Promise<BlobClient> {
  if (source.startsWith('file:')) return new FileBlobClient(source.slice('file:'.length));
  if (source.startsWith('azure:')) {
    return AzureBlobClient.create(source.slice('azure:'.length), values.container!);
  }
  throw new Error('--source must be file:<dir> or azure:<account-url>');
}

const reviews = ReleaseGateStatesSchema.parse(JSON.parse(readFileSync(values.reviews!, 'utf8')));
const { report, path, rejectedLines } = await generateBetaReport({
  blobs: await openSource(values.source!),
  releaseCandidateId: values.releaseCandidateId,
  reviews,
  partitionPrefix: values.partition,
});

console.log(`Wrote ${path} (${report.eventCount} events, ${rejectedLines} rejected lines)`);
for (const gate of report.gates) {
  const actual = gate.actual === null ? 'n/a' : gate.actual.toFixed(3);
  console.log(
    `${gate.passed ? 'PASS' : 'FAIL'}  ${gate.id.padEnd(22)} ${actual} ${gate.comparator} ${gate.target}`,
  );
}
console.log(`Recommendation: ${report.recommendation}`);
if (report.blockers.length) console.log(`Blockers: ${report.blockers.join(', ')}`);
