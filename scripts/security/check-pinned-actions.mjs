#!/usr/bin/env node
/**
 * Fails when a workflow or composite action references a third-party action by a mutable
 * tag or branch instead of a full 40-character commit SHA. Local actions (./...) and
 * docker:// references with a digest are allowed.
 *
 *   node scripts/security/check-pinned-actions.mjs [dir-or-file ...]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const USES = /^\s*-?\s*uses:\s*['"]?([^'"\s#]+)/;

/** Returns human-readable violations for one YAML document. */
export function findUnpinnedActions(yaml, file = '<input>') {
  const violations = [];
  yaml.split(/\r?\n/).forEach((line, index) => {
    const match = USES.exec(line);
    if (!match) return;
    const ref = match[1];
    if (ref.startsWith('./')) return;
    if (ref.startsWith('docker://')) {
      if (!/@sha256:[a-f0-9]{64}$/.test(ref)) {
        violations.push(`${file}:${index + 1} docker action without digest: ${ref}`);
      }
      return;
    }
    const at = ref.lastIndexOf('@');
    const version = at === -1 ? '' : ref.slice(at + 1);
    if (!/^[a-f0-9]{40}$/.test(version)) {
      violations.push(`${file}:${index + 1} not pinned to a commit SHA: ${ref}`);
    }
  });
  return violations;
}

function yamlFiles(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return yamlFiles(full);
    return /\.ya?ml$/.test(entry.name) ? [full] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  const files = (targets.length ? targets : ['.github/workflows', '.github/actions']).flatMap(
    yamlFiles,
  );
  const violations = files.flatMap((file) => findUnpinnedActions(readFileSync(file, 'utf8'), file));
  for (const v of violations) console.error(v);
  console.log(`${files.length} files checked, ${violations.length} unpinned action references`);
  process.exit(violations.length === 0 ? 0 : 1);
}
