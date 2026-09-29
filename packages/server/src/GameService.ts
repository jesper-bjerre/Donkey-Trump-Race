import { randomBytes, randomInt } from 'node:crypto';
import { MVP_VERTICAL_MAP } from '@dtr/shared-level';
import {
  CLOSE_CODES,
  encodeServerMessage,
  MAX_PLAYERS,
  type ClientMessage,
  type RoomSession,
  type RoomStatus,
  type ServerMessageBody,
  type StartMatchResponse,
} from '@dtr/shared-protocol';
import { TICK_MS } from '@dtr/shared-simulation';
import type { RoomTokenService } from './auth/roomTokens.js';
import { MatchRunner } from './game/MatchRunner.js';
import { RoomManager, type PlayerSlot, type Room } from './room/RoomManager.js';

const TOKEN_REFRESH_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5000;
const MAX_TICKS_PER_LOOP = 8;

export interface Connection {
  roomCode: string;
  playerId: string;
  send(data: string): void;
  close(code: number, reason: string): void;
}

export interface GameServiceOptions {
  rooms: RoomManager;
  tokens: RoomTokenService;
  /** Disable timers in tests; drive ticks via advance(). */
  autoStart?: boolean;
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

/**
 * Orchestrates room lifecycle, realtime connections and authoritative matches.
 * HTTP and WebSocket adapters call into this; it never touches transport details.
 */
export class GameService {
  readonly rooms: RoomManager;
  private readonly tokens: RoomTokenService;
  private readonly connections = new Map<string, Connection>();
  private readonly matches = new Map<string, MatchRunner>();
  private readonly tokenRefreshTimers = new Map<string, NodeJS.Timeout>();
  private readonly log: NonNullable<GameServiceOptions['log']>;
  private loop: NodeJS.Timeout | null = null;
  private sweeper: NodeJS.Timeout | null = null;
  private lastLoopAt = 0;
  private accumulator = 0;

  constructor(options: GameServiceOptions) {
    this.rooms = options.rooms;
    this.tokens = options.tokens;
    this.log = options.log ?? (() => undefined);
    if (options.autoStart !== false) this.start();
  }

  start(): void {
    if (this.loop) return;
    this.lastLoopAt = performance.now();
    this.loop = setInterval(() => this.runLoop(), 4);
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.loop) clearInterval(this.loop);
    if (this.sweeper) clearInterval(this.sweeper);
    for (const timer of this.tokenRefreshTimers.values()) clearInterval(timer);
    this.tokenRefreshTimers.clear();
    this.loop = null;
    this.sweeper = null;
  }

  // ---- REST-facing operations -------------------------------------------------------------

  createRoom(nickname: string): RoomSession {
    const { room, player } = this.rooms.createRoom(nickname);
    this.log('room_create', { room: room.code });
    return this.session(room, player);
  }

  joinRoom(code: string, nickname: string): RoomSession {
    const { room, player } = this.rooms.joinRoom(code, nickname);
    this.broadcastLobby(room);
    return this.session(room, player);
  }

  roomStatus(code: string): RoomStatus {
    const room = this.rooms.requireRoom(code);
    return {
      roomCode: room.code,
      state: room.state,
      playerCount: room.slots.size,
      maxPlayers: MAX_PLAYERS,
      joinable: room.state === 'lobby' && room.slots.size < MAX_PLAYERS,
    };
  }

