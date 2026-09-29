import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  CLOSE_CODES,
  encodeServerMessage,
  ERROR_CATALOG,
  GameError,
  MAX_CLIENT_MESSAGE_BYTES,
  parseClientMessage,
  type ErrorCode,
} from '@dtr/shared-protocol';
import type { AuditLog, PseudonymHasher, TelemetryPublisher } from '@dtr/server-telemetry';
import { TokenBucket } from '../api/rateLimit.js';
import type { RoomTokenService } from '../auth/roomTokens.js';
import type { Connection, GameService } from '../GameService.js';

type Log = (message: string, fields?: Record<string, unknown>) => void;

export interface GatewayOptions {
  game: GameService;
  tokens: RoomTokenService;
  telemetry?: { publisher: TelemetryPublisher; audit: AuditLog; hasher: PseudonymHasher };
  allowedOrigins?: string[] | null;
  helloTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  /** Whole-socket token bucket; exceeding it is treated as abuse and closes the socket. */
  rateLimitPerSecond?: number;
  rateLimitBurst?: number;
  /** client.input bucket; over-rate inputs are dropped, the socket stays open. */
  inputRatePerSecond?: number;
  inputBurst?: number;
  log?: Log;
}

/** Close codes for errors raised while attaching a socket to its slot. */
export function closeCodeForAttachError(code: ErrorCode): number {
  switch (code) {
    case 'RECONNECT_EXPIRED':
    case 'ROOM_EXPIRED':
    case 'ROOM_NOT_FOUND':
      return CLOSE_CODES.roomClosed;
    default:
      return CLOSE_CODES.forbidden;
  }
}

/** Throttle window for server.error RATE_LIMITED notices sent to one socket. */
const RATE_NOTICE_INTERVAL_MS = 2000;

/**
 * Raw `ws` gateway. A socket must authenticate with client.hello before anything else;
 * oversized, malformed, unauthenticated or abusive traffic is closed with explicit codes.
 */
export class RealtimeGateway {
  private readonly wss: WebSocketServer;
  private readonly options: Required<Omit<GatewayOptions, 'allowedOrigins' | 'telemetry'>> & {
    allowedOrigins: string[] | null;
    telemetry: GatewayOptions['telemetry'];
  };

