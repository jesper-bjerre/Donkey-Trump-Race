import { randomBytes, randomInt } from 'node:crypto';
import { MVP_VERTICAL_MAP } from '@dtr/shared-level';
import {
  CLOSE_CODES,
  encodeServerMessage,
  GameError,
  MAX_PLAYERS,
  type ClientMessage,
  type GameEvent,
  type LobbyPlayer,
  type RoomSession,
  type RoomStatus,
  type ServerMessageBody,
  type StartMatchResponse,
} from '@dtr/shared-protocol';
import { TICK_MS } from '@dtr/shared-simulation';
import { NoopTelemetryPublisher, type PublishContext } from '@dtr/server-telemetry';
import type { RoomTokenService } from './auth/roomTokens.js';
import { MatchRunner } from './game/MatchRunner.js';
import type { RoomManager } from './room/RoomManager.js';
import { type PlayerSlot, type Room } from './room/RoomManager.js';
import type { ServerTelemetry } from './telemetry.js';

const TOKEN_REFRESH_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5000;
const MAX_TICKS_PER_LOOP = 8;
/** Corrections below this are routine smoothing; above it they count as a major desync. */
const MAJOR_DESYNC_DISTANCE = 2.5;
/** At most one desync report per player per second reaches telemetry. */
const DESYNC_REPORT_INTERVAL_MS = 1000;

export interface Connection {
  roomCode: string;
  playerId: string;
  send(data: string): void;
  close(code: number, reason: string): void;
}

type Log = (message: string, fields?: Record<string, unknown>) => void;

export interface GameServiceOptions {
  rooms: RoomManager;
  tokens: RoomTokenService;
  telemetry?: Pick<ServerTelemetry, 'publisher' | 'audit' | 'hasher'>;
  /** Disable timers in tests; drive ticks via advance(). */
  autoStart?: boolean;
  log?: Log;
  logError?: Log;
  /** Wall clock for rate limiting desync reports; injectable in tests. */
  now?: () => number;
}

const NOOP_TELEMETRY: Pick<ServerTelemetry, 'publisher' | 'audit' | 'hasher'> = {
  publisher: new NoopTelemetryPublisher(),
  audit: { appendAuditRecord: async () => null },
  hasher: {
    roomHash: () => '0'.repeat(16),
    playerHash: () => '0'.repeat(16),
    subjectHash: () => '0'.repeat(16),
  },
};

/**
 * Orchestrates room lifecycle, realtime connections and authoritative matches.
 * HTTP and WebSocket adapters call into this; it never touches transport details.
 */
export class GameService {
  readonly rooms: RoomManager;
  private readonly tokens: RoomTokenService;
  private readonly telemetry: Pick<ServerTelemetry, 'publisher' | 'audit' | 'hasher'>;
  private readonly connections = new Map<string, Connection>();
  private readonly matches = new Map<string, MatchRunner>();
  private readonly tokenRefreshTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastDesyncReport = new Map<string, number>();
  private readonly log: Log;
  private readonly logError: Log;
  private readonly now: () => number;
  private loop: NodeJS.Timeout | null = null;
  private sweeper: NodeJS.Timeout | null = null;
  private lastLoopAt = 0;
  private accumulator = 0;

