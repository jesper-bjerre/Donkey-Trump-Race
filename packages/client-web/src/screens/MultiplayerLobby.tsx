import { useState } from 'react';
import type { LobbyPlayer, RoomSession, RoomState } from '@dtr/shared-protocol';
import { LobbyRoster } from '../components/lobby/LobbyRoster.js';
import { mapRoomEntryError } from '../errors/roomEntryErrorMapper.js';
import { ApiError, startMatch } from '../net/api.js';
import type { ConnectionStatus, GameSocket } from '../net/GameSocket.js';

export interface LobbyView {
  roomCode: string;
  state: RoomState;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  minPlayers: number;
}

interface Props {
  session: RoomSession;
  socket: GameSocket;
  lobby: LobbyView | null;
  connection: ConnectionStatus;
  notice: string | null;
  onLeave: () => void;
  onOpenHelp: () => void;
}

export function startBlocker(lobby: LobbyView): string | null {
  if (lobby.players.length < lobby.minPlayers)
    return `Waiting for at least ${lobby.minPlayers} players.`;
  const waiting = lobby.players.filter((p) => p.id !== lobby.hostId && !p.ready);
  if (waiting.length > 0)
    return `Waiting for ${waiting.map((p) => p.nickname).join(', ')} to be ready.`;
  return null;
}

export function MultiplayerLobby({
  session,
  socket,
  lobby,
  connection,
  notice,
  onLeave,
  onOpenHelp,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const me = lobby?.players.find((p) => p.id === session.playerId);
  const isHost = lobby ? lobby.hostId === session.playerId : session.role === 'host';
  const blocker = lobby ? startBlocker(lobby) : 'Connecting…';
  const roomCode = lobby?.roomCode ?? session.roomCode;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await startMatch(roomCode, socket.token);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? mapRoomEntryError(e.envelope.error.code).message
          : 'Could not start.',
      );
    } finally {
      setStarting(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="screen lobby" aria-labelledby="lobby-title">
      <header className="lobby-header">
        <h1 id="lobby-title">Lobby</h1>
        <div className="room-code-block">
          <span className="muted" id="room-code-label">
            Room code
          </span>
          <output className="room-code" aria-labelledby="room-code-label">
            {roomCode}
          </output>
          <button type="button" className="secondary small" onClick={() => void copyLink()}>
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
        </div>
      </header>

      {connection !== 'open' && (
        <p className="notice" role="status">
          {connection === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="card" aria-labelledby="players-title">
        <h2 id="players-title">
          Players ({lobby?.players.length ?? 1}/{lobby?.maxPlayers ?? 5})
        </h2>
        {lobby && (
          <LobbyRoster
            players={lobby.players}
            maxCapacity={lobby.maxPlayers}
            localPlayerId={session.playerId}
          />
        )}
      </section>

      <section className="card lobby-actions" aria-label="Match controls">
        {lobby?.state === 'in_progress' && <p role="status">A match is running…</p>}
        {!isHost && me && (
          <button
            type="button"
            className={me.ready ? 'secondary' : 'primary'}
            aria-pressed={me.ready}
            onClick={() => socket.send({ type: 'client.ready', ready: !me.ready })}
          >
            {me.ready ? 'Not ready' : "I'm ready"}
          </button>
        )}
        {isHost && (
          <>
            <button
              type="button"
              className="primary"
              disabled={blocker !== null || starting || lobby?.state !== 'lobby'}
              aria-describedby="start-status"
              onClick={() => void start()}
            >
              {starting ? 'Starting…' : 'Start race'}
            </button>
            <p id="start-status" className="muted" role="status">
              {blocker ?? 'Everyone is ready!'}
            </p>
          </>
        )}
        {!isHost && <p className="muted">The host starts the race when everyone is ready.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="link-button" onClick={onOpenHelp}>
            Controls &amp; help
          </button>
          <button type="button" className="link-button" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </section>
    </main>
  );
}
