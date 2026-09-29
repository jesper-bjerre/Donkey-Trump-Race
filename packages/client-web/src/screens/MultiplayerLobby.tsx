import { useState } from 'react';
import type { LobbyPlayer, RoomSession, RoomState } from '@dtr/shared-protocol';
import { HostStartButton } from '../components/lobby/HostStartButton.js';
import { LobbyRoster } from '../components/lobby/LobbyRoster.js';
import { useRosterAnnouncements } from '../components/lobby/useRosterAnnouncements.js';
import { mapRoomEntryError } from '../errors/roomEntryErrorMapper.js';
import { ApiError, startMatch } from '../net/api.js';
import type { ConnectionStatus, GameSocket } from '../net/GameSocket.js';
import { inviteUrl } from '../routing/routes.js';

/** Must match the server's RECONNECT_GRACE_MS. */
export const RECONNECT_GRACE_SECONDS = 60;

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
  const announcement = useRosterAnnouncements(lobby?.players, session.playerId);

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
    const url = inviteUrl(window.location.origin, roomCode);
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
          Players ({lobby?.players.filter((p) => !p.isBot).length ?? 1}/{lobby?.maxPlayers ?? 5})
        </h2>
        {lobby?.players.some((p) => p.isBot) && (
          <p className="muted">
            Computer players fill the empty spots — anyone who joins takes one over.
          </p>
        )}
        {lobby && (
          <LobbyRoster
            players={lobby.players}
            maxCapacity={lobby.maxPlayers}
            localPlayerId={session.playerId}
          />
        )}
        <p className="muted reconnect-hint" id="reconnect-hint">
          Lost your connection? Your slot is kept for {RECONNECT_GRACE_SECONDS} seconds — the game
          reconnects automatically.
        </p>
        <p className="visually-hidden" aria-live="polite" data-testid="roster-announcement">
          {announcement}
        </p>
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
          <HostStartButton
            blocker={blocker}
            starting={starting}
            inLobby={lobby?.state === 'lobby'}
            onStart={() => void start()}
          />
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
