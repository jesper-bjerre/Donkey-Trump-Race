#!/usr/bin/env node
/**
 * pnpm workflow:lint — actionlint (via its Docker image, no local install needed) plus the
 * pinned-action check. Mirrors the "Workflow lint" job in .github/workflows/security.yml.
 */
import { spawnSync } from 'node:child_process';

const ACTIONLINT_IMAGE = 'rhysd/actionlint:1.7.7';

const lint = spawnSync(
  'docker',
  ['run', '--rm', '-v', `${process.cwd()}:/repo`, '-w', '/repo', ACTIONLINT_IMAGE, '-color'],
  { stdio: 'inherit' },
);
if (lint.error) {
  console.error(`Could not run actionlint in Docker: ${lint.error.message}`);
  process.exit(2);
}
const pinned = spawnSync(process.execPath, ['scripts/security/check-pinned-actions.mjs'], {
  stdio: 'inherit',
});
process.exit(lint.status || pinned.status || 0);
