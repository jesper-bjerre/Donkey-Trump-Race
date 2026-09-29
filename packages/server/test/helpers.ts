import type { ServerConfig } from '../src/config.js';
import { createServer, type CreateServerOptions } from '../src/server.js';

export const TEST_SECRET = 'test-secret-placeholder-0123456789';

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    tokenSecret: TEST_SECRET,
    tokenTtlMs: 30 * 60 * 1000,
    allowSolo: false,
    clientDistDir: null,
    allowedOrigins: null,
    ...overrides,
  };
}

export function createTestServer(overrides: Partial<ServerConfig> = {}, options: CreateServerOptions = {}) {
  return createServer(testConfig(overrides), { autoStart: false, ...options });
}
