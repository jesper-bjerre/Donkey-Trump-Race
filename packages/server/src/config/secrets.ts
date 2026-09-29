import type { SecretClient } from '@azure/keyvault-secrets';

/**
 * Secret resolution. Deployed environments read secrets from Azure Key Vault with the
 * container's managed identity; local development falls back to environment variables.
 * Production fails closed: a missing secret stops the process before it listens.
 */
export interface SecretProvider {
  readonly source: 'env' | 'key-vault' | 'fake';
  getSecret(name: string): Promise<string | undefined>;
}

/** Key Vault secret names (kebab-case) and their environment-variable fallbacks. */
export const SECRET_NAMES = {
  roomTokenSigningKey: { vault: 'room-token-signing-key', env: 'ROOM_TOKEN_SECRET' },
  telemetryHashSalt: { vault: 'telemetry-hash-salt', env: 'TELEMETRY_HASH_SALT' },
} as const;
export type SecretKey = keyof typeof SECRET_NAMES;

export class EnvSecretProvider implements SecretProvider {
  readonly source = 'env' as const;
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async getSecret(name: string): Promise<string | undefined> {
    const entry = Object.values(SECRET_NAMES).find((s) => s.vault === name);
    const value = entry ? this.env[entry.env] : undefined;
    return value && value.length > 0 ? value : undefined;
  }
}

export class KeyVaultSecretProvider implements SecretProvider {
  readonly source = 'key-vault' as const;
  private constructor(private readonly client: SecretClient) {}

  static async create(vaultUrl: string): Promise<KeyVaultSecretProvider> {
    const [{ SecretClient }, { DefaultAzureCredential }] = await Promise.all([
      import('@azure/keyvault-secrets'),
      import('@azure/identity'),
    ]);
    return new KeyVaultSecretProvider(new SecretClient(vaultUrl, new DefaultAzureCredential()));
  }

  async getSecret(name: string): Promise<string | undefined> {
    try {
      return (await this.client.getSecret(name)).value ?? undefined;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return undefined;
      throw error;
    }
  }
}

/** In-memory provider for tests. */
export class FakeSecretProvider implements SecretProvider {
  readonly source = 'fake' as const;
  readonly requested: string[] = [];
  constructor(private readonly secrets: Record<string, string>) {}

  async getSecret(name: string): Promise<string | undefined> {
    this.requested.push(name);
    return this.secrets[name];
  }
}

export async function createSecretProvider(env: NodeJS.ProcessEnv): Promise<SecretProvider> {
  return env.KEY_VAULT_URL
    ? KeyVaultSecretProvider.create(env.KEY_VAULT_URL)
    : new EnvSecretProvider(env);
}

/**
 * Loads a secret or returns undefined. In production a missing value throws, naming the
 * secret but never printing any value.
 */
export async function resolveSecret(
  provider: SecretProvider,
  key: SecretKey,
  options: { required: boolean; minLength: number },
): Promise<string | undefined> {
  const { vault } = SECRET_NAMES[key];
  const value = await provider.getSecret(vault);
  if (value === undefined) {
    if (options.required) throw new Error(`Secret ${vault} is not configured (${provider.source})`);
    return undefined;
  }
  if (value.length < options.minLength) throw new Error(`Secret ${vault} is too short`);
  return value;
}
