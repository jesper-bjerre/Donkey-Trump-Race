import { afterEach, describe, expect, it } from 'vitest';
import { MVP_VERTICAL_MAP as LEVEL, getFloorById } from '@dtr/shared-level';
import { COUNTDOWN_MS, createMotionState, TICK_MS } from '@dtr/shared-simulation';
import type { GameServer } from '../src/server.js';
import { createTestServer, recordingTelemetry } from './helpers.js';

let server: GameServer;
afterEach(async () => {
  await server?.close();
});

async function soloMatch() {
  const telemetry = recordingTelemetry();
  server = await createTestServer({ allowSolo: true }, { telemetry });
  const session = server.game.createRoom('Solo', 'ws://test/ws');
  server.game.startMatch(session.roomCode, session.playerId);
  const match = server.game.getMatch(session.roomCode)!;
  // No socket in this test: mark the player online so the match does not end as abandoned.
  match.setConnected(session.playerId, true);
  server.game.advance(Math.ceil(COUNTDOWN_MS / TICK_MS) + 1);
  match.bossSystem.barrels.length = 0;
  return { telemetry, match, player: match.debugPlayer(session.playerId)!, session };
}

describe('gameplay telemetry emitted by the server', () => {
  it('publishes barrel hits, falls, item uses and rescues without identifiers', async () => {
    const { telemetry, match, player, session } = await soloMatch();

    player.motion = createMotionState(20, 0, 0, 0);
    match.bossSystem.spawnBarrelAt(20.5, 0, 0, -5);
    server.game.advance(1);
    expect(telemetry.publisher.named('barrel_hit')[0]?.payload).toEqual({
      slotIndex: 0,
      blocked: false,
    });

    match.bossSystem.barrels.length = 0;
    player.movementDisabledUntilMs = 0;
    player.knockedDown = false;
    player.heldItem = 'speedBoost';
    match.requestUseItem(session.playerId);
    server.game.advance(1);
    expect(telemetry.publisher.named('item_use')[0]?.payload).toEqual({
      slotIndex: 0,
      item: 'speedBoost',
    });

    player.motion = { ...createMotionState(LEVEL.bounds.rightFallEdgeX + 1, 4, 0, 1) };
    player.motion.grounded = false;
    server.game.advance(60);
    expect(telemetry.publisher.named('fall')).toHaveLength(1);

    const rescueFloor = getFloorById(LEVEL, LEVEL.rescueZone.floorId);
    player.movementDisabledUntilMs = 0;
    player.motion = createMotionState(
      LEVEL.rescueZone.minX + 1,
      rescueFloor.y,
      0,
      rescueFloor.index,
    );
    server.game.advance(1);
    const rescue = telemetry.publisher.named('rescue_complete')[0];
    expect(rescue?.payload).toMatchObject({ slotIndex: 0, rank: 1 });
    expect(rescue?.payload.raceTimeMs).toBeGreaterThan(0);
    expect(telemetry.publisher.named('match_end')[0]?.payload).toMatchObject({
      outcome: 'completed',
      finishers: 1,
    });

    const serialized = JSON.stringify(telemetry.publisher.events);
    expect(serialized).not.toContain(session.roomCode);
    expect(serialized).not.toContain(session.playerId);
    expect(serialized).not.toContain('Solo');
    expect(telemetry.publisher.failures).toEqual([]);
  });
});
