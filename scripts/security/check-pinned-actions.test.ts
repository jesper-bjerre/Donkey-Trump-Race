import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without type declarations
import { findUnpinnedActions } from './check-pinned-actions.mjs';

const fixture = (name: string) =>
  readFileSync(new URL(`../../tests/fixtures/security/${name}`, import.meta.url), 'utf8');

describe('pinned action check', () => {
  it('accepts SHA-pinned, local and digest-pinned docker actions', () => {
    expect(findUnpinnedActions(fixture('pinned-workflow.yml'), 'pinned')).toEqual([]);
  });

  it('flags tags, branches and docker tags', () => {
    expect(findUnpinnedActions(fixture('unpinned-workflow.yml'), 'unpinned')).toEqual([
      'unpinned:7 not pinned to a commit SHA: actions/checkout@v5',
      'unpinned:8 not pinned to a commit SHA: some-org/some-action@main',
      'unpinned:9 docker action without digest: docker://alpine:3.20',
    ]);
  });

  it('keeps every repository workflow pinned', () => {
    for (const file of ['validate.yml', 'deploy.yml', 'security.yml', 'deploy-staging-smoke.yml']) {
      const yaml = readFileSync(
        new URL(`../../.github/workflows/${file}`, import.meta.url),
        'utf8',
      );
      expect(findUnpinnedActions(yaml, file)).toEqual([]);
    }
  });
});
