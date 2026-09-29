/**
 * Multiplayer soak test: fills rooms with headless bots that play full matches.
 *
 *   pnpm soak:multiplayer -- --baseUrl http://localhost:8080 --rooms=20 --playersPerRoom=5
 *
 * Every bot creates/joins over REST, authenticates over WebSocket, readies up and follows
 * the shared autopilot route (30 Hz inputs, like a real client). The run records snapshot
 * inter-arrival times, ping RTT, disconnects and match outcomes, writes soak-summary.json
 * and exits non-zero when a threshold in scripts/soak/metrics.ts is missed.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { MVP_VERTICAL_MAP } from '../../packages/shared-level/src/index.js';
import type {
  PlayerSnapshot,
  RoomSession,
  ServerMessage,
} from '../../packages/shared-protocol/src/index.js';
import { autopilotInput, createMotionState } from '../../packages/shared-simulation/src/index.js';
import { distribution, evaluateSoak } from './metrics.js';
import { botNickname, botUserAgent, SOAK_DEFAULTS } from './soakInputs.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg, i) => !(i === 0 && arg === '--')),
  options: {
    baseUrl: { type: 'string', default: process.env.SOAK_BASE_URL ?? 'http://localhost:8080' },
    rooms: { type: 'string', default: String(SOAK_DEFAULTS.rooms) },
    playersPerRoom: { type: 'string', default: String(SOAK_DEFAULTS.playersPerRoom) },
    maxDurationSec: { type: 'string', default: String(SOAK_DEFAULTS.maxDurationSec) },
    out: { type: 'string', default: SOAK_DEFAULTS.out },
  },
});
const baseUrl = values.baseUrl!.replace(/\/+$/, '');
const roomCount = Number(values.rooms);
const playersPerRoom = Math.min(5, Math.max(1, Number(values.playersPerRoom)));
const maxDurationMs = Number(values.maxDurationSec) * 1000;
const INPUT_INTERVAL_MS = 1000 / 30;

const snapshotIntervals: number[] = [];
const pingRtts: number[] = [];
const errors: string[] = [];
let disconnects = 0;
let matchesStarted = 0;
let matchesCompleted = 0;
let matchesInterrupted = 0;

async function post<T>(path: string, body: unknown, ua: string, token?: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': ua,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as T & { error?: { code: string } };
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${json.error?.code ?? ''}`);
  return json;
}

interface Bot {
  session: RoomSession;
  socket: WebSocket;
  welcomed: Promise<void>;
  ended: Promise<'completed' | 'interrupted' | 'timeout'>;
  close(): void;
}

function connectBot(session: RoomSession, isHost: boolean): Bot {
  const url = baseUrl.startsWith('https://')
    ? session.websocketUrl.replace(/^ws:/, 'wss:')
    : session.websocketUrl;
  const socket = new WebSocket(url);
  let seq = 0;
  let me: PlayerSnapshot | null = null;
  let lastSnapshotAt: number | null = null;
  let inputTimer: ReturnType<typeof setInterval> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closedByUs = false;
  let resolveWelcome!: () => void;
  let resolveEnded!: (outcome: 'completed' | 'interrupted' | 'timeout') => void;
  const welcomed = new Promise<void>((r) => (resolveWelcome = r));
  const ended = new Promise<'completed' | 'interrupted' | 'timeout'>((r) => (resolveEnded = r));
  const send = (body: object) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ ...body, protocolVersion: 1 }));
  };

  socket.onopen = () => send({ type: 'client.hello', roomToken: session.roomToken });
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    switch (message.type) {
      case 'server.welcome':
        resolveWelcome();
        if (!isHost) send({ type: 'client.ready', ready: true });
        pingTimer = setInterval(() => send({ type: 'client.ping', t: performance.now() }), 2000);
        break;
      case 'server.pong':
        pingRtts.push(Math.round(performance.now() - message.t));
        break;
      case 'server.matchStart':
        if (isHost) matchesStarted++;
        inputTimer ??= setInterval(() => {
          if (!me || me.finishRank !== null) return;
          const motion = { ...createMotionState(me.x, me.y, me.z, me.floor), ...me };
          const input = autopilotInput(MVP_VERTICAL_MAP, motion);
          send({ type: 'client.input', input: { seq: ++seq, ...input } });
        }, INPUT_INTERVAL_MS);
        break;
      case 'server.snapshot': {
        const now = performance.now();
        if (lastSnapshotAt !== null) snapshotIntervals.push(Math.round(now - lastSnapshotAt));
        lastSnapshotAt = now;
        me = message.snapshot.players.find((p) => p.id === session.playerId) ?? null;
        break;
      }
      case 'server.matchEnded':
        if (isHost) {
          if (message.outcome === 'completed') matchesCompleted++;
          else matchesInterrupted++;
        }
        if (inputTimer) clearInterval(inputTimer);
        inputTimer = null;
        lastSnapshotAt = null;
        resolveEnded(message.outcome);
        break;
      case 'server.error':
        if (message.code !== 'RATE_LIMITED') errors.push(`${session.playerId}: ${message.code}`);
        break;
      default:
        break;
    }
  };
  socket.onclose = (event) => {
    if (inputTimer) clearInterval(inputTimer);
    if (pingTimer) clearInterval(pingTimer);
    if (!closedByUs) {
      disconnects++;
      errors.push(`${session.playerId}: closed ${event.code}`);
      resolveEnded('timeout');
    }
  };
  return {
    session,
    socket,
    welcomed,
    ended,
    close() {
      closedByUs = true;
      if (inputTimer) clearInterval(inputTimer);
      if (pingTimer) clearInterval(pingTimer);
      socket.close(1000, 'soak done');
    },
  };
}

async function runRoom(room: number): Promise<Bot[]> {
  const host = await post<RoomSession>(
    '/api/v1/rooms',
    { nickname: botNickname(room, 0) },
    botUserAgent(room, 0),
  );
  const sessions = [host];
  for (let slot = 1; slot < playersPerRoom; slot++) {
    sessions.push(
      await post<RoomSession>(
        `/api/v1/rooms/${host.roomCode}/join`,
        { nickname: botNickname(room, slot) },
        botUserAgent(room, slot),
      ),
    );
  }
  const bots = sessions.map((s, i) => connectBot(s, i === 0));
  await Promise.all(bots.map((b) => b.welcomed));
  // Give the ready messages a moment to land before the host starts.
  await new Promise((r) => setTimeout(r, 300));
  await post(`/api/v1/rooms/${host.roomCode}/start`, {}, botUserAgent(room, 0), host.roomToken);
  return bots;
}

const startedAt = new Date();
const t0 = performance.now();
console.log(`Soak: ${roomCount} rooms x ${playersPerRoom} players against ${baseUrl}`);
const rooms = await Promise.all(
  Array.from({ length: roomCount }, (_, room) =>
    runRoom(room).catch((error: Error) => {
      errors.push(`room ${room}: ${error.message}`);
      return [] as Bot[];
    }),
  ),
);
const bots = rooms.flat();
const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), maxDurationMs));
await Promise.race([Promise.all(bots.map((b) => b.ended)), timeout]);
for (const bot of bots) bot.close();

const summary = evaluateSoak({
  config: { rooms: roomCount, playersPerRoom, baseUrl, maxDurationSec: maxDurationMs / 1000 },
  startedAt: startedAt.toISOString(),
  durationMs: Math.round(performance.now() - t0),
  players: bots.length,
  matchesStarted,
  matchesCompleted,
  matchesInterrupted,
  disconnects,
  errors: errors.slice(0, 50),
  snapshotIntervalMs: distribution(snapshotIntervals),
  pingRttMs: distribution(pingRtts),
});
writeFileSync(values.out!, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, errors: summary.errors.length }, null, 2));
console.log(summary.passed ? 'Soak passed' : `Soak failed: ${summary.failures.join('; ')}`);
process.exit(summary.passed ? 0 : 1);
