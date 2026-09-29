import { randomBytes, randomInt } from 'node:crypto';
import {
  colorForSlot,
  GameError,
  isValidNickname,
  isValidRoomCode,
  MAX_PLAYERS,
  normalizeNickname,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  type LobbyPlayer,
  type PlayerColorId,
  type Role,
  type RoomState,
} from '@dtr/shared-protocol';

export { MAX_PLAYERS };
export const MIN_PLAYERS = 2;
export const LOBBY_IDLE_TTL_MS = 15 * 60 * 1000;
export const POST_MATCH_TTL_MS = 5 * 60 * 1000;
export const RECONNECT_GRACE_MS = 60 * 1000;
const EXPIRED_CODE_MEMORY_MS = 60 * 60 * 1000;

export interface PlayerSlot {
  id: string;
  slotIndex: number;
  nickname: string;
  color: PlayerColorId;
  role: Role;
  ready: boolean;
  connected: boolean;
  /** When the player last lost (or has not yet opened) its connection; null while connected. */
  disconnectedAt: number | null;
  joinedAt: number;
  /** First realtime attach; null until the player's WebSocket has said hello once. */
  firstConnectedAt: number | null;
}

export interface Room {
  code: string;
  state: RoomState;
  hostId: string;
  slots: Map<string, PlayerSlot>;
  createdAt: number;
  lastActivityAt: number;
  /** Set when the last match ended; drives the shorter post-match TTL. */
  lastMatchEndedAt: number | null;
  matchCount: number;
}

export interface RoomManagerOptions {
  now?: () => number;
  allowSolo?: boolean;
  generateCode?: () => string;
}

function defaultCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

function newPlayerId(): string {
  return `p_${randomBytes(6).toString('hex')}`;
}

export function toLobbyPlayer(slot: PlayerSlot): LobbyPlayer {
  return {
    id: slot.id,
    slotIndex: slot.slotIndex,
    nickname: slot.nickname,
    color: slot.color,
    role: slot.role,
    ready: slot.ready,
    connected: slot.connected,
  };
}

