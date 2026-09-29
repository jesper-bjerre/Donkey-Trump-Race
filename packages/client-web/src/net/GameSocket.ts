import {
  CLOSE_CODES,
  encodeClientMessage,
  parseServerMessage,
  type ClientInputCommand,
  type ClientMessageBody,
  type ServerMessage,
} from '@dtr/shared-protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

type Listener = (message: ServerMessage) => void;
type StatusListener = (status: ConnectionStatus, detail?: string) => void;

const RECONNECT_WINDOW_MS = 55_000;
const PING_INTERVAL_MS = 2000;
/** Close codes after which reconnecting cannot help. */
const FATAL_CLOSE_CODES = new Set<number>([
  CLOSE_CODES.unauthenticated,
  CLOSE_CODES.forbidden,
  CLOSE_CODES.replaced,
  CLOSE_CODES.roomClosed,
]);

export interface ConnectionMetrics {
  latencyMs: number | null;
  lastMessageAt: number;
}

/**
 * Authenticated WebSocket to the game server. Sends client.hello with the room token,
 * refreshes the token when the server rotates it, and reconnects inside the grace window.
 */
export class GameSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private roomToken: string;
  private disconnectedAt: number | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private attempt = 0;
  private stopped = false;
  status: ConnectionStatus = 'connecting';
  readonly metrics: ConnectionMetrics = { latencyMs: null, lastMessageAt: 0 };

  constructor(
    roomToken: string,
    private readonly url = GameSocket.defaultUrl(),
  ) {
    this.roomToken = roomToken;
  }

  static defaultUrl(): string {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws`;
  }

  get token(): string {
    return this.roomToken;
  }

  /** Idempotent: a second call while a socket exists is ignored. */
  connect(): void {
    if (this.socket || this.stopped) return;
    this.open();
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.socket?.close(1000, 'bye');
    this.socket = null;
    this.setStatus('closed');
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  send(body: ClientMessageBody): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encodeClientMessage(body));
  }

  sendInput(input: ClientInputCommand): void {
    this.send({ type: 'client.input', input });
  }

  private open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.setStatus(this.disconnectedAt === null ? 'connecting' : 'reconnecting');

    socket.onopen = () => {
      socket.send(encodeClientMessage({ type: 'client.hello', roomToken: this.roomToken }));
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed = parseServerMessage(event.data);
      if (!parsed.ok) return;
      const message = parsed.message;
      this.metrics.lastMessageAt = performance.now();
      switch (message.type) {
        case 'server.welcome':
          this.disconnectedAt = null;
          this.attempt = 0;
          this.setStatus('open');
          this.startPing();
          break;
        case 'server.session':
          this.roomToken = message.roomToken;
          break;
        case 'server.pong':
          this.metrics.latencyMs = Math.round(performance.now() - message.t);
          break;
        default:
          break;
      }
      for (const listener of this.listeners) listener(message);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      if (this.stopped) return;
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this.setStatus('closed', event.reason || 'Connection closed');
        return;
      }
      this.disconnectedAt ??= Date.now();
      if (Date.now() - this.disconnectedAt > RECONNECT_WINDOW_MS) {
        this.setStatus('closed', 'Your slot is no longer available.');
        return;
      }
      this.setStatus('reconnecting');
      const delay = Math.min(5000, 400 * 2 ** this.attempt++);
      this.reconnectTimer = window.setTimeout(() => this.open(), delay);
    };
  }

  private startPing(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    const ping = () => this.send({ type: 'client.ping', t: performance.now() });
    ping();
    this.pingTimer = window.setInterval(ping, PING_INTERVAL_MS);
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status, detail);
  }
}
