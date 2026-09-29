import {
  AuditWriter,
  createPseudonymHasher,
  InMemoryBlobClient,
  PrivacyRequestService,
  RecordingTelemetryPublisher,
} from '@dtr/server-telemetry';
import type { ServerConfig } from '../src/config.js';
import { createServer, type CreateServerOptions } from '../src/server.js';

export const TEST_SECRET = 'test-secret-placeholder-0123456789';

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    environment: 'test',
    tokenSecret: TEST_SECRET,
    tokenTtlMs: 30 * 60 * 1000,
    allowSolo: false,
    fillWithBots: false,
    clientDistDir: null,
    allowedOrigins: null,
    hsts: false,
    trustProxy: false,
    rateLimitScale: 1,
    telemetry: {
      sink: 'memory',
      hashSalt: 'test-hash-salt-placeholder-000000',
      dataDir: '.data',
      storageAccountUrl: null,
      telemetryContainer: 'telemetry',
      auditContainer: 'audit',
      flushIntervalMs: 60_000,
      logEvents: false,
    },
    ...overrides,
  };
}

export function createTestServer(
  overrides: Partial<ServerConfig> = {},
  options: CreateServerOptions = {},
) {
  return createServer(testConfig(overrides), { autoStart: false, ...options });
}

/** Telemetry that records events in memory and writes audit/privacy blobs to memory. */
export function recordingTelemetry() {
  const telemetryBlobs = new InMemoryBlobClient();
  const auditBlobs = new InMemoryBlobClient();
  const hasher = createPseudonymHasher('test-hash-salt-placeholder-000000');
  const audit = new AuditWriter(auditBlobs, 'test');
  const publisher = new RecordingTelemetryPublisher();
  return {
    publisher,
    audit,
    hasher,
    privacy: new PrivacyRequestService(telemetryBlobs, hasher, audit),
    blobs: { telemetry: telemetryBlobs, audit: auditBlobs },
    async close() {
      await audit.drain();
    },
    /** Audit records written so far, oldest first. */
    async auditRecords(): Promise<Array<Record<string, unknown>>> {
      await audit.drain();
      return [...auditBlobs.blobs.values()]
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}