/** Framework-free, in-memory lifecycle of guest rooms and their five player slots. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly expiredCodes = new Map<string, number>();
  private readonly now: () => number;
  private readonly generateCode: () => string;
  readonly allowSolo: boolean;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.generateCode = options.generateCode ?? defaultCode;
    this.allowSolo = options.allowSolo ?? false;
  }

  get minPlayers(): number {
    return this.allowSolo ? 1 : MIN_PLAYERS;
  }

  createRoom(rawNickname: string): { room: Room; player: PlayerSlot } {
    const nickname = this.requireNickname(rawNickname);
    let code = this.generateCode();
    for (let attempts = 0; this.rooms.has(code) || this.expiredCodes.has(code); attempts++) {
      if (attempts > 50) throw new GameError('INTERNAL_ERROR');
      code = this.generateCode();
    }
    const now = this.now();
    const room: Room = {
      code,
      state: 'lobby',
      hostId: '',
      slots: new Map(),
      createdAt: now,
      lastActivityAt: now,
      lastMatchEndedAt: null,
      matchCount: 0,
    };
    const player = this.addSlot(room, nickname, 'host');
    room.hostId = player.id;
    this.rooms.set(code, room);
    return { room, player };
  }

  joinRoom(rawCode: string, rawNickname: string): { room: Room; player: PlayerSlot } {
    const room = this.requireRoom(rawCode);
    const nickname = this.requireNickname(rawNickname);
    if (room.state === 'in_progress') throw new GameError('ROOM_IN_PROGRESS');
    // Reserved (disconnected, within grace) slots still count toward capacity.
    if (room.slots.size >= MAX_PLAYERS) throw new GameError('ROOM_FULL');
    const player = this.addSlot(room, nickname, 'participant');
    room.lastActivityAt = this.now();
    return { room, player };
  }

  getRoom(rawCode: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(rawCode));
  }

  requireRoom(rawCode: string): Room {
    if (!isValidRoomCode(rawCode)) throw new GameError('INVALID_ROOM_CODE');
    const code = normalizeRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (room) return room;
    if (this.expiredCodes.has(code)) throw new GameError('ROOM_EXPIRED');
    throw new GameError('ROOM_NOT_FOUND');
  }

  getSlot(code: string, playerId: string): PlayerSlot | undefined {
    return this.rooms.get(code)?.slots.get(playerId);
  }

  setReady(code: string, playerId: string, ready: boolean): void {
    const room = this.rooms.get(code);
    const slot = room?.slots.get(playerId);
    if (!room || !slot || room.state !== 'lobby') return;
    slot.ready = ready;
    room.lastActivityAt = this.now();
  }

  /**
   * Claims a slot for a (re)connecting socket. The reconnect grace is enforced here, at
   * the moment of the attempt, rather than waiting for the next sweep: a slot whose
   * owner has been gone for RECONNECT_GRACE_MS or longer is released and refused.
   */
  claimSlot(
    rawCode: string,
    playerId: string,
  ): { room: Room; slot: PlayerSlot; offlineMs: number | null; firstConnect: boolean } {
    const code = normalizeRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) {
      throw new GameError(this.expiredCodes.has(code) ? 'ROOM_EXPIRED' : 'ROOM_NOT_FOUND');
    }
    const slot = room.slots.get(playerId);
    if (!slot) throw new GameError('RECONNECT_EXPIRED');
    const now = this.now();
    if (!slot.connected && slot.disconnectedAt !== null) {
      if (now - slot.disconnectedAt >= RECONNECT_GRACE_MS) {
        this.releaseDisconnectedSlot(code, playerId);
        throw new GameError('RECONNECT_EXPIRED');
      }
    }
    const firstConnect = slot.firstConnectedAt === null;
    const offlineMs =
      !firstConnect && slot.disconnectedAt !== null ? now - slot.disconnectedAt : null;
    slot.connected = true;
    slot.disconnectedAt = null;
    if (firstConnect) slot.firstConnectedAt = now;
    return { room, slot, offlineMs, firstConnect };
  }

  markConnected(code: string, playerId: string): void {
    const slot = this.getSlot(code, playerId);
    if (!slot) return;
    slot.connected = true;
    slot.disconnectedAt = null;
    slot.firstConnectedAt ??= this.now();
  }

  markDisconnected(code: string, playerId: string): void {
    const slot = this.getSlot(code, playerId);
    if (!slot) return;
    slot.connected = false;
    slot.disconnectedAt = this.now();
  }

  /** Validates host authority, player count and readiness, then moves the room into a match. */
  startRoom(code: string, playerId: string): Room {
    const room = this.requireRoom(code);
    if (room.hostId !== playerId) throw new GameError('TOKEN_FORBIDDEN');
    if (room.state === 'in_progress') throw new GameError('ROOM_IN_PROGRESS');
    // Every slot still in the room counts: stale ones are released by sweep() after the grace period.
    const present = [...room.slots.values()];
    if (present.length < this.minPlayers) throw new GameError('NOT_ENOUGH_PLAYERS');
    if (present.some((s) => s.id !== room.hostId && !s.ready))
      throw new GameError('PLAYERS_NOT_READY');
    room.state = 'in_progress';
    room.matchCount += 1;
    room.lastActivityAt = this.now();
    return room;
  }

  /**
   * Host-initiated rematch from the results screen: everyone still in the room is
   * treated as ready, then the normal start rules (host, player count) apply.
   */
  replayRoom(code: string, playerId: string): Room {
    const room = this.requireRoom(code);
    if (room.hostId !== playerId) throw new GameError('TOKEN_FORBIDDEN');
    if (room.state === 'in_progress') throw new GameError('ROOM_IN_PROGRESS');
    if (room.lastMatchEndedAt === null) throw new GameError('BAD_REQUEST');
    for (const slot of room.slots.values()) slot.ready = true;
    return this.startRoom(code, playerId);
  }

  endMatch(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const now = this.now();
    room.state = 'lobby';
    room.lastMatchEndedAt = now;
    room.lastActivityAt = now;
    for (const slot of room.slots.values()) slot.ready = false;
  }

  /** Frees a disconnected slot once its reconnect grace has elapsed. Returns true if freed. */
  releaseDisconnectedSlot(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    const slot = room?.slots.get(playerId);
    if (!room || !slot || slot.connected || slot.disconnectedAt === null) return false;
    if (this.now() - slot.disconnectedAt < RECONNECT_GRACE_MS) return false;
    room.slots.delete(playerId);
    if (room.hostId === playerId) {
      const next = [...room.slots.values()].sort((a, b) => a.slotIndex - b.slotIndex)[0];
      if (next) {
        next.role = 'host';
        room.hostId = next.id;
      }
    }
    if (room.slots.size === 0) this.expireRoom(code);
    return true;
  }

  /** Releases stale slots and expires idle rooms. Returns affected room codes. */
  sweep(): {
    expired: string[];
    changed: string[];
    released: Array<{ code: string; playerId: string }>;
  } {
    const now = this.now();
    const expired: string[] = [];
    const changed: string[] = [];
    const released: Array<{ code: string; playerId: string }> = [];
    for (const [code, room] of this.rooms) {
      for (const slot of [...room.slots.values()]) {
        if (this.releaseDisconnectedSlot(code, slot.id)) {
          released.push({ code, playerId: slot.id });
          if (!changed.includes(code)) changed.push(code);
        }
      }
      if (!this.rooms.has(code)) {
        expired.push(code);
        continue;
      }
      if (room.state !== 'lobby') continue;
      const idleSinceMatchEnd =
        room.lastMatchEndedAt !== null && room.lastActivityAt === room.lastMatchEndedAt;
      const ttl = idleSinceMatchEnd ? POST_MATCH_TTL_MS : LOBBY_IDLE_TTL_MS;
      if (now - room.lastActivityAt >= ttl) {
        this.expireRoom(code);
        expired.push(code);
      }
    }
    for (const [code, at] of this.expiredCodes) {
      if (now - at > EXPIRED_CODE_MEMORY_MS) this.expiredCodes.delete(code);
    }
    return { expired, changed: changed.filter((c) => !expired.includes(c)), released };
  }

  expireRoom(code: string): void {
    if (this.rooms.delete(code)) this.expiredCodes.set(code, this.now());
  }

  roomCount(): number {
    return this.rooms.size;
  }

  lobbyPlayers(room: Room): LobbyPlayer[] {
    return [...room.slots.values()].sort((a, b) => a.slotIndex - b.slotIndex).map(toLobbyPlayer);
  }

  private requireNickname(raw: string): string {
    if (typeof raw !== 'string' || !isValidNickname(raw)) throw new GameError('INVALID_NICKNAME');
    return normalizeNickname(raw);
  }

  private addSlot(room: Room, nickname: string, role: Role): PlayerSlot {
    const used = new Set([...room.slots.values()].map((s) => s.slotIndex));
    let slotIndex = 0;
    while (used.has(slotIndex)) slotIndex++;
    if (slotIndex >= MAX_PLAYERS) throw new GameError('ROOM_FULL');
    const slot: PlayerSlot = {
      id: newPlayerId(),
      slotIndex,
      nickname,
      color: colorForSlot(slotIndex).id,
      role,
      ready: role === 'host',
      connected: false,
      // Counts as disconnected until the WebSocket attaches, so abandoned joins are released.
      disconnectedAt: this.now(),
      joinedAt: this.now(),
      firstConnectedAt: null,
    };
    room.slots.set(slot.id, slot);
    return slot;
  }
}
