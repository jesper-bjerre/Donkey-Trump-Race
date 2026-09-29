import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import {
  createErrorEnvelope,
  GameError,
  NicknameBodySchema,
  roomCodeSchema,
  tokenViolationCode,
  type ErrorCode,
  type RoomTokenClaims,
} from '@dtr/shared-protocol';
import type {
  AuditLog,
  PrivacyRequestService,
  PseudonymHasher,
  TelemetryPublisher,
} from '@dtr/server-telemetry';
import type { RoomTokenService } from '../auth/roomTokens.js';
import type { GameService } from '../GameService.js';
import { rateLimitKey, RestRateLimiter, type RestRatePolicy } from './rateLimit.js';

export interface AppOptions {
  game: GameService;
  tokens: RoomTokenService;
  telemetry: {
    publisher: TelemetryPublisher;
    audit: AuditLog;
    hasher: PseudonymHasher;
    privacy: PrivacyRequestService;
  };
  clientDistDir?: string | null;
  logger?: boolean;
  rateLimits?: Partial<Record<RestRatePolicy, { limit: number; windowMs: number }>>;
  /** Origins allowed to call the REST API cross-origin (CORS). Same-origin always works. */
  allowedOrigins?: string[] | null;
  hsts?: boolean;
  trustProxy?: boolean;
  rateLimitScale?: number;
}

export const HSTS_HEADER = 'max-age=31536000; includeSubDomains';

export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function sendError(reply: FastifyReply, code: ErrorCode, correlationId: string): FastifyReply {
  const envelope = createErrorEnvelope(code, correlationId);
  return reply.status(envelope.statusCode).send(envelope);
}

function parseNickname(body: unknown): string {
  const parsed = NicknameBodySchema.safeParse(body);
  if (!parsed.success) throw new GameError('INVALID_NICKNAME');
  return parsed.data.nickname;
}

function parseRoomCode(raw: string): string {
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) throw new GameError('INVALID_ROOM_CODE');
  return parsed.data;
}

