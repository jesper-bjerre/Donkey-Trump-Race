import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createErrorEnvelope,
  ERROR_CATALOG,
  ERROR_CODES,
  getHttpStatusForErrorCode,
  tokenViolationCode,
  validateRestErrorEnvelope,
} from '../src/index.js';

const fixturesDir = new URL('./fixtures/errors/', import.meta.url);

describe('envelopeCompatibility', () => {
  it('serializes ROOM_FULL with only safe fields', () => {
    const json = JSON.parse(JSON.stringify(createErrorEnvelope('ROOM_FULL', 'corr-1')));
    expect(Object.keys(json).sort()).toEqual(['correlationId', 'error', 'requestId', 'statusCode']);
    expect(Object.keys(json.error).sort()).toEqual(['code', 'message', 'recoveryAction']);
    expect(json.statusCode).toBe(409);
    expect(JSON.stringify(json)).not.toMatch(/stack|secret|process\.env/i);
  });

  it('keeps every committed error fixture valid and in sync with the catalog', () => {
    const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) {
      const envelope = validateRestErrorEnvelope(
        JSON.parse(readFileSync(new URL(file, fixturesDir), 'utf8')),
      );
      expect(envelope, file).not.toBeNull();
      expect(envelope).toEqual(createErrorEnvelope(envelope!.error.code, 'corr-fixture-0001'));
    }
  });

  it('rejects envelopes with extra fields such as stack', () => {
    expect(
      validateRestErrorEnvelope({ ...createErrorEnvelope('ROOM_FULL'), stack: 'x' }),
    ).toBeNull();
  });

  it('maps every catalog entry to a documented HTTP status', () => {
    const expected: Partial<Record<(typeof ERROR_CODES)[number], number>> = {
      INVALID_NICKNAME: 400,
      INVALID_ROOM_CODE: 400,
      ROOM_NOT_FOUND: 404,
      ROOM_FULL: 409,
      ROOM_EXPIRED: 410,
      ROOM_IN_PROGRESS: 409,
      RECONNECT_EXPIRED: 410,
      TOKEN_MISSING: 401,
      TOKEN_INVALID: 401,
      TOKEN_FORBIDDEN: 403,
      RATE_LIMITED: 429,
    };
    for (const code of ERROR_CODES) {
      const status = getHttpStatusForErrorCode(code);
      expect([400, 401, 403, 404, 409, 410, 429, 500]).toContain(status);
      if (expected[code]) expect(status, code).toBe(expected[code]);
      expect(ERROR_CATALOG[code].userMessage.length).toBeLessThanOrEqual(200);
    }
  });

  it('maps token violations to 401 or 403 by type', () => {
    expect(getHttpStatusForErrorCode(tokenViolationCode('missing'))).toBe(401);
    expect(getHttpStatusForErrorCode(tokenViolationCode('expired'))).toBe(401);
    expect(getHttpStatusForErrorCode(tokenViolationCode('tampered'))).toBe(401);
    expect(getHttpStatusForErrorCode(tokenViolationCode('wrongRole'))).toBe(403);
    expect(getHttpStatusForErrorCode(tokenViolationCode('wrongRoom'))).toBe(403);
  });
});
