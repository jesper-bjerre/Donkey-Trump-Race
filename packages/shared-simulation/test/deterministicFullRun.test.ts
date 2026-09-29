import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSimulationFixtures } from './fixtures/index.js';

const expectedDir = new URL('./fixtures/expected/', import.meta.url);

describe('deterministicFullRun', () => {
  it('replays level, movement, item, stun and rescue fixtures identically twice', () => {
    const first = buildSimulationFixtures();
    const second = buildSimulationFixtures();
    expect(second).toEqual(first);
  });

  it('matches every committed expected output', () => {
    const { expected } = buildSimulationFixtures();
    for (const [name, value] of Object.entries(expected)) {
      const committed = JSON.parse(
        readFileSync(new URL(`${name}.expected.json`, expectedDir), 'utf8'),
      );
      expect(value, name).toEqual(committed);
    }
  });

  it('does not import server, React, Three.js or WebSocket modules', () => {
    const source = readFileSync(new URL('./fixtures/index.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from '(ws|react|three|fastify|@dtr\/server)/);
  });
});
