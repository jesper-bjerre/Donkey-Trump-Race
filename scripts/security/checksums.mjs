#!/usr/bin/env node
/**
 * pnpm security:checksums — SHA-256 of every file in the build output, in `sha256sum`
 * format, so a deployed artifact can be compared with the one CI built.
 * Writes artifacts/checksums.sha256; verify with `sha256sum -c artifacts/checksums.sha256`.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOTS = ['packages/client-web/dist', 'packages/server/dist'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

const lines = [];
for (const root of ROOTS) {
  try {
    statSync(root);
  } catch {
    console.error(`${root} not found — run pnpm build first`);
    process.exit(1);
  }
  for (const file of files(root).sort()) {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    lines.push(`${hash}  ${relative('.', file).split(sep).join('/')}`);
  }
}
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/checksums.sha256', lines.join('\n') + '\n');
console.log(`Wrote artifacts/checksums.sha256 (${lines.length} files)`);
