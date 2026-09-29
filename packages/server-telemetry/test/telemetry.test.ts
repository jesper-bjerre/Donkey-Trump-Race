import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { TELEMETRY_EVENT_NAMES, validateTelemetryEvent } from '@dtr/shared-protocol';
import {
  auditBlobPath,
  AuditWriter,
  BatchTelemetryPublisher,
  buildTelemetryEvent,
  createPseudonymHasher,
  InMemoryBlobClient,
  maskNickname,
  PrivacyRequestService,
  RecordingTelemetryPublisher,
  TelemetryBatchExporter,
  telemetryBlobPath,
  type BlobClient,
} from '../src/index.js';
import { buildTaxonomyExamples, FIXTURE_SALT } from './fixtures/build.js';

const committedExamples = JSON.parse(
  readFileSync(new URL('./fixtures/telemetry-events.json', import.meta.url), 'utf8'),
);

describe('event taxonomy', () => {
  it('has one committed valid example per event name', () => {
    const examples = buildTaxonomyExamples();
    expect(examples).toEqual(committedExamples);
    expect(new Set(examples.map((e) => e.name))).toEqual(new Set(TELEMETRY_EVENT_NAMES));
    for (const e of committedExamples) expect(validateTelemetryEvent(e).ok).toBe(true);
  });

  it.each([
    ['nickname', { nickname: 'Løkke' }],
    ['roomCode', { roomCode: 'A7K2Q' }],
    ['token', { token: 'abc.def' }],
    ['ipAddress', { ipAddress: '10.0.0.1' }],
  ])('rejects payloads containing %s', (_name, extra) => {
    const valid = committedExamples[0];
    expect(validateTelemetryEvent({ ...valid, payload: { ...valid.payload, ...extra } }).ok).toBe(
      false,
    );
    expect(() =>
      buildTelemetryEvent('room_create', { environment: 'test' }, extra as never),
    ).toThrow();
  });

  it('rejects out-of-range payload values', () => {
    expect(() =>
      buildTelemetryEvent(
        'join_success',
        { environment: 'test' },
        {
          slotIndex: 7,
          joinLatencyMs: 10,
        },
      ),
    ).toThrow(/invalid payload/);
  });
});

describe('pseudonymisation', () => {
  it('produces stable, salted, non-reversible hashes', () => {
    const a = createPseudonymHasher(FIXTURE_SALT);
    const b = createPseudonymHasher('another-salt-for-testing-000000');
    expect(a.roomHash('a7k2q')).toBe(a.roomHash('A7K2Q'));
    expect(a.roomHash('A7K2Q')).toMatch(/^[a-f0-9]{16}$/);
    expect(a.roomHash('A7K2Q')).not.toBe(b.roomHash('A7K2Q'));
    expect(maskNickname('Jumpman Løkke', FIXTURE_SALT)).toMatch(/^nick_[a-f0-9]{8}$/);
    expect(maskNickname('Jumpman Løkke', FIXTURE_SALT)).not.toContain('Løkke');
  });

  it('refuses short salts', () => {
    expect(() => createPseudonymHasher('short')).toThrow();
  });
});

