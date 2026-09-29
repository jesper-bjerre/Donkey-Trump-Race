import { afterEach, describe, expect, it } from 'vitest';
import { validateRestErrorEnvelope, type RoomSession } from '@dtr/shared-protocol';
import { HSTS_HEADER, SECURITY_HEADERS } from '../src/api/app.js';
import { RoomTokenService } from '../src/auth/roomTokens.js';
import type { GameServer } from '../src/server.js';
import { joinErrorExpectations, privacyRequestBodies } from './fixtures/apiRoomFixtures.js';
import { createFakeClock, FIVE_PLAYER_NICKNAMES } from './fixtures/roomFixtures.js';
import { createTestServer, recordingTelemetry, TEST_SECRET } from './helpers.js';

let server: GameServer;
afterEach(async () => {
  await server?.close();
});

const post = (url: string, payload?: unknown, headers: Record<string, string> = {}) =>
  server.app.inject({ method: 'POST', url, payload: payload as object, headers });

describe('security headers', () => {
  it('sends the baseline headers and HSTS outside local development', async () => {
    server = await createTestServer({ hsts: true });
    const res = await server.app.inject({ method: 'GET', url: '/healthz' });
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers[name]).toBe(value);
    }
    expect(res.headers['strict-transport-security']).toBe(HSTS_HEADER);
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-correlation-id']).toMatch(/^corr_[a-f0-9]{16}$/);
  });

  it('omits HSTS for local http', async () => {
    server = await createTestServer({ hsts: false });
    const res = await server.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('CORS allow-list', () => {
  const allowed = 'https://play.example.com';

  it('answers preflight for allowed origins only', async () => {
    server = await createTestServer({ allowedOrigins: [allowed] });
    const ok = await server.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/rooms',
      headers: { origin: allowed, 'access-control-request-method': 'POST' },
    });
    expect(ok.statusCode).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe(allowed);
    const evil = await post(
      '/api/v1/rooms',
      { nickname: 'LarsFan' },
      { origin: 'https://evil.test' },
    );
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After and a safe envelope', async () => {
    server = await createTestServer(
      {},
      { rateLimits: { 'rooms.join': { limit: 1, windowMs: 60_000 } } },
    );
    await post('/api/v1/rooms/ZZZZZ/join', { nickname: 'LarsFan' });
    const limited = await post('/api/v1/rooms/ZZZZZ/join', { nickname: 'LarsFan' });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
  });

  it('keys limits by IP and user agent', async () => {
    server = await createTestServer(
      {},
      { rateLimits: { 'rooms.create': { limit: 1, windowMs: 60_000 } } },
    );
    expect(
      (await post('/api/v1/rooms', { nickname: 'A1' }, { 'user-agent': 'a' })).statusCode,
    ).toBe(201);
    expect(
      (await post('/api/v1/rooms', { nickname: 'B1' }, { 'user-agent': 'b' })).statusCode,
    ).toBe(201);
    expect(
      (await post('/api/v1/rooms', { nickname: 'A2' }, { 'user-agent': 'a' })).statusCode,
    ).toBe(429);
  });
});

describe('safe errors', () => {
  it.each(joinErrorExpectations)('maps $name to $status $errorCode', async (c) => {
    server = await createTestServer();
    const res = await post(`/api/v1/rooms/${c.code}/join`, { nickname: 'LarsFan' });
    expect(res.statusCode).toBe(c.status);
    const envelope = validateRestErrorEnvelope(res.json());
    expect(envelope?.error.code).toBe(c.errorCode);
    expect(envelope?.correlationId).toBe(res.headers['x-correlation-id']);
  });

  it('maps expired and in-progress rooms to 410 and 409', async () => {
    server = await createTestServer({ allowSolo: true });
    const host: RoomSession = (await post('/api/v1/rooms', { nickname: 'Host' })).json();
    const start = await post(`/api/v1/rooms/${host.roomCode}/start`, undefined, {
      authorization: `Bearer ${host.roomToken}`,
    });
    expect(start.statusCode).toBe(200);
    const inProgress = await post(`/api/v1/rooms/${host.roomCode}/join`, { nickname: 'Late' });
    expect([inProgress.statusCode, inProgress.json().error.code]).toEqual([
      409,
      'ROOM_IN_PROGRESS',
    ]);
    server.game.rooms.expireRoom(host.roomCode);
    const expired = await post(`/api/v1/rooms/${host.roomCode}/join`, { nickname: 'Late' });
    expect([expired.statusCode, expired.json().error.code]).toEqual([410, 'ROOM_EXPIRED']);
  });

  it('never leaks stacks, secrets or raw input in error bodies', async () => {
    server = await createTestServer();
    const payloads = [
      post('/api/v1/rooms', { nickname: '<img src=x onerror=alert(1)>' }),
      post('/api/v1/rooms', '{not json', { 'content-type': 'application/json' }),
      post('/api/v1/rooms', { nickname: 'x'.repeat(5000) }),
      post('/api/v1/rooms/ABCDE/start', undefined, { authorization: 'Bearer forged.token' }),
    ];
    for (const res of await Promise.all(payloads)) {
      const text = res.body;
      expect(validateRestErrorEnvelope(res.json()), text).not.toBeNull();
      expect(text).not.toMatch(/stack|at .*\.ts|onerror|forged|test-secret/i);
    }
  });
});