  startMatch(code: string, playerId: string): StartMatchResponse {
    const room = this.rooms.startRoom(code, playerId);
    const matchId = `m_${randomBytes(6).toString('hex')}`;
    const match = new MatchRunner({
      matchId,
      level: MVP_VERTICAL_MAP,
      seed: randomInt(2 ** 31),
      players: [...room.slots.values()].map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        nickname: s.nickname,
        color: s.color,
        connected: s.connected,
      })),
    });
    this.matches.set(room.code, match);
    this.log('match_start', { room: room.code, match: matchId, players: room.slots.size });
    this.broadcastLobby(room);
    this.broadcast(room.code, { type: 'server.matchStart', matchId, mapId: MVP_VERTICAL_MAP.id });
    this.broadcast(room.code, { type: 'server.snapshot', snapshot: match.snapshot() });
    return { roomCode: room.code, matchId, state: 'in_progress', serverTimeMs: match.nowMs };
  }

  // ---- Realtime operations ----------------------------------------------------------------

  /** Attaches an authenticated socket. Returns false if the slot no longer exists. */
  attach(connection: Connection): boolean {
    const room = this.rooms.getRoom(connection.roomCode);
    const slot = room?.slots.get(connection.playerId);
    if (!room || !slot) return false;
    const previous = this.connections.get(connection.playerId);
    if (previous && previous !== connection) {
      this.connections.delete(connection.playerId);
      previous.close(CLOSE_CODES.replaced, 'Connected elsewhere');
    }
    this.connections.set(connection.playerId, connection);
    this.rooms.markConnected(room.code, slot.id);
    this.matches.get(room.code)?.setConnected(slot.id, true);

    this.sendTo(connection, {
      type: 'server.welcome',
      roomCode: room.code,
      playerId: slot.id,
      slotIndex: slot.slotIndex,
      color: slot.color,
    });
    this.refreshToken(connection, room, slot);
    const refresh = setInterval(() => {
      const current = this.rooms.getRoom(connection.roomCode);
      const currentSlot = current?.slots.get(connection.playerId);
      if (current && currentSlot) this.refreshToken(connection, current, currentSlot);
    }, TOKEN_REFRESH_MS);
    refresh.unref();
    this.tokenRefreshTimers.set(connection.playerId, refresh);

    this.broadcastLobby(room);
    const match = this.matches.get(room.code);
    if (match) {
      this.sendTo(connection, { type: 'server.matchStart', matchId: match.matchId, mapId: match.level.id });
      this.sendTo(connection, { type: 'server.snapshot', snapshot: match.snapshot() });
    }
    return true;
  }

  detach(connection: Connection): void {
    if (this.connections.get(connection.playerId) !== connection) return;
    this.connections.delete(connection.playerId);
    const timer = this.tokenRefreshTimers.get(connection.playerId);
    if (timer) clearInterval(timer);
    this.tokenRefreshTimers.delete(connection.playerId);
    this.rooms.markDisconnected(connection.roomCode, connection.playerId);
    this.matches.get(connection.roomCode)?.setConnected(connection.playerId, false);
    const room = this.rooms.getRoom(connection.roomCode);
    if (room) this.broadcastLobby(room);
  }

  handleMessage(connection: Connection, message: ClientMessage): void {
    const match = this.matches.get(connection.roomCode);
    switch (message.type) {
      case 'client.ready':
        this.rooms.setReady(connection.roomCode, connection.playerId, message.ready);
        {
          const room = this.rooms.getRoom(connection.roomCode);
          if (room) this.broadcastLobby(room);
        }
        break;
      case 'client.input':
        match?.submitInput(connection.playerId, message.input);
        break;
      case 'client.useItem':
        match?.requestUseItem(connection.playerId);
        break;
      case 'client.ping':
        this.sendTo(connection, { type: 'server.pong', t: message.t, serverTimeMs: match?.nowMs ?? 0 });
        break;
      case 'client.hello':
        break;
    }
  }

  // ---- Simulation ---------------------------------------------------------------------------

  /** Advances every running match by `ticks` fixed steps and broadcasts results. */
  advance(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      for (const [code, match] of this.matches) {
        match.advanceTick();
        for (const event of match.drainEvents()) this.broadcast(code, { type: 'server.event', event });
        if (match.shouldBroadcastSnapshot()) {
          this.broadcast(code, { type: 'server.snapshot', snapshot: match.snapshot() });
        }
        if (match.isFinished()) this.finishMatch(code, match);
      }
    }
  }

  getMatch(code: string): MatchRunner | undefined {
    return this.matches.get(code);
  }

  sweep(): void {
    const { expired, changed, released } = this.rooms.sweep();
    for (const { code, playerId } of released) this.matches.get(code)?.removePlayer(playerId);
    for (const code of expired) {
      this.matches.delete(code);
      for (const connection of this.connections.values()) {
        if (connection.roomCode === code) connection.close(CLOSE_CODES.roomClosed, 'Room expired');
      }
    }
    for (const code of changed) {
      const room = this.rooms.getRoom(code);
      if (room) this.broadcastLobby(room);
    }
  }

  private runLoop(): void {
    const nowPerf = performance.now();
    this.accumulator += nowPerf - this.lastLoopAt;
    this.lastLoopAt = nowPerf;
    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < MAX_TICKS_PER_LOOP) {
      this.accumulator -= TICK_MS;
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_LOOP) this.accumulator = 0; // drop backlog after a stall
    if (ticks > 0 && this.matches.size > 0) this.advance(ticks);
  }

  private finishMatch(code: string, match: MatchRunner): void {
    this.matches.delete(code);
    const result = match.result();
    this.broadcast(code, {
      type: 'server.matchEnded',
      matchId: result.matchId,
      finishOrder: result.finishOrder,
      highlights: result.highlights,
    });
    this.log('match_end', { room: code, match: result.matchId, finishers: result.finishOrder.length });
    this.rooms.endMatch(code);
    const room = this.rooms.getRoom(code);
    if (room) this.broadcastLobby(room);
  }

  private session(room: Room, player: PlayerSlot): RoomSession {
    const { token, claims } = this.tokens.issue({
      roomCode: room.code,
      playerId: player.id,
      slotIndex: player.slotIndex,
      role: player.role,
    });
    return {
      roomCode: room.code,
      playerId: player.id,
      slotIndex: player.slotIndex,
      color: player.color,
      role: player.role,
      roomToken: token,
      expiresAt: claims.exp,
    };
  }

  private refreshToken(connection: Connection, room: Room, slot: PlayerSlot): void {
    const session = this.session(room, slot);
    this.sendTo(connection, { type: 'server.session', roomToken: session.roomToken, expiresAt: session.expiresAt });
  }

  private broadcastLobby(room: Room): void {
    this.broadcast(room.code, {
      type: 'server.lobbyState',
      roomCode: room.code,
      state: room.state,
      hostId: room.hostId,
      maxPlayers: MAX_PLAYERS,
      minPlayers: this.rooms.minPlayers,
      players: this.rooms.lobbyPlayers(room),
    });
  }

  private broadcast(code: string, body: ServerMessageBody): void {
    const data = encodeServerMessage(body);
    for (const connection of this.connections.values()) {
      if (connection.roomCode === code) connection.send(data);
    }
  }

  private sendTo(connection: Connection, body: ServerMessageBody): void {
    connection.send(encodeServerMessage(body));
  }
}
