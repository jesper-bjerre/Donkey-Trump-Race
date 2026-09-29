import { describe, expect, it } from 'vitest';
import { MVP_ITEM_PICKUP_VOLUMES } from '@dtr/shared-items';
import { FIXTURES, replayItemPickupFixture } from './fixtures/index.js';
import itemPickupExpected from './fixtures/expected/itemPickup.expected.json' with { type: 'json' };

describe('item pickup fixture', () => {
  it('intersects the configured pickup volume at the expected server tick', () => {
    const replay = replayItemPickupFixture(FIXTURES.itemPickup);
    expect(replay).toEqual(itemPickupExpected);
    expect(MVP_ITEM_PICKUP_VOLUMES.map((v) => v.id)).toContain(replay.volumeId);
  });
});
