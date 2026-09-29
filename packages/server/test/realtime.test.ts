import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  CLOSE_CODES,
  encodeClientMessage,
  MAX_CLIENT_MESSAGE_BYTES,
  type RoomSession,
  type ServerMessage,
} from '@dtr/shared-protocol';
import type { GameServer } from '../src/server.js';
import { createTestServer } from './helpers.js';

let server: GameServer;
let url: string;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await server?.close();
});

async function boot(allowSolo = false) {
  server = await createTestServer({ allowSolo });
  const address = await server.app.listen({ port: 0, host: '127.0.0.1' });
  url = address.replace('http', 'ws') + '/ws';
}

async function createSession(nickname = 'Host'): Promise<RoomSession> {
  const res = await server.app.inject({
    method: 'POST',
    url: '/api/v1/rooms',
    payload: { nickname },
  });
  return res.json();
}

interface Client {
  socket: WebSocket;
  messages: ServerMessage[];
  closed: Promise<{ code: number; reason: string }>;
  waitFor<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>>;
}

function connect(): Promise<Client> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  socket.on('message', (data) => {
    messages.push(JSON.parse(data.toString()));
    waiters.splice(0).forEach((w) => w());
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() })),
  );
  const waitFor = <T extends ServerMessage['type']>(type: T) =>
    new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), 3000);
      const check = () => {
        const found = messages.find((m) => m.type === type);
        if (found) {
          clearTimeout(timer);
          resolve(found as Extract<ServerMessage, { type: T }>);
        } else waiters.push(check);
      };
      check();
    });
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, messages, closed, waitFor }));
    socket.once('error', reject);
  });
}

describe('realtime gateway', () => {
  it('welcomes a client after a valid hello', async () => {
    await boot();
    const session = await createSession();
    const client = await connect();
    client.socket.send(encodeClientMessage({ type: 'client.hello', roomToken: session.roomToken }));
    const welcome = await client.waitFor('server.welcome');
    expect(welcome).toMatchObject({ roomCode: session.roomCode, playerId: session.playerId });
    const lobby = await client.waitFor('server.lobbyState');
    expect(lobby.players[0]).toMatchObject({ id: session.playerId, connected: true, role: 'host' });
    await client.waitFor('server.session');
  });

  it('closes sockets that send input before hello', async () => {
    await boot();
    const client = await connect();
    client.socket.send(
      encodeClientMessage({
        type: 'client.input',
        input: { seq: 1, moveX: 1, moveZ: 0, climb: 0, jump: false },
      }),
    );
    expect((await client.closed).code).toBe(CLOSE_CODES.unauthenticated);
  });

  it('closes sockets presenting an invalid token', async () => {
    await boot();
    const client = await connect();
    client.socket.send(encodeClientMessage({ type: 'client.hello', roomToken: 'forged.token' }));
    expect((await client.closed).code).toBe(CLOSE_CODES.unauthenticated);
    expect(client.messages.some((m) => m.type === 'server.error')).toBe(true);
  });

  it('closes oversized payloads', async () => {
    await boot();
    const client = await connect();
    client.socket.send('x'.repeat(MAX_CLIENT_MESSAGE_BYTES + 10));
    expect((await client.closed).code).toBe(CLOSE_CODES.payloadTooLarge);
  });

  it('runs a solo match end-to-end over the socket', async () => {
    await boot(true);
    const session = await createSession('Solo');
    const client = await connect();
    client.socket.send(encodeClientMessage({ type: 'client.hello', roomToken: session.roomToken }));
    await client.waitFor('server.welcome');
    const start = await server.app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${session.roomCode}/start`,
      headers: { authorization: `Bearer ${session.roomToken}` },
    });
    expect(start.statusCode).toBe(200);
    await client.waitFor('server.matchStart');

    client.socket.send(
      encodeClientMessage({
        type: 'client.input',
        input: { seq: 1, moveX: 1, moveZ: 0, climb: 0, jump: false },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    server.game.advance(240); // 3 s countdown + 1 s of running
    await new Promise((r) => setTimeout(r, 100));
    const snapshots = client.messages.filter((m) => m.type === 'server.snapshot');
    const last = snapshots.at(-1);
    expect(last?.type === 'server.snapshot' && last.snapshot.phase).toBe('racing');
    const me = last?.type === 'server.snapshot' ? last.snapshot.players[0] : undefined;
    expect(me?.lastInputSeq).toBe(1);
    expect(me?.x).toBeGreaterThan(2);
  });

  it('restores the same slot when reconnecting with the same token', async () => {
    await boot();
    const session = await createSession();
    const first = await connect();
    first.socket.send(encodeClientMessage({ type: 'client.hello', roomToken: session.roomToken }));
    await first.waitFor('server.welcome');
    first.socket.close();
    await first.closed;

    const second = await connect();
    second.socket.send(encodeClientMessage({ type: 'client.hello', roomToken: session.roomToken }));
    const welcome = await second.waitFor('server.welcome');
    expect(welcome).toMatchObject({
      playerId: session.playerId,
      slotIndex: 0,
      color: session.color,
    });
  });
});
