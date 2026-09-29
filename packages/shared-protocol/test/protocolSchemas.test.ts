import { describe, expect, it } from 'vitest';
import {
  CLOSE_CODES,
  createErrorEnvelope,
  encodeClientMessage,
  getHttpStatusForErrorCode,
  isValidNickname,
  isValidRoomCode,
  MAX_CLIENT_MESSAGE_BYTES,
  parseClientMessage,
  parseServerMessage,
  validateAuthoritativeSnapshot,
  validateClientInputCommand,
  validateRoomTokenClaims,
} from '../src/index.js';
import clientHello from './fixtures/clientHello.valid.json' with { type: 'json' };
import clientInput from './fixtures/clientInput.valid.json' with { type: 'json' };
import roomTokenClaims from './fixtures/roomTokenClaims.valid.json' with { type: 'json' };
import serverSnapshot from './fixtures/serverSnapshot.v1.json' with { type: 'json' };

describe('client input validation', () => {
  it('accepts a bounded input', () => {
    expect(validateClientInputCommand(clientInput.input)).not.toBeNull();
  });

  it('rejects a movement axis outside -1..1', () => {
    expect(validateClientInputCommand({ ...clientInput.input, moveX: 1.5 })).toBeNull();
  });

  it('rejects inputs without a sequence number', () => {
    const { seq: _seq, ...rest } = clientInput.input;
    expect(validateClientInputCommand(rest)).toBeNull();
  });
});

describe('room token claims', () => {
  it('accepts valid unexpired claims', () => {
    expect(validateRoomTokenClaims(roomTokenClaims, roomTokenClaims.exp - 1)).not.toBeNull();
  });

  it('rejects an expired exp value', () => {
    expect(validateRoomTokenClaims(roomTokenClaims, roomTokenClaims.exp)).toBeNull();
  });
});

describe('snapshots', () => {
  it('accepts the committed v1 fixture', () => {
    expect(validateAuthoritativeSnapshot(serverSnapshot)).not.toBeNull();
  });

  it('rejects more than 5 players', () => {
    const players = Array.from({ length: 6 }, () => serverSnapshot.players[0]);
    expect(validateAuthoritativeSnapshot({ ...serverSnapshot, players })).toBeNull();
  });
});

describe('websocket message parsing', () => {
  it('round-trips client messages without changing type or protocolVersion', () => {
    for (const fixture of [clientHello, clientInput]) {
      const parsed = parseClientMessage(JSON.stringify(fixture));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.message.type).toBe(fixture.type);
        expect(parsed.message.protocolVersion).toBe(fixture.protocolVersion);
      }
    }
  });

  it('round-trips a server snapshot message', () => {
    const raw = JSON.stringify({ type: 'server.snapshot', protocolVersion: 1, snapshot: serverSnapshot });
    const parsed = parseServerMessage(raw);
    expect(parsed.ok).toBe(true);
  });

  it('rejects unknown message types', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'client.teleport', protocolVersion: 1 }))).toEqual({
      ok: false,
      reason: 'invalid_schema',
    });
  });

  it('rejects oversized payloads before parsing', () => {
    const raw = encodeClientMessage({ type: 'client.hello', roomToken: 'x'.repeat(MAX_CLIENT_MESSAGE_BYTES) });
    expect(parseClientMessage(raw)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{nope')).toEqual({ ok: false, reason: 'invalid_json' });
  });

  it('uses the documented unauthenticated close code', () => {
    expect(CLOSE_CODES.unauthenticated).toBe(4401);
  });
});

describe('error catalog', () => {
  it('maps codes to HTTP statuses', () => {
    expect(getHttpStatusForErrorCode('INVALID_NICKNAME')).toBe(400);
    expect(getHttpStatusForErrorCode('ROOM_NOT_FOUND')).toBe(404);
    expect(getHttpStatusForErrorCode('ROOM_FULL')).toBe(409);
    expect(getHttpStatusForErrorCode('ROOM_EXPIRED')).toBe(410);
    expect(getHttpStatusForErrorCode('ROOM_IN_PROGRESS')).toBe(409);
    expect(getHttpStatusForErrorCode('TOKEN_INVALID')).toBe(401);
    expect(getHttpStatusForErrorCode('TOKEN_FORBIDDEN')).toBe(403);
    expect(getHttpStatusForErrorCode('RATE_LIMITED')).toBe(429);
  });

  it('builds envelopes without internal details', () => {
    const envelope = createErrorEnvelope('ROOM_FULL', 'req-1');
    const json = JSON.parse(JSON.stringify(envelope));
    expect(json).toEqual({
      statusCode: 409,
      requestId: 'req-1',
      error: { code: 'ROOM_FULL', message: expect.any(String), recoveryAction: 'retry-later' },
    });
    expect(JSON.stringify(json)).not.toMatch(/stack/i);
  });
});

describe('guest identity validation', () => {
  it('accepts Danish characters in nicknames', () => {
    expect(isValidNickname('Jumpman Løkke')).toBe(true);
    expect(isValidNickname('LarsFan')).toBe(true);
  });

  it('rejects unsupported symbols and bad lengths', () => {
    expect(isValidNickname('<script>')).toBe(false);
    expect(isValidNickname('a')).toBe(false);
    expect(isValidNickname('x'.repeat(17))).toBe(false);
  });

  it('validates room codes', () => {
    expect(isValidRoomCode('A7K2Q')).toBe(true);
    expect(isValidRoomCode('a7k2q')).toBe(true);
    expect(isValidRoomCode('A7K2')).toBe(false);
    expect(isValidRoomCode('AOK2Q')).toBe(false);
  });
});
