import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { ContainerClient } from '@azure/storage-blob';

/**
 * Minimal storage abstraction over Azure Blob Storage. Telemetry and audit logs
 * are append-only; privacy requests and reports are write-once JSON documents.
 */
export interface BlobClient {
  append(path: string, text: string): Promise<void>;
  /** Creates a document; rejects if it already exists (write-once). */
  create(path: string, text: string): Promise<void>;
  read(path: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
}

export class BlobExistsError extends Error {
  constructor(path: string) {
    super(`Blob already exists: ${path}`);
    this.name = 'BlobExistsError';
  }
}

export class InMemoryBlobClient implements BlobClient {
  readonly blobs = new Map<string, string>();

  async append(path: string, text: string): Promise<void> {
    this.blobs.set(path, (this.blobs.get(path) ?? '') + text);
  }

  async create(path: string, text: string): Promise<void> {
    if (this.blobs.has(path)) throw new BlobExistsError(path);
    this.blobs.set(path, text);
  }

  async read(path: string): Promise<string | null> {
    return this.blobs.get(path) ?? null;
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.blobs.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

/** Local-development sink that mirrors blob paths under a directory (default `.data/`). */
export class FileBlobClient implements BlobClient {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private full(path: string): string {
    const full = resolve(this.root, path);
    if (!full.startsWith(this.root + sep)) throw new Error('Blob path escapes root');
    return full;
  }

  async append(path: string, text: string): Promise<void> {
    const full = this.full(path);
    await mkdir(dirname(full), { recursive: true });
    await appendFile(full, text, 'utf8');
  }

  async create(path: string, text: string): Promise<void> {
    const full = this.full(path);
    await mkdir(dirname(full), { recursive: true });
    try {
      await writeFile(full, text, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new BlobExistsError(path);
      throw error;
    }
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(this.full(path), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(relative(this.root, full).split(sep).join('/'));
      }
    };
    await walk(this.root);
    return out.filter((p) => p.startsWith(prefix)).sort();
  }
}

/**
 * Azure Blob Storage client authenticated with managed identity
 * (DefaultAzureCredential). Logs use append blobs so records cannot be rewritten
 * by this code path; the audit container additionally has an immutability policy.
 */
export class AzureBlobClient implements BlobClient {
  private constructor(private readonly container: ContainerClient) {}

  static async create(accountUrl: string, containerName: string): Promise<AzureBlobClient> {
    const [{ BlobServiceClient }, { DefaultAzureCredential }] = await Promise.all([
      import('@azure/storage-blob'),
      import('@azure/identity'),
    ]);
    const service = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
    return new AzureBlobClient(service.getContainerClient(containerName));
  }

  async append(path: string, text: string): Promise<void> {
    const blob = this.container.getAppendBlobClient(path);
    await blob.createIfNotExists({ blobHTTPHeaders: { blobContentType: 'application/x-ndjson' } });
    const body = Buffer.from(text, 'utf8');
    // Append blocks are capped at 4 MiB; batches are far smaller but split defensively.
    const max = 4 * 1024 * 1024;
    for (let offset = 0; offset < body.length; offset += max) {
      const chunk = body.subarray(offset, offset + max);
      await blob.appendBlock(chunk, chunk.length);
    }
  }

  async create(path: string, text: string): Promise<void> {
    const blob = this.container.getBlockBlobClient(path);
    try {
      await blob.upload(text, Buffer.byteLength(text), {
        conditions: { ifNoneMatch: '*' },
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409) throw new BlobExistsError(path);
      throw error;
    }
  }

  async read(path: string): Promise<string | null> {
    const blob = this.container.getBlobClient(path);
    if (!(await blob.exists())) return null;
    return (await blob.downloadToBuffer()).toString('utf8');
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for await (const item of this.container.listBlobsFlat({ prefix })) out.push(item.name);
    return out.sort();
  }
}