describe('blob batch exporter', () => {
  it('writes JSONL batches partitioned by day and room hash', async () => {
    const blobs = new InMemoryBlobClient();
    const exporter = new TelemetryBatchExporter(blobs);
    for (const e of buildTaxonomyExamples()) exporter.enqueue(e);
    await exporter.flush();
    const paths = await blobs.list('telemetry/');
    expect(paths).toContain(
      telemetryBlobPath(new Date('2026-12-10T18:00:00Z'), committedExamples[0].roomHash),
    );
    expect(paths[0]).toMatch(
      /^telemetry\/year=2026\/month=12\/day=10\/roomHash=([a-f0-9]{16}|none)\/matchEvents\.jsonl$/,
    );
    const lines = [...blobs.blobs.values()].join('').trim().split('\n');
    expect(lines).toHaveLength(committedExamples.length);
    expect(exporter.getStats()).toMatchObject({ exported: lines.length, buffered: 0 });
  });

  it('keeps events for retry when the blob write fails', async () => {
    const failing: BlobClient = {
      append: vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue(undefined),
      create: vi.fn(),
      read: vi.fn(),
      list: vi.fn(),
    };
    const onError = vi.fn();
    const exporter = new TelemetryBatchExporter(failing, onError);
    exporter.enqueue(committedExamples[0]);
    await exporter.flush();
    expect(onError).toHaveBeenCalledOnce();
    expect(exporter.getStats().buffered).toBe(1);
    await exporter.flush();
    expect(exporter.getStats()).toMatchObject({ buffered: 0, exported: 1, failedFlushes: 1 });
  });

  it('publisher warns and continues on invalid events', () => {
    const warn = vi.fn();
    const exporter = new TelemetryBatchExporter(new InMemoryBlobClient());
    const publisher = new BatchTelemetryPublisher(exporter, 'dev', warn);
    publisher.publish('fall', {}, { slotIndex: 99 });
    publisher.publish('room_create', {}, {});
    expect(warn).toHaveBeenCalledWith('telemetry_publish_failed', expect.any(Object));
    expect(exporter.getStats().buffered).toBe(1);
  });

  it('recording publisher exposes events by name', () => {
    const recorder = new RecordingTelemetryPublisher();
    recorder.publish('fall', {}, { slotIndex: 1 });
    expect(recorder.named('fall')).toHaveLength(1);
  });
});

describe('audit writer', () => {
  it('appends ordered records to the daily audit blob and never rewrites them', async () => {
    const blobs = new InMemoryBlobClient();
    const now = new Date('2026-12-10T12:00:00Z');
    const audit = new AuditWriter(blobs, 'test', undefined, () => now);
    await audit.appendAuditRecord('token_issued', { role: 'host', roomHash: 'a'.repeat(16) });
    await audit.appendAuditRecord('start_match_denied', { reason: 'TOKEN_FORBIDDEN' });
    const text = blobs.blobs.get(auditBlobPath(now))!;
    const records = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(records.map((r) => r.action)).toEqual(['token_issued', 'start_match_denied']);
    expect(auditBlobPath(now)).toBe('audit/year=2026/month=12/day=10/audit.jsonl');
    expect(Object.keys(AuditWriter.prototype)).not.toContain('update');
  });

  it('drops records carrying unexpected fields', async () => {
    const warn = vi.fn();
    const audit = new AuditWriter(new InMemoryBlobClient(), 'test', warn);
    const result = await audit.appendAuditRecord('token_issued', {
      nickname: 'Løkke',
    } as never);
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith('audit_record_invalid', { action: 'token_issued' });
  });
});

describe('privacy requests', () => {
  const setup = () => {
    const blobs = new InMemoryBlobClient();
    const audit = new AuditWriter(blobs, 'test');
    const service = new PrivacyRequestService(blobs, createPseudonymHasher(FIXTURE_SALT), audit);
    return { blobs, audit, service };
  };

  it('records export and deletion requests with a hashed subject reference', async () => {
    const { blobs, audit, service } = setup();
    const result = await service.record({
      requestType: 'deletion',
      subjectReference: 'LarsFan, room A7K2Q, 10 Dec',
      contactEmail: 'tester@example.com',
    });
    expect(result).toMatchObject({ ok: true, requestStatus: 'received' });
    if (!result.ok) return;
    const stored = JSON.parse((await blobs.read(`privacy/requests/${result.requestId}.json`))!);
    expect(stored.subjectHash).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(stored)).not.toContain('LarsFan');
    await audit.drain();
    const auditText = [...blobs.blobs.entries()].find(([k]) => k.startsWith('audit/'))![1];
    expect(auditText).toContain('privacy_request_recorded');
  });

  it('rejects unknown request types', async () => {
    const { service } = setup();
    expect(
      await service.record({
        requestType: 'rectification',
        subjectReference: 'LarsFan',
        contactEmail: 'tester@example.com',
      }),
    ).toEqual({ ok: false, error: 'invalid_request_type' });
    expect(await service.record({ requestType: 'export' })).toEqual({
      ok: false,
      error: 'invalid_request',
    });
  });
});
