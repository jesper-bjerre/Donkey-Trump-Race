import { describe, expect, it } from 'vitest';
import { getPlayableBounds, MVP_VERTICAL_MAP } from '@dtr/shared-level';
import { JUMP_APEX, PLAYER_RADIUS } from '../src/index.js';
import { MOVEMENT_FIXTURES, replayMovementFixture } from './fixtures/index.js';
import halfHeightJumpExpected from './fixtures/expected/halfHeightJump.expected.json' with { type: 'json' };
import ladderTraversalExpected from './fixtures/expected/ladderTraversal.expected.json' with { type: 'json' };
import leftWallBlockExpected from './fixtures/expected/leftWallBlock.expected.json' with { type: 'json' };
import rightEdgeFallExpected from './fixtures/expected/rightEdgeFall.expected.json' with { type: 'json' };

const expected: Record<string, unknown> = {
  halfHeightJump: halfHeightJumpExpected,
  ladderTraversal: ladderTraversalExpected,
  leftWallBlock: leftWallBlockExpected,
  rightEdgeFall: rightEdgeFallExpected,
};

describe('deterministic movement fixtures', () => {
  for (const name of Object.keys(expected)) {
    it(`replays ${name} to the committed expected state`, () => {
      expect(replayMovementFixture(MOVEMENT_FIXTURES[name]!)).toEqual(expected[name]);
    });
  }

  it('halfHeightJump never reaches the next floor', () => {
    const replay = replayMovementFixture(MOVEMENT_FIXTURES.halfHeightJump!);
    expect(replay.maxY).toBeLessThanOrEqual(JUMP_APEX + 1e-6);
    expect(replay.maxY).toBeLessThan(MVP_VERTICAL_MAP.floors[1]!.y);
    expect(replay.finalState.floor).toBe(0);
  });

  it('ladderTraversal climbs to floor 1 inside the ladder volume', () => {
    const replay = replayMovementFixture(MOVEMENT_FIXTURES.ladderTraversal!);
    expect(replay.events.startedClimb).toBe(1);
    expect(replay.finalState.floor).toBe(1);
    expect(replay.finalState.y).toBe(MVP_VERTICAL_MAP.floors[1]!.y);
  });

  it('leftWallBlock clamps x to the left wall', () => {
    const replay = replayMovementFixture(MOVEMENT_FIXTURES.leftWallBlock!);
    expect(replay.finalState.x).toBe(getPlayableBounds(MVP_VERTICAL_MAP).leftWallX + PLAYER_RADIUS);
  });

  it('rightEdgeFall confirms a fall beyond the fall edge', () => {
    const replay = replayMovementFixture(MOVEMENT_FIXTURES.rightEdgeFall!);
    expect(replay.firstFallTick).not.toBeNull();
    expect(replay.finalState.x).toBeGreaterThan(getPlayableBounds(MVP_VERTICAL_MAP).rightFallEdgeX);
  });
});
