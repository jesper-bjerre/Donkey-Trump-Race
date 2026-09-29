import { describe, expect, it } from 'vitest';
import { MOVEMENT_FIXTURES, replayMovementFixture } from './fixtures/index.js';
import verticalTraversalExpected from './fixtures/expected/verticalTraversal.expected.json' with { type: 'json' };

describe('levelIntegration', () => {
  it('replays the committed vertical traversal command sequence exactly', () => {
    const replay = replayMovementFixture(MOVEMENT_FIXTURES.verticalTraversal!);
    expect(replay).toEqual(verticalTraversalExpected);
    expect(replay.finalState.floor).toBe(2);
    expect(replay.events.finishedClimb).toBe(2);
  });
});
