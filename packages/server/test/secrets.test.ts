import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { EnvSecretProvider, FakeSecretProvider } from '../src/config/secrets.js';

describe('secret resolution', () => {
  it('reads secrets from the provider in production', async () => {
    const secrets = new FakeSecretProvider({
      'room-token-signing-key': 'k'.repeat(32),
      'telemetry-hash-salt': 's'.repeat(32),
    });
    const config = await loadConfig({ NODE_ENV: 'production', TELEMETRY_SINK: 'memory' }, secrets);
    expect(config.tokenSecret).toBe('k'.repeat(32));
    expect(config.telemetry.hashSalt).toBe('s'.repeat(32));
    expect(secrets.requested).toEqual(['room-token-signing-key', 'telemetry-hash-salt']);
    expect(config.hsts).toBe(true);
    expect(config.trustProxy).toBe(true);
  });

  it('fails closed in production when a secret is missing, without printing values', async () => {
    await expect(
      loadConfig({ NODE_ENV: 'production' }, new FakeSecretProvider({})),
    ).rejects.toThrow('Secret room-token-signing-key is not configured (fake)');
    await expect(
      loadConfig(
        { NODE_ENV: 'production', TELEMETRY_SINK: 'azure', TELEMETRY_STORAGE_URL: 'https://x' },
        new FakeSecretProvider({ 'room-token-signing-key': 'k'.repeat(32) }),
      ),
    ).rejects.toThrow(/telemetry-hash-salt/);
  });

  it('rejects secrets that are too short', async () => {
    await expect(
      loadConfig({}, new FakeSecretProvider({ 'room-token-signing-key': 'short' })),
    ).rejects.toThrow('Secret room-token-signing-key is too short');
  });

  it('falls back to environment variables and random dev secrets locally', async () => {
    const env = { ROOM_TOKEN_SECRET: 'e'.repeat(20) };
    const config = await loadConfig(env, new EnvSecretProvider(env));
    expect(config.tokenSecret).toBe('e'.repeat(20));
    expect(config.hsts).toBe(false);
    const dev = await loadConfig({}, new EnvSecretProvider({}));
    expect(dev.tokenSecret).toHaveLength(64);
    expect(dev.telemetry.sink).toBe('none');
  });

  it('requires a storage URL for the azure telemetry sink', async () => {
    await expect(
      loadConfig({ TELEMETRY_SINK: 'azure' }, new EnvSecretProvider({})),
    ).rejects.toThrow('TELEMETRY_STORAGE_URL');
    await expect(
      loadConfig({ TELEMETRY_SINK: 'kafka' }, new EnvSecretProvider({})),
    ).rejects.toThrow(/TELEMETRY_SINK/);
  });
});
