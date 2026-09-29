import { afterEach, describe, expect, it } from 'vitest';
import { RoomSessionSchema, type RoomSession } from '@dtr/shared-protocol';
import type { GameServer } from '../src/server.js';
import { createTestServer } from './helpers.js';

let server: GameServer;

afterEach(async () => {
  await server?.close();
});

async function create(nickname = 'LarsFan') {
  return server.app.inject({ method: 'POST', url: '/api/v1/rooms', payload: { nickname } });
}

async function join(code: string, nickname: string) {
  return server.app.inject({
    method: 'POST',
    url: `/api/v1/rooms/${code}/join`,
    payload: { nickname },
  });
}

describe('room API', () => {
  it('creates a room and returns a host session', async () => {
    server = await createTestServer();
    const res = await create();
    expect(res.statusCode).toBe(201);
    const session = RoomSessionSchema.parse(res.json());
    expect(session.role).toBe('host');
    expect(server.tokens.verify(session.roomToken)).toMatchObject({
      role: 'host',
      roomCode: session.roomCode,
      playerId: session.playerId,
    });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('accepts Danish characters in nicknames', async () => {
    server = await createTestServer();
    const res = await create('Jumpman Løkke');
    expect(res.statusCode).toBe(201);
    const room = server.game.rooms.getRoom(res.json().roomCode);
    expect([...room!.slots.values()][0]?.nickname).toBe('Jumpman Løkke');
  });

  it('rejects invalid nicknames without creating a room', async () => {
    server = await createTestServer();
    const res = await create('<script>');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_NICKNAME');
    expect(server.game.rooms.roomCount()).toBe(0);
  });

  it('joins with unique colors and returns ROOM_FULL for the sixth player', async () => {
    server = await createTestServer();
    const host: RoomSession = (await create()).json();
    const colors = [host.color];
    for (let i = 0; i < 4; i++) {
      const res = await join(host.roomCode, `Guest ${i}`);
      expect(res.statusCode).toBe(201);
      const session: RoomSession = res.json();
      expect(session.role).toBe('participant');
      colors.push(session.color);
    }
    expect(new Set(colors).size).toBe(5);
    const full = await join(host.roomCode, 'Sixth');
    expect(full.statusCode).toBe(409);
    expect(full.json().error.code).toBe('ROOM_FULL');
  });

  it('maps join failures to status codes', async () => {
    server = await createTestServer();
    expect((await join('bad!', 'Guest')).json().error.code).toBe('INVALID_ROOM_CODE');
    const missing = await join('ZZZZZ', 'Guest');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('ROOM_NOT_FOUND');
  });

  it('authorizes match start for the host only', async () => {
    server = await createTestServer();
    const host: RoomSession = (await create()).json();
    const guest: RoomSession = (await join(host.roomCode, 'Guest')).json();
    const start = (token?: string) =>
      server.app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${host.roomCode}/start`,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

    expect((await start()).statusCode).toBe(401);
    expect((await start('forged.token')).statusCode).toBe(401);
    expect((await start(guest.roomToken)).statusCode).toBe(403);
    const notReady = await start(host.roomToken);
    expect(notReady.statusCode).toBe(409);
    expect(notReady.json().error.code).toBe('PLAYERS_NOT_READY');

    server.game.rooms.setReady(host.roomCode, guest.playerId, true);
    const ok = await start(host.roomToken);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ roomCode: host.roomCode, state: 'in_progress' });

    const late = await join(host.roomCode, 'Late');
    expect(late.json().error.code).toBe('ROOM_IN_PROGRESS');
  });

  it('rejects a host token for a different room', async () => {
    server = await createTestServer({ allowSolo: true });
    const a: RoomSession = (await create('HostA')).json();
    const b: RoomSession = (await create('HostB')).json();
    const res = await server.app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${b.roomCode}/start`,
      headers: { authorization: `Bearer ${a.roomToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rate limits room creation', async () => {
    server = await createTestServer({}, { rateLimit: { limit: 2, windowMs: 60_000 } });
    await create('One');
    await create('Two');
    const res = await create('Three');
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('serves health checks', async () => {
    server = await createTestServer();
    const res = await server.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});
