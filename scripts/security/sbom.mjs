#!/usr/bin/env node
/**
 * pnpm security:sbom — CycloneDX SBOM of the source tree (all pnpm packages) using Syft in
 * Docker. CI additionally produces an image SBOM (security.yml, anchore/sbom-action).
 * Writes artifacts/sbom/source.cdx.json.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const SYFT_IMAGE = 'anchore/syft:v1.33.0';

mkdirSync('artifacts/sbom', { recursive: true });
const run = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${process.cwd()}:/src:ro`,
    SYFT_IMAGE,
    'dir:/src',
    '--exclude',
    './node_modules/.cache',
    '-o',
    'cyclonedx-json',
  ],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
if (run.error || run.status !== 0) {
  console.error(run.error?.message ?? run.stderr);
  process.exit(run.status || 2);
}
writeFileSync('artifacts/sbom/source.cdx.json', run.stdout);
const sbom = JSON.parse(run.stdout);
console.log(`Wrote artifacts/sbom/source.cdx.json (${sbom.components?.length ?? 0} components)`);
