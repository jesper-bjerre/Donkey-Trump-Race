import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { BlobClient } from './blobClient.js';
import { auditBlobPath } from './blobPathBuilder.js';

export const AUDIT_ACTIONS = [
  'token_issued',
  'token_rejected',
  'start_match_authorized',
  'start_match_denied',
  'privacy_request_recorded',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const hash = z.string().regex(/^[a-f0-9]{16}$/);

export const AuditRecordSchema = z
  .object({
    auditId: z.string().regex(/^aud_[a-f0-9]{16}$/),
    action: z.enum(AUDIT_ACTIONS),
    occurredAt: z.iso.datetime(),
    environment: z.string(),
    roomHash: hash.optional(),
    playerHash: hash.optional(),
    role: z.enum(['host', 'participant']).optional(),
    /** Machine-readable outcome detail, e.g. an error code or `created`. */
    reason: z
      .string()
      .regex(/^[A-Za-z_]{1,40}$/)
      .optional(),
    correlationId: z.string().max(64).optional(),
    privacyRequestId: z
      .string()
      .regex(/^prq_[a-f0-9]{16}$/)
      .optional(),
  })
  .strict();
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export type AuditFields = Omit<AuditRecord, 'auditId' | 'action' | 'occurredAt' | 'environment'>;

export interface AuditLog {
  appendAuditRecord(action: AuditAction, fields?: AuditFields): Promise<AuditRecord | null>;
}

/**
 * Append-only security audit trail (`audit/year=/month=/day=/audit.jsonl`).
 * Records are serialized through one queue so each line is written exactly once and
 * in order; there is deliberately no update or delete operation.
 */
export class AuditWriter implements AuditLog {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly blobs: BlobClient,
    private readonly environment: string,
    private readonly warn: (message: string, fields?: Record<string, unknown>) => void = () =>
      undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  appendAuditRecord(action: AuditAction, fields: AuditFields = {}): Promise<AuditRecord | null> {
    const occurredAt = this.now();
    const record = AuditRecordSchema.safeParse({
      auditId: `aud_${randomBytes(8).toString('hex')}`,
      action,
      occurredAt: occurredAt.toISOString(),
      environment: this.environment,
      ...fields,
    });
    if (!record.success) {
      this.warn('audit_record_invalid', { action });
      return Promise.resolve(null);
    }
    const line = JSON.stringify(record.data) + '\n';
    const write = this.queue.then(async () => {
      try {
        await this.blobs.append(auditBlobPath(occurredAt), line);
        return record.data;
      } catch (error) {
        this.warn('audit_write_failed', { action, error: (error as Error).message });
        return null;
      }
    });
    this.queue = write;
    return write;
  }

  /** Resolves once every record appended so far has been written. */
  async drain(): Promise<void> {
    await this.queue;
  }
}
