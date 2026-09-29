import { describe, expect, it } from 'vitest';
import { GameError, PLAYER_COLOR_IDS } from '@dtr/shared-protocol';
import {
  LOBBY_IDLE_TTL_MS,
  MAX_PLAYERS,
  POST_MATCH_TTL_MS,
  RECONNECT_GRACE_MS,
  RoomManager,
} from '../src/room/RoomManager.js';

function setup(allowSolo = false) {
  let now = 1_000_000;
  const clock = {
    advance: (ms: number) => {
      now += ms;
    },
  };
  const rooms = new RoomManager({ now: () => now, allowSolo });
  return { rooms, clock };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof GameError) return error.code;
    throw error;
  }
  return undefined;
}

describe('RoomManager', () => {
  it('creates a room with a single host', () => {
    const { rooms } = setup();
    const { room, player } = rooms.createRoom('LarsFan');
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(player.role).toBe('host');
    expect(room.hostId).toBe(player.id);
    const { player: guest } = rooms.joinRoom(room.code, 'Mette');
    expect(guest.role).toBe('participant');
    expect(room.hostId).toBe(player.id);
  });

  it('fills 5 slots with 5 distinct colors and rejects the sixth', () => {
    const { rooms } = setup();
    const { room } = rooms.createRoom('Host');
    for (let i = 0; i < 4; i++) rooms.joinRoom(room.code, `Guest ${i}`);
    const colors = [...room.slots.values()].map((s) => s.color);
    expect(new Set(colors).size).toBe(MAX_PLAYERS);
    expect(colors.every((c) => PLAYER_COLOR_IDS.includes(c))).toBe(true);
    expect(codeOf(() => rooms.joinRoom(room.code, 'Sixth'))).toBe('ROOM_FULL');
  });

  it('keeps Danish characters in nicknames and rejects symbols', () => {
    const { rooms } = setup();
    expect(rooms.createRoom('  Jumpman   Løkke ').player.nickname).toBe('Jumpman Løkke');
    expect(codeOf(() => rooms.createRoom('<b>hi</b>'))).toBe('INVALID_NICKNAME');
  });

  it('distinguishes invalid, missing and expired room codes', () => {
    const { rooms, clock } = setup();
    expect(codeOf(() => rooms.joinRoom('nope', 'Guest'))).toBe('INVALID_ROOM_CODE');
    expect(codeOf(() => rooms.joinRoom('ZZZZZ', 'Guest'))).toBe('ROOM_NOT_FOUND');
    const { room } = rooms.createRoom('Host');
    rooms.markConnected(room.code, room.hostId);
    clock.advance(LOBBY_IDLE_TTL_MS);
    expect(rooms.sweep().expired).toEqual([room.code]);
    expect(codeOf(() => rooms.joinRoom(room.code, 'Guest'))).toBe('ROOM_EXPIRED');
  });

  it('only lets the host start, with enough ready players', () => {
    const { rooms } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    expect(codeOf(() => rooms.startRoom(room.code, host.id))).toBe('NOT_ENOUGH_PLAYERS');
    const { player: guest } = rooms.joinRoom(room.code, 'Guest');
    expect(codeOf(() => rooms.startRoom(room.code, guest.id))).toBe('TOKEN_FORBIDDEN');
    expect(codeOf(() => rooms.startRoom(room.code, host.id))).toBe('PLAYERS_NOT_READY');
    rooms.setReady(room.code, guest.id, true);
    expect(rooms.startRoom(room.code, host.id).state).toBe('in_progress');
    expect(codeOf(() => rooms.joinRoom(room.code, 'Late'))).toBe('ROOM_IN_PROGRESS');
    expect(codeOf(() => rooms.startRoom(room.code, host.id))).toBe('ROOM_IN_PROGRESS');
  });

  it('allows a solo start in test mode', () => {
    const { rooms } = setup(true);
    const { room, player } = rooms.createRoom('Solo');
    expect(rooms.startRoom(room.code, player.id).state).toBe('in_progress');
  });

  it('reserves a disconnected slot for the reconnect grace period', () => {
    const { rooms, clock } = setup();
    const { room } = rooms.createRoom('Host');
    const { player } = rooms.joinRoom(room.code, 'Guest');
    for (let i = 0; i < 3; i++) rooms.joinRoom(room.code, `Other ${i}`);
    for (const slot of room.slots.values()) rooms.markConnected(room.code, slot.id);
    rooms.markDisconnected(room.code, player.id);

    clock.advance(RECONNECT_GRACE_MS - 1);
    expect(rooms.releaseDisconnectedSlot(room.code, player.id)).toBe(false);
    expect(codeOf(() => rooms.joinRoom(room.code, 'Sneaky'))).toBe('ROOM_FULL');

    clock.advance(1);
    expect(rooms.releaseDisconnectedSlot(room.code, player.id)).toBe(true);
    expect(rooms.joinRoom(room.code, 'Newcomer').player.slotIndex).toBe(player.slotIndex);
  });

  it('transfers host when the host slot is released', () => {
    const { rooms, clock } = setup();
    const { room, player: host } = rooms.createRoom('Host');
    const { player: guest } = rooms.joinRoom(room.code, 'Guest');
    rooms.markConnected(room.code, guest.id);
    clock.advance(RECONNECT_GRACE_MS);
    rooms.sweep();
    expect(room.slots.has(host.id)).toBe(false);
    expect(room.hostId).toBe(guest.id);
    expect(guest.role).toBe('host');
  });

  it('expires rooms 5 minutes after a match ends', () => {
    const { rooms, clock } = setup(true);
    const { room, player } = rooms.createRoom('Host');
    rooms.markConnected(room.code, player.id);
    rooms.startRoom(room.code, player.id);
    rooms.endMatch(room.code);
    clock.advance(POST_MATCH_TTL_MS - 1);
    expect(rooms.sweep().expired).toEqual([]);
    clock.advance(1);
    expect(rooms.sweep().expired).toEqual([room.code]);
  });
});
