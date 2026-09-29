import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import { CLOSE_CODES, encodeServerMessage, type ServerMessageBody } from '@dtr/shared-protocol';
import { GameSocket } from '../src/net/GameSocket.js';
import { MatchSession } from '../src/net/MatchSession.js';
import { DESYNC_REPORT_THRESHOLD } from '../src/net/prediction.js';
import { player, snapshot } from './fixtures/playerSnapshots.js';

/** Minimal in-memory WebSocket that records sent frames and lets tests push server frames. */
class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  receive(body: ServerMessageBody) {
    this.onmessage?.({ data: encodeServerMessage(body) });
  }
  serverClose(code: number, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function connected() {
  const socket = new GameSocket('room.token', 'ws://test/ws');
  socket.connect();
  const ws = FakeWebSocket.instances[0]!;
  ws.open();
  ws.receive({
    type: 'server.welcome',
    roomCode: 'A7K2Q',
    playerId: 'me',
    slotIndex: 0,
    color: 'red',
  });
  return { socket, ws };
}

describe('GameSocket', () => {
  it('authenticates with client.hello before anything else and adopts rotated tokens', () => {
    const { socket, ws } = connected();
    expect(ws.sent[0]).toEqual({
      type: 'client.hello',
      protocolVersion: 1,
      roomToken: 'room.token',
    });
    expect(socket.status).toBe('open');
    ws.receive({ type: 'server.session', roomToken: 'rotated.token', expiresAt: 1 });
    expect(socket.token).toBe('rotated.token');
  });

  it('sends inputs with their sequence numbers', () => {
    const { socket, ws } = connected();
    socket.sendInput({ seq: 7, moveX: 1, moveZ: 0, climb: 0, jump: false });
    expect(ws.sent.at(-1)).toEqual({
      type: 'client.input',
      protocolVersion: 1,
      input: { seq: 7, moveX: 1, moveZ: 0, climb: 0, jump: false },
    });
  });

  it('reports a fatal close (slot gone) with detail so the app can show the interruption', () => {
    const { socket, ws } = connected();
    const statuses: Array<[string, string | undefined]> = [];
    socket.onStatus((status, detail) => statuses.push([status, detail]));
    ws.serverClose(CLOSE_CODES.roomClosed, 'Slot unavailable');
    expect(statuses).toEqual([['closed', 'Slot unavailable']]);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reconnects after a transient drop', () => {
    vi.useFakeTimers();
    try {
      const { socket, ws } = connected();
      ws.serverClose(1006);
      expect(socket.status).toBe('reconnecting');
      vi.advanceTimersByTime(500);
      expect(FakeWebSocket.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MatchSession desync reports', () => {
  function session() {
    const { socket, ws } = connected();
    const match = new MatchSession('m_0123456789ab', LEVEL, 'me', socket);
    ws.receive({ type: 'server.snapshot', snapshot: snapshot(60, [player()]) });
    return { match, ws };
  }
  const reports = (ws: FakeWebSocket) => ws.sent.filter((m) => m.type === 'client.desyncReport');

  it('does not report corrections just below the threshold', () => {
    const { ws } = session();
    ws.receive({
      type: 'server.snapshot',
      snapshot: snapshot(63, [player({ x: 10 + DESYNC_REPORT_THRESHOLD - 0.01 })]),
    });
    expect(reports(ws)).toHaveLength(0);
  });

  it('reports corrections at the threshold, once per second', () => {
    const { ws } = session();
    ws.receive({
      type: 'server.snapshot',
      snapshot: snapshot(63, [player({ x: 10 + DESYNC_REPORT_THRESHOLD })]),
    });
    ws.receive({ type: 'server.snapshot', snapshot: snapshot(66, [player({ x: 20 })]) });
    expect(reports(ws)).toEqual([
      {
        type: 'client.desyncReport',
        protocolVersion: 1,
        tick: 63,
        correctionDistance: DESYNC_REPORT_THRESHOLD,
      },
    ]);
  });

  it('stops listening after dispose', () => {
    const { match, ws } = session();
    match.dispose();
    ws.receive({ type: 'server.snapshot', snapshot: snapshot(90, [player({ x: 30 })]) });
    expect(match.latest()?.tick).toBe(60);
  });
});
