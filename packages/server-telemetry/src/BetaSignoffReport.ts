import { z } from 'zod';
import type { TelemetryEvent } from '@dtr/shared-protocol';
import { rollupBetaKpis, type BetaKpis } from './betaKpiRollups.js';

const ReviewSchema = z
  .object({
    status: z.enum(['approved', 'pending', 'rejected']),
    reviewedAt: z.string().optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

/** Human review gates that telemetry cannot decide (PRD: legal/IP, privacy, accessibility). */
export const ReleaseGateStatesSchema = z
  .object({
    legalIpReview: ReviewSchema,
    privacyReview: ReviewSchema,
    accessibilityReview: ReviewSchema,
  })
  .strict();
export type ReleaseGateStates = z.infer<typeof ReleaseGateStatesSchema>;

export interface KpiGate {
  id: string;
  description: string;
  comparator: '>=' | '<';
  target: number;
  actual: number | null;
  passed: boolean;
}

export interface BetaSignoffReport {
  releaseCandidateId: string;
  generatedAt: string;
  eventCount: number;
  kpis: BetaKpis;
  gates: KpiGate[];
  reviews: ReleaseGateStates;
  /** go: every gate and review passed; no-go: a review was rejected; otherwise extend-beta. */
  recommendation: 'go' | 'no-go' | 'extend-beta';
  blockers: string[];
}

/** PRD beta exit gates. */
export const BETA_GATES: ReadonlyArray<
  Omit<KpiGate, 'actual' | 'passed'> & { kpi: keyof BetaKpis }
> = [
  {
    id: 'match_completion',
    kpi: 'matchCompletionRate',
    description: 'Started matches that reach a rescue/finish result',
    comparator: '>=',
    target: 0.8,
  },
  {
    id: 'repeat_match',
    kpi: 'repeatMatchRate',
    description: 'Players who play 2 or more matches',
    comparator: '>=',
    target: 0.7,
  },
  {
    id: 'join_within_10s',
    kpi: 'joinSuccessWithin10sRate',
    description: 'Valid room joins that succeed within 10 seconds',
    comparator: '>=',
    target: 0.9,
  },
  {
    id: 'match_breaking_errors',
    kpi: 'matchBreakingErrorRate',
    description: 'Matches ending in an unrecoverable error',
    comparator: '<',
    target: 0.02,
  },
  {
    id: 'desync',
    kpi: 'desyncMatchRate',
    description: 'Matches with a major state correction',
    comparator: '<',
    target: 0.05,
  },
];

export function calculateBetaSignoffReport(input: {
  releaseCandidateId: string;
  events: readonly TelemetryEvent[];
  reviews: ReleaseGateStates;
  now?: Date;
}): BetaSignoffReport {
  const kpis = rollupBetaKpis(input.events);
  const gates: KpiGate[] = BETA_GATES.map(({ kpi, ...gate }) => {
    const actual = kpis[kpi] as number | null;
    const passed =
      actual !== null && (gate.comparator === '>=' ? actual >= gate.target : actual < gate.target);
    return { ...gate, actual, passed };
  });
  const blockers = [
    ...gates.filter((g) => !g.passed).map((g) => `gate:${g.id}`),
    ...Object.entries(input.reviews)
      .filter(([, review]) => review.status !== 'approved')
      .map(([name, review]) => `review:${name}:${review.status}`),
  ];
  const rejected = Object.values(input.reviews).some((r) => r.status === 'rejected');
  return {
    releaseCandidateId: input.releaseCandidateId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    eventCount: input.events.length,
    kpis,
    gates,
    reviews: input.reviews,
    recommendation: rejected ? 'no-go' : blockers.length === 0 ? 'go' : 'extend-beta',
    blockers,
  };
}
