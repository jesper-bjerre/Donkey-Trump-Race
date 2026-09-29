import WebSocket from 'ws';
import {
  encodeClientMessage,
  MAX_CLIENT_MESSAGE_BYTES,
  type ClientMessageBody,
  type ServerMessage,
} from '@dtr/shared-protocol';

/** Sample client frames for gateway tests. */
export const realtimeFrames = {
  hello: (roomToken: string) => encodeClientMessage({ type: 'client.hello', roomToken }),
  invalidTokenHello: encodeClientMessage({ type: 'client.hello', roomToken: 'forged.token' }),
  oversize: 'x'.repeat(MAX_CLIENT_MESSAGE_BYTES + 10),
  ping: (t = 1) => encodeClientMessage({ type: 'client.ping', t }),
  input: (seq: number, moveX = 1): string =>
    encodeClientMessage({
      type: 'client.input',
      input: { seq, moveX, moveZ: 0, climb: 0, jump: false },
    }),
  outOfBoundsInput: JSON.stringify({
    type: 'client.input',
    protocolVersion: 1,
    input: { seq: 1, moveX: 5, moveZ: 0, climb: 0, jump: false },
  }),
  ready: (ready = true) => encodeClientMessage({ type: 'client.ready', ready }),
  desync: (tick: number, correctionDistance: number) =>
    encodeClientMessage({ type: 'client.desyncReport', tick, correctionDistance }),
};

export interface TestClient {
  socket: WebSocket;
  messages: ServerMessage[];
  closed: Promise<{ code: number; reason: string }>;
  send(body: ClientMessageBody | string): void;
  waitFor<T extends ServerMessage['type']>(
    type: T,
    predicate?: (m: Extract<ServerMessage, { type: T }>) => boolean,
    timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { type: T }>>;
}

export function connectClient(
  url: string,
  registry?: WebSocket[],
  options: WebSocket.ClientOptions = {},
): Promise<TestClient> {
  const socket = new WebSocket(url, options);
  registry?.push(socket);
  const messages: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  socket.on('message', (data) => {
    messages.push(JSON.parse(data.toString()));
    waiters.splice(0).forEach((w) => w());
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() })),
  );
  const waitFor: TestClient['waitFor'] = (type, predicate, timeoutMs = 3000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      const check = () => {
        const found = messages.find(
          (m) => m.type === type && (!predicate || predicate(m as never)),
        );
        if (found) {
          clearTimeout(timer);
          resolve(found as never);
        } else waiters.push(check);
      };
      check();
    });
  const send = (body: ClientMessageBody | string) =>
    socket.send(typeof body === 'string' ? body : encodeClientMessage(body));
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, messages, closed, send, waitFor }));
    socket.once('error', reject);
  });
}
