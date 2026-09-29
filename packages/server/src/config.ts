import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  port: number;
  host: string;
  tokenSecret: string;
  tokenTtlMs: number;
  allowSolo: boolean;
  clientDistDir: string | null;
  allowedOrigins: string[] | null;
}

function findClientDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../client-web/dist'),
    resolve(process.cwd(), 'packages/client-web/dist'),
  ];
  return candidates.find((dir) => existsSync(resolve(dir, 'index.html'))) ?? null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const secret = env.ROOM_TOKEN_SECRET;
  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('ROOM_TOKEN_SECRET must be set in production');
  }
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    // Dev fallback: a per-process random secret (tokens do not survive restarts).
    tokenSecret: secret ?? randomBytes(32).toString('hex'),
    tokenTtlMs: 30 * 60 * 1000,
    allowSolo: env.ALLOW_SOLO === '1' || env.ALLOW_SOLO === 'true',
    clientDistDir: env.CLIENT_DIST_DIR ?? findClientDist(),
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : null,
  };
}
