import { describe, expect, it } from 'vitest';
import { STUN_MS } from '../src/index.js';
import { FIXTURES, replayBarrelStunFixture } from './fixtures/index.js';
import barrelStunExpected from './fixtures/expected/barrelStun.expected.json' with { type: 'json' };

describe('barrel stun fixture', () => {
  const replay = replayBarrelStunFixture(FIXTURES.barrelStun);

  it('stuns for exactly 2000 ms', () => {
    expect(replay.stunnedUntilMs - replay.hitAtMs).toBe(2000);
    expect(STUN_MS).toBe(2000);
    expect(replay).toEqual(barrelStunExpected);
  });

  it('rejects movement before stunnedUntilMs and accepts it after', () => {
    for (const input of replay.inputs) {
      expect(input.accepted, `input at ${input.atMs}`).toBe(input.atMs >= replay.stunnedUntilMs);
    }
  });
});
