import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import {
  createErrorEnvelope,
  GameError,
  NicknameBodySchema,
  type ErrorCode,
  type RoomTokenClaims,
} from '@dtr/shared-protocol';
import type { RoomTokenService } from '../auth/roomTokens.js';
import type { GameService } from '../GameService.js';
import { FixedWindowRateLimiter } from './rateLimit.js';

export interface AppOptions {
  game: GameService;
  tokens: RoomTokenService;
  clientDistDir?: string | null;
  logger?: boolean;
  rateLimit?: { limit: number; windowMs: number };
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

function sendError(reply: FastifyReply, code: ErrorCode, requestId: string): FastifyReply {
  const envelope = createErrorEnvelope(code, requestId);
  return reply.status(envelope.statusCode).send(envelope);
}

function parseNickname(body: unknown): string {
  const parsed = NicknameBodySchema.safeParse(body);
  if (!parsed.success) throw new GameError('INVALID_NICKNAME');
  return parsed.data.nickname;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { game, tokens } = options;
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 4096,
    genReqId: () => `req_${Math.random().toString(36).slice(2, 10)}`,
  });
  const limiter = new FixedWindowRateLimiter(options.rateLimit?.limit ?? 30, options.rateLimit?.windowMs ?? 60_000);

  app.addHook('onSend', async (_request, reply, payload) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) reply.header(name, value);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof GameError) return sendError(reply, error.code, request.id);
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 413 || statusCode === 400 || statusCode === 415) {
      return sendError(reply, 'BAD_REQUEST', request.id);
    }
    request.log.error({ err: error }, 'unhandled error');
    return sendError(reply, 'INTERNAL_ERROR', request.id);
  });

  const rateLimited = (request: FastifyRequest, reply: FastifyReply): boolean => {
    if (limiter.hit(request.ip)) return false;
    sendError(reply, 'RATE_LIMITED', request.id);
    return true;
  };

  const requireClaims = (request: FastifyRequest): RoomTokenClaims => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new GameError('TOKEN_MISSING');
    const claims = tokens.verify(header.slice('Bearer '.length).trim());
    if (!claims) throw new GameError('TOKEN_INVALID');
    return claims;
  };

  const health = { service: 'donkey-trump-race-server', status: 'ok' } as const;
  app.get('/healthz', async () => health);
  app.get('/health/live', async () => health);
  app.get('/health/ready', async () => ({ ...health, rooms: game.rooms.roomCount() }));

  app.post('/api/v1/rooms', async (request, reply) => {
    if (rateLimited(request, reply)) return reply;
    const session = game.createRoom(parseNickname(request.body));
    return reply.status(201).send(session);
  });

  app.post<{ Params: { code: string } }>('/api/v1/rooms/:code/join', async (request, reply) => {
    if (rateLimited(request, reply)) return reply;
    const session = game.joinRoom(request.params.code, parseNickname(request.body));
    return reply.status(201).send(session);
  });

  app.post<{ Params: { code: string } }>('/api/v1/rooms/:code/start', async (request, reply) => {
    const claims = requireClaims(request);
    const room = game.rooms.requireRoom(request.params.code);
    if (claims.roomCode !== room.code || claims.role !== 'host') throw new GameError('TOKEN_FORBIDDEN');
    return reply.status(200).send(game.startMatch(room.code, claims.playerId));
  });

  app.get<{ Params: { code: string } }>('/api/v1/rooms/:code', async (request) => {
    return game.roomStatus(request.params.code);
  });

  app.all('/api/*', async (request, reply) => sendError(reply, 'ROOM_NOT_FOUND', request.id));

  const dist = options.clientDistDir;
  if (dist && existsSync(resolve(dist, 'index.html'))) {
    await app.register(fastifyStatic, { root: dist, wildcard: false, maxAge: '1h' });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.header('cache-control', 'no-cache').sendFile('index.html');
      }
      return sendError(reply, 'BAD_REQUEST', request.id);
    });
  }

  return app;
}
