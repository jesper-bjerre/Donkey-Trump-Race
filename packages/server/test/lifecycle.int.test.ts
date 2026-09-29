import { afterEach, describe, expect, it } from 'vitest';
import type WebSocket from 'ws';
import { CLOSE_CODES, PLAYER_COLOR_IDS, type RoomSession } from '@dtr/shared-protocol';
import type { CreateServerOptions } from '../src/server.js';
import type { GameServer } from '../src/server.js';
import type { ServerConfig } from '../src/config.js';
import { connectClient, realtimeFrames, type TestClient } from './fixtures/realtimeFixtures.js';
import { createFakeClock, FIVE_PLAYER_NICKNAMES, SIXTH_NICKNAME } from './fixtures/roomFixtures.js';
import { createTestServer, recordingTelemetry } from './helpers.js';

let server: GameServer;
let url: string;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await server?.close();
});

async function boot(overrides: Partial<ServerConfig> = {}, options: CreateServerOptions = {}) {
  server = await createTestServer(overrides, options);
  const address = await server.app.listen({ port: 0, host: '127.0.0.1' });
  url = address.replace('http', 'ws') + '/ws';
}

async function rest<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; json: T }> {
  const res = await server.app.inject({
    method: 'POST',
    url: path,
    payload: body as object,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, json: res.json() as T };
}

async function joinAndConnect(session: RoomSession): Promise<TestClient> {
  const client = await connectClient(url, sockets);
  client.send(realtimeFrames.hello(session.roomToken));
  await client.waitFor('server.welcome');
  return client;
}

describe('five-player room over REST and WebSocket', () => {
  it('fills five slots with unique colors, rejects the sixth and starts for everyone', async () => {
    const telemetry = recordingTelemetry();
    await boot({}, { telemetry });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: FIVE_PLAYER_NICKNAMES[0] }))
      .json;
    const sessions = [host];
    for (const nickname of FIVE_PLAYER_NICKNAMES.slice(1)) {
      const joined = await rest<RoomSession>(`/api/v1/rooms/${host.roomCode}/join`, { nickname });
      expect(joined.status).toBe(201);
      sessions.push(joined.json);
    }
    expect(new Set(sessions.map((s) => s.color)).size).toBe(5);
    expect(sessions.map((s) => s.color)).toEqual(PLAYER_COLOR_IDS);
    const sixth = await rest<{ error: { code: string } }>(`/api/v1/rooms/${host.roomCode}/join`, {
      nickname: SIXTH_NICKNAME,
    });
    expect([sixth.status, sixth.json.error.code]).toEqual([409, 'ROOM_FULL']);

    const clients = await Promise.all(sessions.map(joinAndConnect));
    for (const c of clients.slice(1)) c.send(realtimeFrames.ready());
    await clients[0]!.waitFor('server.lobbyState', (m) => m.players.every((p) => p.ready));
    const start = await rest<{ roster: unknown[] }>(
      `/api/v1/rooms/${host.roomCode}/start`,
      undefined,
      host.roomToken,
    );
    expect(start.status).toBe(200);
    expect(start.json.roster).toHaveLength(5);
    await Promise.all(clients.map((c) => c.waitFor('server.matchStart')));

    const names = telemetry.publisher.events.map((e) => e.name);
    expect(names.filter((n) => n === 'join_success')).toHaveLength(5);
    expect(names).toContain('match_start');
    expect(telemetry.publisher.named('join_failure')[0]?.payload.errorCode).toBe('ROOM_FULL');
    const serialized = JSON.stringify(telemetry.publisher.events);
    expect(serialized).not.toContain(host.roomCode);
    for (const nickname of FIVE_PLAYER_NICKNAMES) expect(serialized).not.toContain(nickname);
    expect(telemetry.publisher.failures).toEqual([]);
  });
});

describe('reconnect grace over WebSocket', () => {
  it('rejects a reconnect after 61 s with RECONNECT_EXPIRED and frees the slot', async () => {
    const clock = createFakeClock();
    await boot({}, { now: clock.now });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const guest = (
      await rest<RoomSession>(`/api/v1/rooms/${host.roomCode}/join`, { nickname: 'Guest' })
    ).json;
    await joinAndConnect(host);
    const first = await joinAndConnect(guest);
    first.socket.close();
    await first.closed;
    await new Promise((r) => setTimeout(r, 50));
    clock.advance(61_000);

    const again = await connectClient(url, sockets);
    again.send(realtimeFrames.hello(guest.roomToken));
    const error = await again.waitFor('server.error');
    expect(error.code).toBe('RECONNECT_EXPIRED');
    expect((await again.closed).code).toBe(CLOSE_CODES.roomClosed);
    expect(server.game.rooms.getRoom(host.roomCode)!.slots.has(guest.playerId)).toBe(false);
  });

  it('restores the slot within the grace period and records a reconnect', async () => {
    const clock = createFakeClock();
    const telemetry = recordingTelemetry();
    await boot({}, { now: clock.now, telemetry });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const first = await joinAndConnect(host);
    first.socket.close();
    await first.closed;
    await new Promise((r) => setTimeout(r, 50));
    clock.advance(59_000);
    await joinAndConnect(host);
    expect(telemetry.publisher.named('reconnect')[0]?.payload.offlineMs).toBe(59_000);
    expect(telemetry.publisher.named('disconnect')).toHaveLength(1);
  });
});

