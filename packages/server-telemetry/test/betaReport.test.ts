import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '@dtr/shared-protocol';
import {
  calculateBetaSignoffReport,
  generateBetaReport,
  InMemoryBlobClient,
  parseTelemetryJsonl,
  ReleaseGateStatesSchema,
  rollupBetaKpis,
} from '../src/index.js';
import { buildBetaSession } from './fixtures/build.js';

const jsonl = readFileSync(new URL('./fixtures/betaTelemetry.jsonl', import.meta.url), 'utf8');
const reviews = ReleaseGateStatesSchema.parse(
  JSON.parse(readFileSync(new URL('./fixtures/legalGateStates.json', import.meta.url), 'utf8')),
);

describe('beta KPI rollups', () => {
  const { events, rejected } = parseTelemetryJsonl(jsonl);

  it('parses the committed beta session without rejects', () => {
    expect(rejected).toBe(0);
    expect(events.map((e) => JSON.stringify(e)).join('\n') + '\n').toBe(
      buildBetaSession()
        .map((e) => JSON.stringify(e))
        .join('\n') + '\n',
    );
  });

  it('computes the PRD KPIs', () => {
    const kpis = rollupBetaKpis(events);
    expect(kpis.matchesStarted).toBe(18);
    expect(kpis.matchesInterrupted).toBe(1);
    expect(kpis.joinSuccessWithin10sRate).toBeCloseTo(29 / 30, 4);
    expect(kpis.matchCompletionRate).toBeCloseTo(17 / 18, 4);
    expect(kpis.matchBreakingErrorRate).toBeCloseTo(1 / 18, 4);
    expect(kpis.desyncMatchRate).toBeCloseTo(1 / 18, 4);
    expect(kpis.repeatMatchRate).toBeCloseTo(24 / 30, 4);
  });

  it('skips malformed and privacy-violating lines', () => {
    const bad = [
      '{not json',
      JSON.stringify({ ...events[0], payload: { nickname: 'Løkke' } }),
    ].join('\n');
    expect(parseTelemetryJsonl(bad)).toEqual({ events: [], rejected: 2 });
  });
});

describe('beta sign-off report', () => {
  const { events } = parseTelemetryJsonl(jsonl);

  it('flags failing gates and pending legal review', () => {
    const report = calculateBetaSignoffReport({ releaseCandidateId: 'rc-1', events, reviews });
    const byId = Object.fromEntries(report.gates.map((g) => [g.id, g.passed]));
    expect(byId).toEqual({
      match_completion: true,
      repeat_match: true,
      join_within_10s: true,
      match_breaking_errors: false,
      desync: false,
    });
    expect(report.blockers).toContain('review:legalIpReview:pending');
    expect(report.recommendation).toBe('extend-beta');
    expect(report.reviews.legalIpReview.status).toBe('pending');
  });

  it('recommends no-go when a review is rejected and go when everything passes', () => {
    const rejected = {
      ...reviews,
      legalIpReview: { status: 'rejected' as const },
    };
    expect(
      calculateBetaSignoffReport({ releaseCandidateId: 'rc', events, reviews: rejected })
        .recommendation,
    ).toBe('no-go');
    const healthy = events.filter(
      (e) => e.matchId !== 'm_090000000000' && e.name !== 'desync_correction',
    );
    const approved = {
      legalIpReview: { status: 'approved' as const },
      privacyReview: { status: 'approved' as const },
      accessibilityReview: { status: 'approved' as const },
    };
    const report = calculateBetaSignoffReport({
      releaseCandidateId: 'rc',
      events: healthy,
      reviews: approved,
    });
    expect(report.blockers).toEqual([]);
    expect(report.recommendation).toBe('go');
  });

  it('writes beta-reports/{rc}/summary.json from stored telemetry', async () => {
    const blobs = new InMemoryBlobClient();
    await blobs.append(
      'telemetry/year=2026/month=12/day=10/roomHash=none/matchEvents.jsonl',
      jsonl,
    );
    const { path, report } = await generateBetaReport({
      blobs,
      releaseCandidateId: 'rc-2026-12-10',
      reviews,
    });
    expect(path).toBe('beta-reports/rc-2026-12-10/summary.json');
    expect(report.source).toMatchObject({ blobCount: 1, rejectedLines: 0 });
    expect(report.source.firstEventAt! <= report.source.lastEventAt!).toBe(true);
    expect(JSON.parse((await blobs.read(path))!).kpis).toEqual(report.kpis);
    await expect(
      generateBetaReport({ blobs, releaseCandidateId: 'rc-2026-12-10', reviews }),
    ).rejects.toThrow(/already exists/);
  });
});

describe('gate boundaries', () => {
  const approved = {
    legalIpReview: { status: 'approved' as const },
    privacyReview: { status: 'approved' as const },
    accessibilityReview: { status: 'approved' as const },
  };
  const gate = (events: ReturnType<typeof parseTelemetryJsonl>['events'], id: string) =>
    calculateBetaSignoffReport({ releaseCandidateId: 'rc', events, reviews: approved }).gates.find(
      (g) => g.id === id,
    )!;

  it('fails match-breaking errors at exactly 2% and passes just below', () => {
    const { events } = parseTelemetryJsonl(jsonl);
    const start = events.find((e) => e.name === 'match_start')!;
    const end = events.find(
      (e) =>
        e.name === 'match_end' &&
        (e as TelemetryEvent<'match_end'>).payload.outcome === 'interrupted',
    )!;
    const withRate = (starts: number) => [...Array(starts).fill(start), end];
    expect(gate(withRate(50), 'match_breaking_errors')).toMatchObject({
      actual: 0.02,
      passed: false,
    });
    expect(gate(withRate(51), 'match_breaking_errors').passed).toBe(true);
  });

  it('fails join-within-10s when slow joins push the rate under 90%', () => {
    const { events } = parseTelemetryJsonl(jsonl);
    const attempt = events.find((e) => e.name === 'join_attempt')!;
    const latency = (e: TelemetryEvent) =>
      e.name === 'join_success' ? (e as TelemetryEvent<'join_success'>).payload.joinLatencyMs : NaN;
    const fast = events.find((e) => latency(e) < 10_000)!;
    const slow = events.find((e) => latency(e) > 10_000)!;
    const sample = (slowCount: number) => [
      ...Array(10).fill(attempt),
      ...Array(10 - slowCount).fill(fast),
      ...Array(slowCount).fill(slow),
    ];
    expect(gate(sample(1), 'join_within_10s')).toMatchObject({ actual: 0.9, passed: true });
    expect(gate(sample(2), 'join_within_10s')).toMatchObject({ actual: 0.8, passed: false });
  });
});