  constructor(options: GameServiceOptions) {
    this.rooms = options.rooms;
    this.tokens = options.tokens;
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.log = options.log ?? (() => undefined);
    this.logError = options.logError ?? this.log;
    this.now = options.now ?? Date.now;
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

  createRoom(nickname: string, websocketUrl: string): RoomSession {
    const { room, player } = this.rooms.createRoom(nickname);
    this.log('room_create', { roomHash: this.roomHash(room.code) });
    this.telemetry.publisher.publish('room_create', this.ctx(room.code), {});
    return this.session(room, player, websocketUrl);
  }

  joinRoom(code: string, nickname: string, websocketUrl: string): RoomSession {
    const known = this.rooms.getRoom(code);
    const context = known ? this.ctx(known.code) : {};
    this.telemetry.publisher.publish('join_attempt', context, {});
    try {
      const { room, player } = this.rooms.joinRoom(code, nickname);
      this.broadcastLobby(room);
      return this.session(room, player, websocketUrl);
    } catch (error) {
      if (error instanceof GameError) {
        this.telemetry.publisher.publish('join_failure', context, { errorCode: error.code });
      }
      throw error;
    }
  }

  /** Records a join rejected before reaching the room manager (validation, rate limit). */
  recordJoinRejected(errorCode: GameError['code']): void {
    this.telemetry.publisher.publish('join_attempt', {}, {});
    this.telemetry.publisher.publish('join_failure', {}, { errorCode });
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
    return this.beginMatch(this.rooms.startRoom(code, playerId));
  }

  /** Host rematch from the results screen; skips the ready gate. */
  replayMatch(code: string, playerId: string): StartMatchResponse {
    return this.beginMatch(this.rooms.replayRoom(code, playerId));
  }

  roster(room: Room): LobbyPlayer[] {
    return this.rooms.lobbyPlayers(room);
  }

  // ---- Realtime operations ----------------------------------------------------------------

  /**
   * Attaches an authenticated socket to its slot. Throws GameError(RECONNECT_EXPIRED |
   * ROOM_EXPIRED | ROOM_NOT_FOUND) when the slot can no longer be claimed.
   */
  attach(connection: Connection): void {
    let claim: ReturnType<RoomManager['claimSlot']>;
    try {
      claim = this.rooms.claimSlot(connection.roomCode, connection.playerId);
    } catch (error) {
      if (error instanceof GameError && error.code === 'RECONNECT_EXPIRED') {
        // The slot was just released: drop it from any running match and tell the room.
        this.matches.get(connection.roomCode)?.removePlayer(connection.playerId);
        const room = this.rooms.getRoom(connection.roomCode);
        if (room) this.broadcastLobby(room);
      }
      throw error;
    }
    const { room, slot } = claim;
    const previous = this.connections.get(connection.playerId);
    if (previous && previous !== connection) {
      this.connections.delete(connection.playerId);
      previous.close(CLOSE_CODES.replaced, 'Connected elsewhere');
    }
    this.connections.set(connection.playerId, connection);
    this.matches.get(room.code)?.setConnected(slot.id, true);

    const ctx = this.ctx(room.code, slot.id);
    if (claim.firstConnect) {
      this.telemetry.publisher.publish('join_success', ctx, {
        slotIndex: slot.slotIndex,
        joinLatencyMs: Math.max(0, (slot.firstConnectedAt ?? slot.joinedAt) - slot.joinedAt),
      });
    } else if (claim.offlineMs !== null) {
      this.telemetry.publisher.publish('reconnect', ctx, { offlineMs: claim.offlineMs });
    }

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
    const oldTimer = this.tokenRefreshTimers.get(connection.playerId);
    if (oldTimer) clearInterval(oldTimer);
    this.tokenRefreshTimers.set(connection.playerId, refresh);

    this.broadcastLobby(room);
    const match = this.matches.get(room.code);
    if (match) {
      this.sendTo(connection, {
        type: 'server.matchStart',
        matchId: match.matchId,
        mapId: match.level.id,
      });
      this.sendTo(connection, { type: 'server.snapshot', snapshot: match.snapshot() });
    }
  }

  detach(connection: Connection, closeCode = 1005): void {
    if (this.connections.get(connection.playerId) !== connection) return;
    this.connections.delete(connection.playerId);
    const timer = this.tokenRefreshTimers.get(connection.playerId);
    if (timer) clearInterval(timer);
    this.tokenRefreshTimers.delete(connection.playerId);
    this.lastDesyncReport.delete(connection.playerId);
    this.rooms.markDisconnected(connection.roomCode, connection.playerId);
    const match = this.matches.get(connection.roomCode);
    match?.setConnected(connection.playerId, false);
    const room = this.rooms.getRoom(connection.roomCode);
    if (room) {
      this.telemetry.publisher.publish(
        'disconnect',
        this.ctx(room.code, connection.playerId, match),
        {
          closeCode: Math.min(4999, Math.max(1000, closeCode)),
          phase: match ? 'match' : 'lobby',
        },
      );
      this.broadcastLobby(room);
    }
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
        this.sendTo(connection, {
          type: 'server.pong',
          t: message.t,
          serverTimeMs: match?.nowMs ?? 0,
        });
        break;
      case 'client.desyncReport':
        this.recordDesync(connection, message.tick, message.correctionDistance, match);
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
        try {
          match.advanceTick();
        } catch (error) {
          this.interruptMatch(code, match, error);
          continue;
        }
        for (const event of match.drainEvents()) {
          this.broadcast(code, { type: 'server.event', event });
          this.publishGameEvent(code, match, event);
        }
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

  private beginMatch(room: Room): StartMatchResponse {
    const matchId = `m_${randomBytes(6).toString('hex')}`;
    const slots = [...room.slots.values()];
    const match = new MatchRunner({
      matchId,
      level: MVP_VERTICAL_MAP,
      seed: randomInt(2 ** 31),
      players: slots.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        nickname: s.nickname,
        color: s.color,
        connected: s.connected,
      })),
    });
    this.matches.set(room.code, match);
    this.log('match_start', { roomHash: this.roomHash(room.code), matchId, players: slots.length });
    this.telemetry.publisher.publish(
      'match_start',
      { roomHash: this.roomHash(room.code), matchId },
      {
        playerCount: slots.length,
        playerHashes: slots.map((s) => this.telemetry.hasher.playerHash(s.id)),
      },
    );
    this.broadcastLobby(room);
    this.broadcast(room.code, { type: 'server.matchStart', matchId, mapId: MVP_VERTICAL_MAP.id });
    this.broadcast(room.code, { type: 'server.snapshot', snapshot: match.snapshot() });
    return {
      roomCode: room.code,
      matchId,
      state: 'in_progress',
      serverTimeMs: match.nowMs,
      roster: this.roster(room),
    };
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
    this.endMatch(code, match, 'completed');
  }

  /**
   * An exception inside the simulation must not take the process (and every other room)
   * down: the affected match ends as `interrupted` and players return to the lobby.
   */
  private interruptMatch(code: string, match: MatchRunner, error: unknown): void {
    const errorClass = (error as Error)?.name?.replace(/[^A-Za-z]/g, '').slice(0, 40) || 'Error';
    this.logError('match_breaking_error', {
      roomHash: this.roomHash(code),
      matchId: match.matchId,
      errorClass,
      err: error,
    });
    this.telemetry.publisher.publish(
      'match_breaking_error',
      { roomHash: this.roomHash(code), matchId: match.matchId },
      { errorClass, phase: 'match' },
    );
    this.endMatch(code, match, 'interrupted');
  }

  private endMatch(code: string, match: MatchRunner, outcome: 'completed' | 'interrupted'): void {
    this.matches.delete(code);
    const result = match.result();
    this.rooms.endMatch(code);
    const room = this.rooms.getRoom(code);
    this.broadcast(code, {
      type: 'server.matchEnded',
      matchId: result.matchId,
      finishOrder: result.finishOrder,
      highlights: result.highlights,
      outcome,
      canReplay: room !== undefined && room.slots.size >= this.rooms.minPlayers,
    });
    this.log('match_end', {
      roomHash: this.roomHash(code),
      matchId: result.matchId,
      outcome,
      finishers: result.finishOrder.length,
    });
    this.telemetry.publisher.publish(
      'match_end',
      { roomHash: this.roomHash(code), matchId: result.matchId },
      {
        outcome,
        durationMs: Math.round(match.nowMs),
        playerCount: match.playerCount,
        finishers: result.finishOrder.length,
      },
    );
    void this.telemetry.publisher.flush();
    if (room) this.broadcastLobby(room);
  }

  private publishGameEvent(code: string, match: MatchRunner, event: GameEvent): void {
    const slot = this.rooms.getSlot(code, event.playerId);
    if (!slot) return;
    const ctx = this.ctx(code, event.playerId, match);
    switch (event.kind) {
      case 'barrelHit':
        this.telemetry.publisher.publish('barrel_hit', ctx, {
          slotIndex: slot.slotIndex,
          blocked: false,
        });
        break;
      case 'shieldBlock':
        // A shield block without a target was a barrel; with a target it was a shove/tweet.
        if (event.targetId === undefined) {
          this.telemetry.publisher.publish('barrel_hit', ctx, {
            slotIndex: slot.slotIndex,
            blocked: true,
          });
        }
        break;
      case 'fall':
        this.telemetry.publisher.publish('fall', ctx, { slotIndex: slot.slotIndex });
        break;
      case 'itemUse':
        if (event.item) {
          this.telemetry.publisher.publish('item_use', ctx, {
            slotIndex: slot.slotIndex,
            item: event.item,
          });
        }
        break;
      case 'rescue': {
        const entry = match.result().finishOrder.find((f) => f.playerId === event.playerId);
        if (entry) {
          this.telemetry.publisher.publish('rescue_complete', ctx, {
            slotIndex: slot.slotIndex,
            rank: entry.rank,
            raceTimeMs: Math.max(0, Math.round(entry.serverTimeMs - match.raceStartMs)),
          });
        }
        break;
      }
      default:
        break;
    }
  }

  private recordDesync(
    connection: Connection,
    tick: number,
    distance: number,
    match: MatchRunner | undefined,
  ): void {
    if (!match) return;
    const now = this.now();
    const last = this.lastDesyncReport.get(connection.playerId) ?? -Infinity;
    if (now - last < DESYNC_REPORT_INTERVAL_MS) return;
    this.lastDesyncReport.set(connection.playerId, now);
    const slot = this.rooms.getSlot(connection.roomCode, connection.playerId);
    if (!slot) return;
    this.telemetry.publisher.publish(
      'desync_correction',
      this.ctx(connection.roomCode, connection.playerId, match),
      {
        playerSlot: slot.slotIndex,
        correctionDistance: Math.round(distance * 1000) / 1000,
        tick: Math.min(tick, match.tick),
        severity: distance >= MAJOR_DESYNC_DISTANCE ? 'major' : 'minor',
      },
    );
  }

  private roomHash(code: string): string {
    return this.telemetry.hasher.roomHash(code);
  }

  private ctx(code: string, playerId?: string, match?: MatchRunner): PublishContext {
    const context: PublishContext = { roomHash: this.roomHash(code) };
    if (playerId) context.playerHash = this.telemetry.hasher.playerHash(playerId);
    const running = match ?? this.matches.get(code);
    if (running) context.matchId = running.matchId;
    return context;
  }

  private session(room: Room, player: PlayerSlot, websocketUrl: string): RoomSession {
    const { token, claims } = this.tokens.issue({
      roomCode: room.code,
      playerId: player.id,
      slotIndex: player.slotIndex,
      role: player.role,
    });
    void this.telemetry.audit.appendAuditRecord('token_issued', {
      roomHash: this.roomHash(room.code),
      playerHash: this.telemetry.hasher.playerHash(player.id),
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
      websocketUrl,
      roster: this.roster(room),
    };
  }

  private refreshToken(connection: Connection, room: Room, slot: PlayerSlot): void {
    const { token, claims } = this.tokens.issue({
      roomCode: room.code,
      playerId: slot.id,
      slotIndex: slot.slotIndex,
      role: slot.role,
    });
    this.sendTo(connection, { type: 'server.session', roomToken: token, expiresAt: claims.exp });
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