describe('host authorization and audit', () => {
  it('rejects expired tokens with 401 and records the denial', async () => {
    const clock = createFakeClock();
    const telemetry = recordingTelemetry();
    server = await createTestServer({}, { now: clock.now, telemetry });
    const host: RoomSession = (await post('/api/v1/rooms', { nickname: 'Host' })).json();
    clock.advance(31 * 60 * 1000);
    const res = await post(`/api/v1/rooms/${host.roomCode}/start`, undefined, {
      authorization: `Bearer ${host.roomToken}`,
    });
    expect(res.statusCode).toBe(401);
    const records = await telemetry.auditRecords();
    expect(records.map((r) => r.action)).toEqual(['token_issued', 'start_match_denied']);
    expect(records[1]).toMatchObject({ reason: 'TOKEN_INVALID' });
    expect(JSON.stringify(records)).not.toContain(host.roomCode);
  });

  it('audits participant denials and host authorizations', async () => {
    const telemetry = recordingTelemetry();
    server = await createTestServer({}, { telemetry });
    const host: RoomSession = (await post('/api/v1/rooms', { nickname: 'Host' })).json();
    const guest: RoomSession = (
      await post(`/api/v1/rooms/${host.roomCode}/join`, { nickname: 'Guest' })
    ).json();
    expect(new RoomTokenService(TEST_SECRET, 60_000).verify(guest.roomToken)?.role).toBe(
      'participant',
    );
    const denied = await post(`/api/v1/rooms/${host.roomCode}/start`, undefined, {
      authorization: `Bearer ${guest.roomToken}`,
    });
    expect(denied.statusCode).toBe(403);
    server.game.rooms.setReady(host.roomCode, guest.playerId, true);
    const ok = await post(`/api/v1/rooms/${host.roomCode}/start`, undefined, {
      authorization: `Bearer ${host.roomToken}`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().roster).toHaveLength(2);
    const actions = (await telemetry.auditRecords()).map((r) => `${r.action}:${r.reason ?? ''}`);
    expect(actions).toEqual([
      'token_issued:',
      'token_issued:',
      'start_match_denied:TOKEN_FORBIDDEN',
      'start_match_authorized:start',
    ]);
  });
});

describe('room bootstrap responses', () => {
  it('returns roster and websocket URL on create and join', async () => {
    server = await createTestServer();
    const host: RoomSession = (
      await post('/api/v1/rooms', { nickname: FIVE_PLAYER_NICKNAMES[0] }, { host: 'game.test' })
    ).json();
    expect(host.websocketUrl).toBe('ws://game.test/ws');
    const guest: RoomSession = (
      await post(`/api/v1/rooms/${host.roomCode}/join`, { nickname: FIVE_PLAYER_NICKNAMES[1] })
    ).json();
    expect(guest.roster.map((p) => p.nickname)).toEqual(FIVE_PLAYER_NICKNAMES.slice(0, 2));
  });
});

describe('privacy requests', () => {
  it('accepts export and deletion requests with 202', async () => {
    const telemetry = recordingTelemetry();
    server = await createTestServer({}, { telemetry });
    for (const body of [privacyRequestBodies.deletion, privacyRequestBodies.export]) {
      const res = await post('/api/v1/privacy/requests', body);
      expect(res.statusCode).toBe(202);
      expect(res.json()).toMatchObject({
        requestId: expect.stringMatching(/^prq_/),
        requestStatus: 'received',
      });
    }
    const stored = await telemetry.blobs.telemetry.list('privacy/requests/');
    expect(stored).toHaveLength(2);
    const text = await telemetry.blobs.telemetry.read(stored[0]!);
    expect(text).not.toContain('LarsFan');
    const actions = (await telemetry.auditRecords()).map((r) => r.action);
    expect(actions).toEqual(['privacy_request_recorded', 'privacy_request_recorded']);
  });

  it('rejects unknown request types and malformed bodies', async () => {
    server = await createTestServer();
    const unknown = await post('/api/v1/privacy/requests', privacyRequestBodies.unknownType);
    expect([unknown.statusCode, unknown.json().error.code]).toEqual([400, 'INVALID_REQUEST_TYPE']);
    const malformed = await post('/api/v1/privacy/requests', privacyRequestBodies.malformed);
    expect([malformed.statusCode, malformed.json().error.code]).toEqual([400, 'BAD_REQUEST']);
  });
});
