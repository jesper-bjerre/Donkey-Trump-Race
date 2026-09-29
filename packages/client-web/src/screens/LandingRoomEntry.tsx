import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  GAME_TITLE,
  isValidNickname,
  isValidRoomCode,
  type RoomSession,
} from '@dtr/shared-protocol';
import { mapRoomEntryError, type EntryErrorView } from '../errors/roomEntryErrorMapper.js';
import { ApiError, createRoom, joinRoom } from '../net/api.js';

interface Props {
  onJoined: (session: RoomSession) => void;
  onOpenHelp: () => void;
  notice: string | null;
}

function initialRoomCode(): string {
  const code = new URLSearchParams(window.location.search).get('room') ?? '';
  return code.toUpperCase().slice(0, 5);
}

export function LandingRoomEntry({ onJoined, onOpenHelp, notice }: Props) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<EntryErrorView | null>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const roomCodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nicknameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error?.focusTarget === 'nickname') nicknameRef.current?.focus();
    if (error?.focusTarget === 'roomCode') roomCodeRef.current?.focus();
  }, [error]);

  const run = async (kind: 'create' | 'join') => {
    if (!isValidNickname(nickname)) {
      setError(mapRoomEntryError('INVALID_NICKNAME'));
      return;
    }
    if (kind === 'join' && !isValidRoomCode(roomCode)) {
      setError(mapRoomEntryError('INVALID_ROOM_CODE'));
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const session =
        kind === 'create' ? await createRoom(nickname) : await joinRoom(roomCode, nickname);
      onJoined(session);
    } catch (e) {
      setError(mapRoomEntryError(e instanceof ApiError ? e.envelope.error.code : 'INTERNAL_ERROR'));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(roomCode.trim() ? 'join' : 'create');
  };

  return (
    <main className="screen entry" aria-labelledby="game-title">
      <header className="hero">
        <img className="hero-sprite hero-left" src="/sprites/lokke-red-front.png" alt="" />
        <div className="hero-text">
          <h1 id="game-title">{GAME_TITLE}</h1>
          <p className="tagline">
            Race up the tower as Jumpman Løkke, dodge the barrels and rescue Motzfeldt first!
          </p>
        </div>
        <img className="hero-sprite hero-right" src="/sprites/trump-front.png" alt="" />
      </header>

      <section className="card entry-card" aria-label="Create or join a room">
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              ref={nicknameRef}
              value={nickname}
              maxLength={16}
              autoComplete="nickname"
              aria-invalid={error?.focusTarget === 'nickname'}
              aria-describedby="nickname-hint"
              onChange={(e) => setNickname(e.target.value)}
            />
            <small id="nickname-hint">2–16 letters, numbers, spaces, hyphen or underscore.</small>
          </div>
          <div className="field">
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              ref={roomCodeRef}
              value={roomCode}
              maxLength={5}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="code-input"
              aria-invalid={error?.focusTarget === 'roomCode'}
              aria-describedby="room-code-hint"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <small id="room-code-hint">Leave empty to host a new room.</small>
          </div>

          {error && (
            <div className="error" role="alert">
              <p>{error.message}</p>
              {error.action === 'create-new-room' && (
                <button type="button" className="link-button" onClick={() => void run('create')}>
                  {error.actionLabel}
                </button>
              )}
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy !== null}
              onClick={() => void run('create')}
            >
              {busy === 'create' ? 'Creating…' : 'Create room'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy !== null}
              onClick={() => void run('join')}
            >
              {busy === 'join' ? 'Joining…' : 'Join room'}
            </button>
          </div>
        </form>
        <button type="button" className="link-button help-link" onClick={onOpenHelp}>
          How to play &amp; privacy
        </button>
      </section>
      <footer className="fineprint">
        A parody party game. Guest play only — no accounts. Up to 5 players per room.
      </footer>
    </main>
  );
}
