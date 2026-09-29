import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSecretProvider, resolveSecret, type SecretProvider } from './config/secrets.js';

export type TelemetrySink = 'none' | 'memory' | 'file' | 'azure';

export interface ServerConfig {
  port: number;
  host: string;
  /** Deployment name used in telemetry and audit records (dev, staging, production). */
  environment: string;
  tokenSecret: string;
  tokenTtlMs: number;
  allowSolo: boolean;
  clientDistDir: string | null;
  /** Browser origins allowed for WebSocket upgrades and cross-origin REST calls. */
  allowedOrigins: string[] | null;
  /** Adds Strict-Transport-Security; on for production builds, off for local http. */
  hsts: boolean;
  /** Honour X-Forwarded-* from the Container Apps ingress for client IP and scheme. */
  trustProxy: boolean;
  telemetry: {
    sink: TelemetrySink;
    hashSalt: string;
    dataDir: string;
    storageAccountUrl: string | null;
    telemetryContainer: string;
    auditContainer: string;
    flushIntervalMs: number;
  };
}

function findClientDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../client-web/dist'),
    resolve(process.cwd(), 'packages/client-web/dist'),
  ];
  return candidates.find((dir) => existsSync(resolve(dir, 'index.html'))) ?? null;
}

const truthy = (value: string | undefined) => value === '1' || value === 'true';

function parseSink(value: string | undefined): TelemetrySink {
  if (value === undefined || value === '') return 'none';
  if (value === 'none' || value === 'memory' || value === 'file' || value === 'azure') return value;
  throw new Error(`TELEMETRY_SINK must be none, memory, file or azure`);
}

export async function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  secrets?: SecretProvider,
): Promise<ServerConfig> {
  const production = env.NODE_ENV === 'production';
  const provider = secrets ?? (await createSecretProvider(env));
  const sink = parseSink(env.TELEMETRY_SINK);
  const tokenSecret = await resolveSecret(provider, 'roomTokenSigningKey', {
    required: production,
    minLength: 16,
  });
  const hashSalt = await resolveSecret(provider, 'telemetryHashSalt', {
    required: production && sink !== 'none',
    minLength: 16,
  });
  const storageAccountUrl = env.TELEMETRY_STORAGE_URL ?? null;
  if (sink === 'azure' && !storageAccountUrl) {
    throw new Error('TELEMETRY_STORAGE_URL is required when TELEMETRY_SINK=azure');
  }
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    environment: env.APP_ENV ?? (production ? 'production' : 'local'),
    // Dev fallback: per-process random secrets (tokens and hashes do not survive restarts).
    tokenSecret: tokenSecret ?? randomBytes(32).toString('hex'),
    tokenTtlMs: 30 * 60 * 1000,
    allowSolo: truthy(env.ALLOW_SOLO),
    clientDistDir: env.CLIENT_DIST_DIR ?? findClientDist(),
    allowedOrigins: env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : null,
    hsts: env.HSTS !== undefined ? truthy(env.HSTS) : production,
    trustProxy: env.TRUST_PROXY !== undefined ? truthy(env.TRUST_PROXY) : production,
    telemetry: {
      sink,
      hashSalt: hashSalt ?? randomBytes(24).toString('hex'),
      dataDir: env.TELEMETRY_DATA_DIR ?? '.data',
      storageAccountUrl,
      telemetryContainer: env.TELEMETRY_CONTAINER ?? 'telemetry',
      auditContainer: env.AUDIT_CONTAINER ?? 'audit',
      flushIntervalMs: Number(env.TELEMETRY_FLUSH_INTERVAL_MS ?? 60_000),
    },
  };
}
