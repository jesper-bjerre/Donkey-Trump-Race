/**
 * Post-deploy smoke test for a running environment.
 *
 *   SMOKE_BASE_URL=https://dtr-staging.example.net pnpm smoke:staging
 *   pnpm smoke:staging -- --baseUrl http://localhost:8080
 *
 * Checks /healthz, the client shell, security headers, room creation (201) and a
 * WebSocket hello -> welcome round trip within 5 s. Exits non-zero on any failure.
 * Creates one throwaway room, which expires on its own after 15 minutes.
 */
import { parseArgs } from 'node:util';
import fixture from './fixtures/stagingSmokeRoom.json' with { type: 'json' };

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg, i) => !(i === 0 && arg === '--')),
  options: { baseUrl: { type: 'string' } },
});
const baseUrl = (values.baseUrl ?? process.env.SMOKE_BASE_URL ?? '').replace(/\/+$/, '');
if (!baseUrl) {
  console.error('Set SMOKE_BASE_URL or pass --baseUrl');
  process.exit(2);
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}
const checks: Check[] = [];

async function check(name: string, run: () => Promise<string>): Promise<void> {
  const started = performance.now();
  try {
    const detail = await run();
    checks.push({ name, ok: true, detail, ms: Math.round(performance.now() - started) });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: (error as Error).message,
      ms: Math.round(performance.now() - started),
    });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let session: { roomToken: string; websocketUrl: string; roomCode: string } | null = null;

await check('GET /healthz', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert(res.status === 200, `status ${res.status}`);
  const body = (await res.json()) as { service?: string; status?: string };
  assert(body.service === fixture.expectedService, `service ${body.service}`);
  assert(body.status === 'ok', `status field ${body.status}`);
  return JSON.stringify(body);
});

await check('GET / (client shell and headers)', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert(res.status === 200, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes(`<title>${fixture.expectedTitle}</title>`), 'title missing');
  for (const header of fixture.requiredHeaders) {
    assert(res.headers.has(header), `missing header ${header}`);
  }
  if (baseUrl.startsWith('https://')) {
    assert(res.headers.has('strict-transport-security'), 'missing HSTS on https');
  }
  return `${html.length} bytes`;
});

await check('POST /api/v1/rooms', async () => {
  const res = await fetch(`${baseUrl}/api/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'dtr-smoke/1' },
    body: JSON.stringify({ nickname: fixture.nickname }),
  });
  assert(res.status === 201, `status ${res.status}`);
  session = (await res.json()) as typeof session;
  assert(session?.roomToken && session.websocketUrl, 'session fields missing');
  return `room created, websocket ${session.websocketUrl}`;
});

await check('WebSocket hello -> welcome', async () => {
  assert(session, 'no session from room creation');
  const { websocketUrl, roomToken } = session;
  // Behind a TLS-terminating proxy the server may see http; follow the base URL's scheme.
  const url = baseUrl.startsWith('https://') ? websocketUrl.replace(/^ws:/, 'wss:') : websocketUrl;
  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`no welcome within ${fixture.websocketTimeoutMs} ms`));
    }, fixture.websocketTimeoutMs);
    socket.onopen = () =>
      socket.send(JSON.stringify({ type: 'client.hello', protocolVersion: 1, roomToken }));
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { type: string };
      if (message.type === 'server.welcome') {
        clearTimeout(timer);
        socket.close(1000, 'smoke done');
        resolve('welcome received');
      }
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error('websocket error'));
    };
  });
});

for (const c of checks)
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(36)} ${c.ms} ms  ${c.detail}`);
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'Smoke test passed' : `Smoke test failed (${failed.length})`);
process.exit(failed.length === 0 ? 0 : 1);
