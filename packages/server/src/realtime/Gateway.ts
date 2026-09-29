import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  CLOSE_CODES,
  encodeServerMessage,
  MAX_CLIENT_MESSAGE_BYTES,
  parseClientMessage,
} from '@dtr/shared-protocol';
import type { RoomTokenService } from '../auth/roomTokens.js';
import type { Connection, GameService } from '../GameService.js';

export interface GatewayOptions {
  game: GameService;
  tokens: RoomTokenService;
  allowedOrigins?: string[] | null;
  helloTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  /** Token bucket: sustained messages per second and burst size. */
  rateLimitPerSecond?: number;
  rateLimitBurst?: number;
}

/**
 * Raw `ws` gateway. A socket must authenticate with client.hello before anything else;
 * oversized, malformed, unauthenticated or abusive traffic is closed with explicit codes.
 */
export class RealtimeGateway {
  private readonly wss: WebSocketServer;
  private readonly options: Required<Omit<GatewayOptions, 'allowedOrigins'>> & {
    allowedOrigins: string[] | null;
  };

  constructor(options: GatewayOptions) {
    this.options = {
      helloTimeoutMs: 10_000,
      heartbeatIntervalMs: 5_000,
      heartbeatTimeoutMs: 15_000,
      rateLimitPerSecond: 60,
      rateLimitBurst: 90,
      allowedOrigins: null,
      ...options,
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
    const { game, tokens } = this.options;
    let connection: Connection | null = null;
    let lastSeen = Date.now();
    let tokensAvailable = this.options.rateLimitBurst;
    let lastRefill = Date.now();

    const close = (code: number, reason: string) => {
      if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING)
        socket.close(code, reason);
    };

    const helloTimer = setTimeout(() => {
      if (!connection) close(CLOSE_CODES.unauthenticated, 'Hello timeout');
    }, this.options.helloTimeoutMs);

    const heartbeat = setInterval(() => {
      if (Date.now() - lastSeen > this.options.heartbeatTimeoutMs) {
        close(CLOSE_CODES.heartbeatTimeout, 'Heartbeat timeout');
        socket.terminate();
        return;
      }
      if (socket.readyState === socket.OPEN) socket.ping();
    }, this.options.heartbeatIntervalMs);

    socket.on('pong', () => {
      lastSeen = Date.now();
    });

    socket.on('message', (data: RawData, isBinary: boolean) => {
      lastSeen = Date.now();
      const now = Date.now();
      tokensAvailable = Math.min(
        this.options.rateLimitBurst,
        tokensAvailable + ((now - lastRefill) / 1000) * this.options.rateLimitPerSecond,
      );
      lastRefill = now;
      if (tokensAvailable < 1) {
        close(CLOSE_CODES.rateLimited, 'Too many messages');
        return;
      }
      tokensAvailable -= 1;

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
          socket.send(
            encodeServerMessage({
              type: 'server.error',
              code: 'BAD_REQUEST',
              message: 'Invalid message',
            }),
          );
        }
        return;
      }
      const message = parsed.message;

      if (!connection) {
        if (message.type !== 'client.hello') {
          close(CLOSE_CODES.unauthenticated, 'Expected client.hello');
          return;
        }
        const claims = tokens.verify(message.roomToken);
        if (!claims) {
          socket.send(
            encodeServerMessage({
              type: 'server.error',
              code: 'TOKEN_INVALID',
              message: 'Session expired',
            }),
          );
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
        if (!game.attach(candidate)) {
          socket.send(
            encodeServerMessage({
              type: 'server.error',
              code: 'ROOM_EXPIRED',
              message: 'Your slot is no longer available',
            }),
          );
          close(CLOSE_CODES.forbidden, 'Slot unavailable');
          return;
        }
        connection = candidate;
        clearTimeout(helloTimer);
        return;
      }

      if (message.type === 'client.hello') return;
      game.handleMessage(connection, message);
    });

    socket.on('close', () => {
      clearTimeout(helloTimer);
      clearInterval(heartbeat);
      if (connection) game.detach(connection);
    });
    socket.on('error', () => socket.terminate());
  }
}
