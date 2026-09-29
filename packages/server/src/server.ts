import type { FastifyInstance } from 'fastify';
import { buildApp } from './api/app.js';
import type { RestRatePolicy } from './api/rateLimit.js';
import { RoomTokenService } from './auth/roomTokens.js';
import type { ServerConfig } from './config.js';
import { GameService } from './GameService.js';
import { RealtimeGateway, type GatewayOptions } from './realtime/Gateway.js';
import { RoomManager } from './room/RoomManager.js';
import { createServerTelemetry, type ServerTelemetry } from './telemetry.js';

export interface GameServer {
  app: FastifyInstance;
  game: GameService;
  gateway: RealtimeGateway;
  tokens: RoomTokenService;
  telemetry: ServerTelemetry;
  close(): Promise<void>;
}

export interface CreateServerOptions {
  logger?: boolean;
  autoStart?: boolean;
  rateLimits?: Partial<Record<RestRatePolicy, { limit: number; windowMs: number }>>;
  /** Replaces the configured telemetry (tests inject recorders). */
  telemetry?: ServerTelemetry;
  gateway?: Partial<Omit<GatewayOptions, 'game' | 'tokens' | 'telemetry'>>;
  now?: () => number;
}

export async function createServer(
  config: ServerConfig,
  options: CreateServerOptions = {},
): Promise<GameServer> {
  const tokens = new RoomTokenService(config.tokenSecret, config.tokenTtlMs, options.now);
  const rooms = new RoomManager({ allowSolo: config.allowSolo, now: options.now });
  let logInfo: (message: string, fields?: Record<string, unknown>) => void = () => undefined;
  let logWarn: (message: string, fields?: Record<string, unknown>) => void = () => undefined;
  let logError: (message: string, fields?: Record<string, unknown>) => void = () => undefined;
  const telemetry =
    options.telemetry ??
    (await createServerTelemetry(
      config,
      (message, fields) => logWarn(message, fields),
      (message, fields) => logInfo(message, fields),
    ));
  const game = new GameService({
    rooms,
    tokens,
    telemetry,
    autoStart: options.autoStart,
    now: options.now,
    log: (message, fields) => logInfo(message, fields),
    logError: (message, fields) => logError(message, fields),
  });
  const app = await buildApp({
    game,
    tokens,
    telemetry,
    clientDistDir: config.clientDistDir,
    logger: options.logger ?? false,
    rateLimits: options.rateLimits,
    allowedOrigins: config.allowedOrigins,
    hsts: config.hsts,
    trustProxy: config.trustProxy,
  });
  logInfo = (message, fields) => app.log.info(fields ?? {}, message);
  logWarn = (message, fields) => app.log.warn(fields ?? {}, message);
  logError = (message, fields) => app.log.error(fields ?? {}, message);

  const gateway = new RealtimeGateway({
    game,
    tokens,
    telemetry,
    allowedOrigins: config.allowedOrigins,
    log: (message, fields) => logError(message, fields),
    ...options.gateway,
  });
  app.server.on('upgrade', (request, socket, head) => {
    const path = (request.url ?? '').split('?')[0];
    if (path === '/ws') gateway.handleUpgrade(request, socket, head);
    else socket.destroy();
  });

  return {
    app,
    game,
    gateway,
    tokens,
    telemetry,
    async close() {
      game.stop();
      gateway.close();
      await app.close();
      await telemetry.close();
    },
  };
}
