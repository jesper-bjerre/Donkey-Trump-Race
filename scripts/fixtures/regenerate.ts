/**
 * Rewrites committed "expected" fixtures from the current shared rules.
 * Tests only ever compare against the committed files, so run this deliberately
 * (`pnpm fixtures:regenerate`) and review the diff when a rule change is intended.
 */
import { writeFileSync } from 'node:fs';
import { MVP_VERTICAL_MAP } from '../../packages/shared-level/src/index.js';
import { buildSimulationFixtures } from '../../packages/shared-simulation/test/fixtures/index.js';
import {
  buildBetaSession,
  buildTaxonomyExamples,
  LEGAL_GATE_STATES,
} from '../../packages/server-telemetry/test/fixtures/build.js';
import { MVP_ITEM_PICKUP_VOLUMES } from '../../packages/shared-items/src/index.js';

function write(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  console.log(`wrote ${path}`);
}

write('packages/shared-level/test/fixtures/mvpVerticalMap.json', MVP_VERTICAL_MAP);
write('packages/shared-items/test/fixtures/itemPickupVolumes.mvp.json', MVP_ITEM_PICKUP_VOLUMES);
for (const [name, value] of Object.entries(buildSimulationFixtures().expected)) {
  write(`packages/shared-simulation/test/fixtures/expected/${name}.expected.json`, value);
}

const telemetryFixtures = 'packages/server-telemetry/test/fixtures/';
write(`${telemetryFixtures}telemetry-events.json`, buildTaxonomyExamples());
write(`${telemetryFixtures}legalGateStates.json`, LEGAL_GATE_STATES);
writeFileSync(
  `${telemetryFixtures}betaTelemetry.jsonl`,
  buildBetaSession()
    .map((e) => JSON.stringify(e))
    .join('\n') + '\n',
);
console.log(`wrote ${telemetryFixtures}betaTelemetry.jsonl`);