  constructor(options: GatewayOptions) {
    this.options = {
      helloTimeoutMs: 10_000,
      heartbeatIntervalMs: 5_000,
      heartbeatTimeoutMs: 15_000,
      rateLimitPerSecond: 100,
      rateLimitBurst: 150,
      inputRatePerSecond: 40,
      inputBurst: 20,
      allowedOrigins: null,
      log: () => undefined,
      ...options,
      telemetry: options.telemetry,
    };
    // ws closes with 1009 above maxPayload; keep headroom so our own 4413 check runs first.
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_MESSAGE_BYTES * 4 });
    this.wss.on('connection', (socket) => this.onConnection(socket));
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const origin = request.headers.origin;
    const allowed = this.options.allowedOrigins;
    if (allowed && (!origin || !allowed.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => this.wss.emit('connection', ws, request));
  }

  close(): void {
    for (const client of this.wss.clients) client.terminate();
    this.wss.close();
  }

  private onConnection(socket: WebSocket): void {
    const { game, tokens, telemetry, log } = this.options;
    let connection: Connection | null = null;
    let lastSeen = Date.now();
    let lastRateNotice = 0;
    const messages = new TokenBucket(this.options.rateLimitPerSecond, this.options.rateLimitBurst);
    const inputs = new TokenBucket(this.options.inputRatePerSecond, this.options.inputBurst);

    const close = (code: number, reason: string) => {
      if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING)
        socket.close(code, reason);
    };
    const sendError = (code: ErrorCode) => {
      if (socket.readyState !== socket.OPEN) return;
      socket.send(
        encodeServerMessage({
          type: 'server.error',
          code,
          message: ERROR_CATALOG[code].userMessage,
        }),
      );
    };

    const helloTimer = setTimeout(() => {
      if (!connection) close(CLOSE_CODES.unauthenticated, 'Hello timeout');
    }, this.options.helloTimeoutMs);

    const heartbeat = setInterval(() => {
      if (Date.now() - lastSeen > this.options.heartbeatTimeoutMs) {
        close(CLOSE_CODES.heartbeatTimeout, 'Heartbeat timeout');
        // Give the close frame a moment to reach a half-alive peer, then drop the TCP socket.
        setTimeout(() => socket.terminate(), 1000).unref();
        clearInterval(heartbeat);
        return;
      }
      if (socket.readyState === socket.OPEN) socket.ping();
    }, this.options.heartbeatIntervalMs);

    socket.on('pong', () => {
      lastSeen = Date.now();
    });

    const authenticate = (roomToken: string) => {
      const claims = tokens.verify(roomToken);
      if (!claims) {
        void telemetry?.audit.appendAuditRecord('token_rejected', { reason: 'TOKEN_INVALID' });
        sendError('TOKEN_INVALID');
        close(CLOSE_CODES.unauthenticated, 'Invalid token');
        return;
      }
      const candidate: Connection = {
        roomCode: claims.roomCode,
        playerId: claims.playerId,
        send: (payload) => {
          if (socket.readyState === socket.OPEN) socket.send(payload);
        },
        close,
      };
      try {
        game.attach(candidate);
      } catch (error) {
        const code = error instanceof GameError ? error.code : 'INTERNAL_ERROR';
        void telemetry?.audit.appendAuditRecord('token_rejected', {
          reason: code,
          roomHash: telemetry.hasher.roomHash(claims.roomCode),
          playerHash: telemetry.hasher.playerHash(claims.playerId),
          role: claims.role,
        });
        if (!(error instanceof GameError)) log('realtime_attach_failed', { err: error });
        sendError(code);
        close(closeCodeForAttachError(code), 'Slot unavailable');
        return;
      }
      connection = candidate;
      clearTimeout(helloTimer);
    };

    socket.on('message', (data: RawData, isBinary: boolean) => {
      lastSeen = Date.now();
      if (!messages.take()) {
        telemetry?.publisher.publish('rate_limited', {}, { scope: 'ws', policy: 'ws.messages' });
        close(CLOSE_CODES.rateLimited, 'Too many messages');
        return;
      }

      const size = Array.isArray(data)
        ? data.reduce((sum, b) => sum + b.length, 0)
        : data instanceof ArrayBuffer
          ? data.byteLength
          : data.length;
      if (isBinary || size > MAX_CLIENT_MESSAGE_BYTES) {
        close(CLOSE_CODES.payloadTooLarge, 'Payload too large');
        return;
      }
      const raw = Array.isArray(data)
        ? Buffer.concat(data).toString('utf8')
        : Buffer.from(data as Buffer).toString('utf8');
      const parsed = parseClientMessage(raw);
      if (!parsed.ok) {
        if (parsed.reason === 'too_large') {
          close(CLOSE_CODES.payloadTooLarge, 'Payload too large');
        } else if (!connection) {
          close(CLOSE_CODES.unauthenticated, 'Expected client.hello');
        } else {
          sendError('BAD_REQUEST');
        }
        return;
      }
      const message = parsed.message;

      if (!connection) {
        if (message.type !== 'client.hello') {
          close(CLOSE_CODES.unauthenticated, 'Expected client.hello');
          return;
        }
        authenticate(message.roomToken);
        return;
      }

      if (message.type === 'client.hello') return;
      if (message.type === 'client.input' && !inputs.take()) {
        // Drop the input; tell the client at most every couple of seconds.
        const now = Date.now();
        if (now - lastRateNotice >= RATE_NOTICE_INTERVAL_MS) {
          lastRateNotice = now;
          sendError('RATE_LIMITED');
          telemetry?.publisher.publish('rate_limited', {}, { scope: 'ws', policy: 'ws.input' });
        }
        return;
      }
      try {
        game.handleMessage(connection, message);
      } catch (error) {
        log('realtime_message_failed', { type: message.type, err: error });
        sendError('INTERNAL_ERROR');
      }
    });

    socket.on('close', (code: number) => {
      clearTimeout(helloTimer);
      clearInterval(heartbeat);
      if (connection) game.detach(connection, code);
    });
    socket.on('error', () => socket.terminate());
  }
}
