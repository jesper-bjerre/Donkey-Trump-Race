import { describe, expect, it } from 'vitest';
import { FIXTURES, replayRescueOrderingFixture } from './fixtures/index.js';
import rescueOrderingExpected from './fixtures/expected/rescueOrdering.expected.json' with { type: 'json' };

describe('rescue ordering fixture', () => {
  it('orders by server tick first and player slot second', () => {
    const ranked = replayRescueOrderingFixture(FIXTURES.rescueOrdering);
    expect(ranked).toEqual(rescueOrderingExpected);
    expect(ranked.map((r) => r.playerSlot)).toEqual([4, 1, 3, 0]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('does not depend on candidate order', () => {
    const reversed = {
      ...FIXTURES.rescueOrdering,
      candidates: [...FIXTURES.rescueOrdering.candidates].reverse(),
    };
    expect(replayRescueOrderingFixture(reversed)).toEqual(rescueOrderingExpected);
  });
});
