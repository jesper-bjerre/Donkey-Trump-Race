import { describe, expect, it } from 'vitest';
import { GameError } from '@dtr/shared-protocol';
import { LOBBY_IDLE_TTL_MS, RECONNECT_GRACE_MS, RoomManager } from '../src/room/RoomManager.js';
import { createFakeClock, FIVE_PLAYER_NICKNAMES } from './fixtures/roomFixtures.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof GameError) return error.code;
    throw error;
  }
  return undefined;
}

function setup() {
  const clock = createFakeClock();
  const rooms = new RoomManager({ now: clock.now });
  return { rooms, clock };
}

describe('RoomManager lifecycle', () => {
  it('expires an idle lobby after exactly 15 minutes', () => {
    const { rooms, clock } = setup();
    const { room, player } = rooms.createRoom(FIVE_PLAYER_NICKNAMES[0]!);
    rooms.claimSlot(room.code, player.id);
    clock.advance(LOBBY_IDLE_TTL_MS - 1);
    expect(rooms.sweep().expired).toEqual([]);
    clock.advance(1);
    expect(rooms.sweep().expired).toEqual([room.code]);
    expect(codeOf(() => rooms.joinRoom(room.code, 'Late'))).toBe('ROOM_EXPIRED');
  });

  it('keeps an active lobby alive while players interact', () => {
    const { rooms, clock } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    const { player } = rooms.joinRoom(room.code, 'Guest');
    rooms.claimSlot(room.code, host.id);
    rooms.claimSlot(room.code, player.id);
    clock.advance(LOBBY_IDLE_TTL_MS - 1000);
    rooms.setReady(room.code, player.id, true);
    clock.advance(2000);
    expect(rooms.sweep().expired).toEqual([]);
  });

  it('lets a player reclaim a slot within the 60 s reconnect grace', () => {
    const { rooms, clock } = setup();
    const { room, player } = rooms.createRoom('Host');
    expect(rooms.claimSlot(room.code, player.id).firstConnect).toBe(true);
    rooms.markDisconnected(room.code, player.id);
    clock.advance(RECONNECT_GRACE_MS - 1);
    const claim = rooms.claimSlot(room.code, player.id);
    expect(claim.firstConnect).toBe(false);
    expect(claim.offlineMs).toBe(RECONNECT_GRACE_MS - 1);
  });

  it('rejects a reconnect at 61 s immediately, without waiting for the sweep', () => {
    const { rooms, clock } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    const { player } = rooms.joinRoom(room.code, 'Guest');
    rooms.claimSlot(room.code, host.id);
    rooms.claimSlot(room.code, player.id);
    rooms.markDisconnected(room.code, player.id);
    clock.advance(61_000);
    expect(codeOf(() => rooms.claimSlot(room.code, player.id))).toBe('RECONNECT_EXPIRED');
    // The slot is released, so a newcomer can take it.
    expect(room.slots.has(player.id)).toBe(false);
    expect(rooms.joinRoom(room.code, 'Newcomer').player.slotIndex).toBe(player.slotIndex);
  });

  it('releases a slot whose socket never connected once the grace has passed', () => {
    const { rooms, clock } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    rooms.claimSlot(room.code, host.id);
    const { player } = rooms.joinRoom(room.code, 'Abandoned');
    clock.advance(RECONNECT_GRACE_MS);
    expect(rooms.sweep().released).toEqual([{ code: room.code, playerId: player.id }]);
  });

  it('refuses a claim for a room that expired or never existed', () => {
    const { rooms } = setup();
    const { room, player } = rooms.createRoom('Host');
    rooms.expireRoom(room.code);
    expect(codeOf(() => rooms.claimSlot(room.code, player.id))).toBe('ROOM_EXPIRED');
    expect(codeOf(() => rooms.claimSlot('ZZZZZ', player.id))).toBe('ROOM_NOT_FOUND');
  });

  it('allows a host replay after a match without the ready gate', () => {
    const { rooms } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    const { player: guest } = rooms.joinRoom(room.code, 'Guest');
    expect(codeOf(() => rooms.replayRoom(room.code, host.id))).toBe('BAD_REQUEST');
    rooms.setReady(room.code, guest.id, true);
    rooms.startRoom(room.code, host.id);
    rooms.endMatch(room.code);
    expect(room.slots.get(guest.id)!.ready).toBe(false);
    expect(codeOf(() => rooms.replayRoom(room.code, guest.id))).toBe('TOKEN_FORBIDDEN');
    expect(rooms.replayRoom(room.code, host.id).state).toBe('in_progress');
    expect(codeOf(() => rooms.replayRoom(room.code, host.id))).toBe('ROOM_IN_PROGRESS');
  });
});