describe('gateway liveness and throttling', () => {
  it('closes an authenticated but silent socket after the heartbeat window', async () => {
    await boot({}, { gateway: { heartbeatIntervalMs: 50, heartbeatTimeoutMs: 150 } });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    // A client that never answers pings (autoPong off) and sends nothing.
    const client = await connectClient(url, sockets, { autoPong: false });
    client.send(realtimeFrames.hello(host.roomToken));
    await client.waitFor('server.welcome');
    expect((await client.closed).code).toBe(CLOSE_CODES.heartbeatTimeout);
  });

  it('drops over-rate inputs without closing a 60 Hz sender', async () => {
    await boot({ allowSolo: true });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const client = await joinAndConnect(host);
    for (let seq = 1; seq <= 90; seq++) client.send(realtimeFrames.input(seq));
    const notice = await client.waitFor('server.error', (m) => m.code === 'RATE_LIMITED');
    expect(notice.code).toBe('RATE_LIMITED');
    client.send(realtimeFrames.ping(7));
    expect((await client.waitFor('server.pong', (m) => m.t === 7)).t).toBe(7);
    expect(client.socket.readyState).toBe(client.socket.OPEN);
  });

  it('accepts a steady 30 Hz input stream', async () => {
    await boot({ allowSolo: true });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const client = await joinAndConnect(host);
    for (let seq = 1; seq <= 45; seq++) {
      client.send(realtimeFrames.input(seq));
      await new Promise((r) => setTimeout(r, 33));
    }
    client.send(realtimeFrames.ping(9));
    await client.waitFor('server.pong', (m) => m.t === 9);
    expect(client.messages.some((m) => m.type === 'server.error')).toBe(false);
  });

  it('answers malformed input with BAD_REQUEST and keeps the socket open', async () => {
    await boot();
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const client = await joinAndConnect(host);
    client.send(realtimeFrames.outOfBoundsInput);
    expect((await client.waitFor('server.error')).code).toBe('BAD_REQUEST');
  });
});

describe('match interruption, replay and desync telemetry', () => {
  it('ends a crashing match as interrupted, returns to lobby and lets the host replay', async () => {
    const telemetry = recordingTelemetry();
    await boot({ allowSolo: true }, { telemetry });
    const host = (await rest<RoomSession>('/api/v1/rooms', { nickname: 'Host' })).json;
    const client = await joinAndConnect(host);
    await rest(`/api/v1/rooms/${host.roomCode}/start`, undefined, host.roomToken);
    await client.waitFor('server.matchStart');

    client.send(realtimeFrames.desync(100, 3.2));
    client.send(realtimeFrames.desync(101, 3.3));
    await client.send(realtimeFrames.ping(1));
    await client.waitFor('server.pong');
    const desync = telemetry.publisher.named('desync_correction');
    expect(desync).toHaveLength(1);
    expect(desync[0]!.payload).toMatchObject({ severity: 'major', playerSlot: 0 });

    const match = server.game.getMatch(host.roomCode)!;
    match.advanceTick = () => {
      throw new TypeError('boom');
    };
    server.game.advance(1);
    const ended = await client.waitFor('server.matchEnded');
    expect(ended).toMatchObject({ outcome: 'interrupted', canReplay: true });
    await client.waitFor('server.lobbyState', (m) => m.state === 'lobby');
    expect(telemetry.publisher.named('match_breaking_error')[0]?.payload.errorClass).toBe(
      'TypeError',
    );
    expect(telemetry.publisher.named('match_end')[0]?.payload.outcome).toBe('interrupted');

    const replay = await rest<{ state: string }>(
      `/api/v1/rooms/${host.roomCode}/replay`,
      undefined,
      host.roomToken,
    );
    expect([replay.status, replay.json.state]).toEqual([200, 'in_progress']);
  });
});
