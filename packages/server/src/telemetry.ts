import {
  AuditWriter,
  AzureBlobClient,
  BatchTelemetryPublisher,
  createPseudonymHasher,
  FileBlobClient,
  InMemoryBlobClient,
  NoopTelemetryPublisher,
  PrivacyRequestService,
  TelemetryBatchExporter,
  type AuditLog,
  type BlobClient,
  type PseudonymHasher,
  type TelemetryPublisher,
} from '@dtr/server-telemetry';
import type { ServerConfig } from './config.js';

type Log = (message: string, fields?: Record<string, unknown>) => void;

/** Everything the game server needs for telemetry, audit and GDPR requests. */
export interface ServerTelemetry {
  publisher: TelemetryPublisher;
  audit: AuditLog;
  hasher: PseudonymHasher;
  privacy: PrivacyRequestService;
  /** Present for memory/file sinks; lets tests and local runs inspect written blobs. */
  blobs?: { telemetry: BlobClient; audit: BlobClient };
  close(): Promise<void>;
}

class NoopAudit implements AuditLog {
  async appendAuditRecord() {
    return null;
  }
}

export async function createServerTelemetry(
  config: ServerConfig,
  warn: Log,
): Promise<ServerTelemetry> {
  const { telemetry } = config;
  const hasher = createPseudonymHasher(telemetry.hashSalt);
  if (telemetry.sink === 'none') {
    const blobs = new InMemoryBlobClient();
    const audit = new NoopAudit();
    return {
      publisher: new NoopTelemetryPublisher(),
      audit,
      hasher,
      privacy: new PrivacyRequestService(blobs, hasher, audit),
      async close() {},
    };
  }
  let telemetryBlobs: BlobClient;
  let auditBlobs: BlobClient;
  if (telemetry.sink === 'azure') {
    [telemetryBlobs, auditBlobs] = await Promise.all([
      AzureBlobClient.create(telemetry.storageAccountUrl!, telemetry.telemetryContainer),
      AzureBlobClient.create(telemetry.storageAccountUrl!, telemetry.auditContainer),
    ]);
  } else if (telemetry.sink === 'file') {
    telemetryBlobs = new FileBlobClient(`${telemetry.dataDir}/${telemetry.telemetryContainer}`);
    auditBlobs = new FileBlobClient(`${telemetry.dataDir}/${telemetry.auditContainer}`);
  } else {
    telemetryBlobs = new InMemoryBlobClient();
    auditBlobs = new InMemoryBlobClient();
  }
  const exporter = new TelemetryBatchExporter(telemetryBlobs, (error) =>
    warn('telemetry_export_failed', { error: (error as Error).message }),
  );
  exporter.start(telemetry.flushIntervalMs);
  const audit = new AuditWriter(auditBlobs, config.environment, warn);
  return {
    publisher: new BatchTelemetryPublisher(exporter, config.environment, warn),
    audit,
    hasher,
    privacy: new PrivacyRequestService(telemetryBlobs, hasher, audit),
    blobs:
      telemetry.sink === 'azure' ? undefined : { telemetry: telemetryBlobs, audit: auditBlobs },
    async close() {
      await exporter.stop();
      await audit.drain();
    },
  };
}