/** `wss://host/ws` for the host the browser used (scheme from the ingress when proxied). */
function websocketUrlFor(request: FastifyRequest): string {
  const scheme = request.protocol === 'https' ? 'wss' : 'ws';
  return `${scheme}://${request.host}/ws`;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { game, tokens, telemetry } = options;
  const app = Fastify({
    logger: options.logger
      ? {
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'body.nickname'],
            censor: '[redacted]',
          },
        }
      : false,
    bodyLimit: 4096,
    trustProxy: options.trustProxy ?? false,
    genReqId: () => `corr_${randomBytes(8).toString('hex')}`,
  });
  const limiter = new RestRateLimiter(options.rateLimits, Date.now, options.rateLimitScale);
  const allowedOrigins = new Set(options.allowedOrigins ?? []);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-correlation-id', request.id);
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin) && request.url.startsWith('/api/')) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
      if (request.method === 'OPTIONS') {
        reply.header('access-control-allow-methods', 'GET, POST');
        reply.header('access-control-allow-headers', 'authorization, content-type');
        reply.header('access-control-max-age', '600');
        return reply.status(204).send();
      }
    }
    return undefined;
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) reply.header(name, value);
    if (options.hsts) reply.header('strict-transport-security', HSTS_HEADER);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof GameError) return sendError(reply, error.code, request.id);
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 413 || statusCode === 400 || statusCode === 415) {
      return sendError(reply, 'BAD_REQUEST', request.id);
    }
    request.log.error({ err: error, correlationId: request.id }, 'unhandled error');
    return sendError(reply, 'INTERNAL_ERROR', request.id);
  });

  const rateLimited = (
    policy: RestRatePolicy,
    request: FastifyRequest,
    reply: FastifyReply,
  ): boolean => {
    const decision = limiter.check(policy, rateLimitKey(request.ip, request.headers['user-agent']));
    if (decision.allowed) return false;
    request.log.warn({ policy, correlationId: request.id }, 'rate limited');
    telemetry.publisher.publish('rate_limited', {}, { scope: 'rest', policy });
    reply.header('retry-after', String(decision.retryAfterSeconds));
    sendError(reply, 'RATE_LIMITED', request.id);
    return true;
  };

  const requireClaims = (request: FastifyRequest): RoomTokenClaims => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new GameError(tokenViolationCode('missing'));
    }
    const claims = tokens.verify(header.slice('Bearer '.length).trim());
    if (!claims) throw new GameError(tokenViolationCode('tampered'));
    return claims;
  };

  /**
   * Host-only room actions (start, replay). Every decision is written to the audit log;
   * denials carry the error code as the reason.
   */
  const authorizeHost = (request: FastifyRequest, rawCode: string): RoomTokenClaims => {
    let claims: RoomTokenClaims | undefined;
    try {
      claims = requireClaims(request);
      const code = parseRoomCode(rawCode);
      if (claims.roomCode !== code) throw new GameError(tokenViolationCode('wrongRoom'));
      if (claims.role !== 'host') throw new GameError(tokenViolationCode('wrongRole'));
      return claims;
    } catch (error) {
      const reason = error instanceof GameError ? error.code : 'INTERNAL_ERROR';
      void telemetry.audit.appendAuditRecord('start_match_denied', {
        reason,
        correlationId: request.id,
        ...(claims
          ? {
              roomHash: telemetry.hasher.roomHash(claims.roomCode),
              playerHash: telemetry.hasher.playerHash(claims.playerId),
              role: claims.role,
            }
          : {}),
      });
      throw error;
    }
  };

  const auditedStart = (
    request: FastifyRequest,
    claims: RoomTokenClaims,
    kind: 'start' | 'replay',
  ) => {
    const who = {
      roomHash: telemetry.hasher.roomHash(claims.roomCode),
      playerHash: telemetry.hasher.playerHash(claims.playerId),
      role: claims.role,
      correlationId: request.id,
    };
    try {
      const response =
        kind === 'start'
          ? game.startMatch(claims.roomCode, claims.playerId)
          : game.replayMatch(claims.roomCode, claims.playerId);
      void telemetry.audit.appendAuditRecord('start_match_authorized', { ...who, reason: kind });
      return response;
    } catch (error) {
      const reason = error instanceof GameError ? error.code : 'INTERNAL_ERROR';
      void telemetry.audit.appendAuditRecord('start_match_denied', { ...who, reason });
      throw error;
    }
  };

  const health = { service: 'donkey-trump-race-server', status: 'ok' } as const;
  app.get('/healthz', async () => health);
  app.get('/health/live', async () => health);
  app.get('/health/ready', async () => ({ ...health, rooms: game.rooms.roomCount() }));

  app.post('/api/v1/rooms', async (request, reply) => {
    if (rateLimited('rooms.create', request, reply)) return reply;
    const session = game.createRoom(parseNickname(request.body), websocketUrlFor(request));
    return reply.status(201).send(session);
  });

  app.post<{ Params: { code: string } }>('/api/v1/rooms/:code/join', async (request, reply) => {
    if (rateLimited('rooms.join', request, reply)) {
      game.recordJoinRejected('RATE_LIMITED');
      return reply;
    }
    let code: string;
    let nickname: string;
    try {
      code = parseRoomCode(request.params.code);
      nickname = parseNickname(request.body);
    } catch (error) {
      if (error instanceof GameError) game.recordJoinRejected(error.code);
      throw error;
    }
    const session = game.joinRoom(code, nickname, websocketUrlFor(request));
    return reply.status(201).send(session);
  });

  app.post<{ Params: { code: string } }>('/api/v1/rooms/:code/start', async (request, reply) => {
    if (rateLimited('rooms.start', request, reply)) return reply;
    const claims = authorizeHost(request, request.params.code);
    return reply.status(200).send(auditedStart(request, claims, 'start'));
  });

  app.post<{ Params: { code: string } }>('/api/v1/rooms/:code/replay', async (request, reply) => {
    if (rateLimited('rooms.start', request, reply)) return reply;
    const claims = authorizeHost(request, request.params.code);
    return reply.status(200).send(auditedStart(request, claims, 'replay'));
  });

  app.get<{ Params: { code: string } }>('/api/v1/rooms/:code', async (request) => {
    return game.roomStatus(parseRoomCode(request.params.code));
  });

  app.post('/api/v1/privacy/requests', async (request, reply) => {
    if (rateLimited('privacy.request', request, reply)) return reply;
    const result = await telemetry.privacy.record(request.body, request.id);
    if (!result.ok) {
      throw new GameError(
        result.error === 'invalid_request_type' ? 'INVALID_REQUEST_TYPE' : 'BAD_REQUEST',
      );
    }
    const { ok: _ok, ...body } = result;
    return reply.status(202).send(body);
  });

  app.all('/api/*', async (request, reply) => sendError(reply, 'ROOM_NOT_FOUND', request.id));

  const dist = options.clientDistDir;
  if (dist && existsSync(resolve(dist, 'index.html'))) {
    await app.register(fastifyStatic, { root: dist, maxAge: '1h' });
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0] ?? '';
      // SPA fallback only for page routes; missing assets must 404 rather than return HTML.
      const looksLikeFile = /\.[a-z0-9]+$/i.test(path);
      if (request.method === 'GET' && !path.startsWith('/api/') && !looksLikeFile) {
        return reply.header('cache-control', 'no-cache').sendFile('index.html');
      }
      return reply.status(404).type('text/plain').send('Not found');
    });
  }

  return app;
}
