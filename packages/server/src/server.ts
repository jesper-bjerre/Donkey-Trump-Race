import type { FastifyInstance } from 'fastify';
import { buildApp } from './api/app.js';
import { RoomTokenService } from './auth/roomTokens.js';
import type { ServerConfig } from './config.js';
import { GameService } from './GameService.js';
import { RealtimeGateway } from './realtime/Gateway.js';
import { RoomManager } from './room/RoomManager.js';

export interface GameServer {
  app: FastifyInstance;
  game: GameService;
  gateway: RealtimeGateway;
  tokens: RoomTokenService;
  close(): Promise<void>;
}

export interface CreateServerOptions {
  logger?: boolean;
  autoStart?: boolean;
  rateLimit?: { limit: number; windowMs: number };
}

export async function createServer(
  config: ServerConfig,
  options: CreateServerOptions = {},
): Promise<GameServer> {
  const tokens = new RoomTokenService(config.tokenSecret, config.tokenTtlMs);
  const rooms = new RoomManager({ allowSolo: config.allowSolo });
  let logInfo: (message: string, fields?: Record<string, unknown>) => void = () => undefined;
  const game = new GameService({
    rooms,
    tokens,
    autoStart: options.autoStart,
    log: (message, fields) => logInfo(message, fields),
  });
  const app = await buildApp({
    game,
    tokens,
    clientDistDir: config.clientDistDir,
    logger: options.logger ?? false,
    rateLimit: options.rateLimit,
  });
  logInfo = (message, fields) => app.log.info(fields ?? {}, message);

  const gateway = new RealtimeGateway({ game, tokens, allowedOrigins: config.allowedOrigins });
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
    async close() {
      game.stop();
      gateway.close();
      await app.close();
    },
  };
}
