import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AuditLog } from './auditWriter.js';
import type { BlobClient } from './blobClient.js';
import { privacyRequestBlobPath } from './blobPathBuilder.js';
import type { PseudonymHasher } from './hashing.js';

export const PRIVACY_REQUEST_TYPES = ['export', 'deletion'] as const;

/**
 * GDPR data-subject request. Guests have no account, so the subject identifies
 * themselves with a free-text reference (nickname, approximate date, room code)
 * that is stored only as a salted hash plus a contact address for the reply.
 */
export const PrivacyRequestSchema = z
  .object({
    requestType: z.string(),
    subjectReference: z.string().trim().min(2).max(200),
    contactEmail: z.email().max(254),
  })
  .strict();
export type PrivacyRequestInput = z.infer<typeof PrivacyRequestSchema>;

export interface PrivacyRequestRecord {
  requestId: string;
  requestType: (typeof PRIVACY_REQUEST_TYPES)[number];
  requestStatus: 'received';
  receivedAt: string;
  subjectHash: string;
  /** Needed to answer the request; the privacy container is access-restricted. */
  contactEmail: string;
}

export type PrivacyRequestResult =
  | { ok: true; requestId: string; requestStatus: 'received'; receivedAt: string }
  | { ok: false; error: 'invalid_request_type' | 'invalid_request' };

export class PrivacyRequestService {
  constructor(
    private readonly blobs: BlobClient,
    private readonly hasher: PseudonymHasher,
    private readonly audit: AuditLog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(input: unknown, correlationId?: string): Promise<PrivacyRequestResult> {
    const parsed = PrivacyRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid_request' };
    const { requestType, subjectReference, contactEmail } = parsed.data;
    if (!(PRIVACY_REQUEST_TYPES as readonly string[]).includes(requestType)) {
      return { ok: false, error: 'invalid_request_type' };
    }
    const record: PrivacyRequestRecord = {
      requestId: `prq_${randomBytes(8).toString('hex')}`,
      requestType: requestType as PrivacyRequestRecord['requestType'],
      requestStatus: 'received',
      receivedAt: this.now().toISOString(),
      subjectHash: this.hasher.subjectHash(subjectReference),
      contactEmail,
    };
    await this.blobs.create(privacyRequestBlobPath(record.requestId), JSON.stringify(record));
    await this.audit.appendAuditRecord('privacy_request_recorded', {
      privacyRequestId: record.requestId,
      reason: record.requestType,
      ...(correlationId ? { correlationId } : {}),
    });
    return {
      ok: true,
      requestId: record.requestId,
      requestStatus: record.requestStatus,
      receivedAt: record.receivedAt,
    };
  }
}
