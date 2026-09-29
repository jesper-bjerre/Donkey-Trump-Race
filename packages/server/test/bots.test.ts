import { describe, expect, it } from 'vitest';
import { MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import { PLAYER_COLOR_IDS, validateAuthoritativeSnapshot } from '@dtr/shared-protocol';
import { MatchRunner } from '../src/game/MatchRunner.js';
import { MAX_PLAYERS, RECONNECT_GRACE_MS, RoomManager } from '../src/room/RoomManager.js';

function botRooms() {
  let now = 1_000_000;
  const rooms = new RoomManager({ now: () => now, fillWithBots: true });
  return { rooms, advance: (ms: number) => (now += ms) };
}

describe('computer players in the lobby', () => {
  it('fills a new room up to five racers', () => {
    const { rooms } = botRooms();
    const { room, player } = rooms.createRoom('LarsFan');
    const roster = rooms.lobbyPlayers(room);
    expect(roster).toHaveLength(MAX_PLAYERS);
    expect(roster.filter((p) => p.isBot)).toHaveLength(MAX_PLAYERS - 1);
    expect(roster.filter((p) => p.isBot).every((p) => p.ready && p.connected)).toBe(true);
    expect(new Set(roster.map((p) => p.color)).size).toBe(MAX_PLAYERS);
    expect(roster[0]).toMatchObject({ id: player.id, slotIndex: 0 });
  });

  it('replaces a bot when a human joins, and brings it back when the human leaves', () => {
    const { rooms, advance } = botRooms();
    const { room } = rooms.createRoom('Host');
    rooms.markConnected(room.code, room.hostId);
    const { player: guest } = rooms.joinRoom(room.code, 'Mette');
    let roster = rooms.lobbyPlayers(room);
    expect(roster).toHaveLength(MAX_PLAYERS);
    expect(roster.find((p) => p.slotIndex === guest.slotIndex)).toMatchObject({
      id: guest.id,
      nickname: 'Mette',
    });
    expect(roster.filter((p) => p.isBot)).toHaveLength(MAX_PLAYERS - 2);

    advance(RECONNECT_GRACE_MS);
    rooms.sweep();
    roster = rooms.lobbyPlayers(room);
    expect(roster.find((p) => p.slotIndex === guest.slotIndex)?.isBot).toBe(true);
  });

  it('still admits five humans and then reports the room full', () => {
    const { rooms } = botRooms();
    const { room } = rooms.createRoom('Host');
    for (let i = 0; i < 4; i++) rooms.joinRoom(room.code, `Guest ${i}`);
    expect(rooms.botSlots(room)).toEqual([]);
    expect(() => rooms.joinRoom(room.code, 'Sixth')).toThrow();
  });

  it('lets a lone host start a race against the bots', () => {
    const { rooms } = botRooms();
    const { room, player } = rooms.createRoom('Solo');
    expect(rooms.startRoom(room.code, player.id).state).toBe('in_progress');
  });
});

describe('computer players in a match', () => {
  function botMatch(seed = 99) {
    const players = PLAYER_COLOR_IDS.map((color, i) => ({
      id: i === 0 ? 'human' : `bot_${i}`,
      slotIndex: i,
      nickname: `P${i}`,
      color,
      connected: true,
      isBot: i !== 0,
    }));
    return new MatchRunner({ matchId: 'm_bots', level: LEVEL, players, seed, countdownMs: 0 });
  }

  it('drives bots up the tower on their own and marks them in snapshots', () => {
    const match = botMatch();
    const start = match.snapshot().players.filter((p) => p.isBot);
    for (let t = 0; t < 60 * 20; t++) match.advanceTick();
    const snapshot = match.snapshot();
    expect(validateAuthoritativeSnapshot(snapshot)).not.toBeNull();
    const bots = snapshot.players.filter((p) => p.isBot);
    expect(bots).toHaveLength(4);
    expect(snapshot.players.find((p) => p.id === 'human')?.isBot).toBeUndefined();
    for (const bot of bots) {
      const before = start.find((p) => p.id === bot.id)!;
      expect(bot.progress).toBeGreaterThan(before.progress);
    }
  });

  it('lets bots finish the race', () => {
    const match = botMatch();
    for (let t = 0; t < 60 * 240 && match.result().finishOrder.length === 0; t++)
      match.advanceTick();
    expect(match.result().finishOrder[0]?.playerId).toMatch(/^bot_/);
  });

  it('ends when the only human disconnects, even with bots still racing', () => {
    const match = botMatch();
    for (let t = 0; t < 60; t++) match.advanceTick();
    match.setConnected('human', false);
    match.advanceTick();
    expect(match.isFinished()).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const match = botMatch(7);
      for (let t = 0; t < 60 * 15; t++) match.advanceTick();
      return match.snapshot();
    };
    expect(run()).toEqual(run());
  });
});
