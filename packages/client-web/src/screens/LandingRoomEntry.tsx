import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  GAME_TITLE,
  isValidNickname,
  isValidRoomCode,
  type RoomSession,
} from '@dtr/shared-protocol';
import { RoomEntryRecovery } from '../components/entry/RoomEntryRecovery.js';
import {
  mapRoomEntryError,
  type EntryAction,
  type EntryErrorView,
} from '../errors/roomEntryErrorMapper.js';
import { ApiError, createRoom, joinRoom } from '../net/api.js';
import {
  detectBrowserSupport,
  SUPPORTED_BROWSERS_TEXT,
  type BrowserSupport,
} from '../platform/browserSupport.js';

interface Props {
  onJoined: (session: RoomSession) => void;
  onOpenHelp: () => void;
  notice: string | null;
  /** Prefilled from an invite link (/rooms/ABCDE). */
  initialRoomCode?: string;
  /** Injectable for tests; defaults to real feature detection. */
  browserSupport?: BrowserSupport;
}

export function LandingRoomEntry({
  onJoined,
  onOpenHelp,
  notice,
  initialRoomCode = '',
  browserSupport,
}: Props) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase().slice(0, 5));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<EntryErrorView | null>(null);
  const [lastKind, setLastKind] = useState<'create' | 'join'>('join');
  const nicknameRef = useRef<HTMLInputElement>(null);
  const roomCodeRef = useRef<HTMLInputElement>(null);
  const support = useMemo(() => browserSupport ?? detectBrowserSupport(), [browserSupport]);

  useEffect(() => {
    nicknameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error?.focusTarget === 'nickname') nicknameRef.current?.focus();
    if (error?.focusTarget === 'roomCode') roomCodeRef.current?.focus();
  }, [error]);

  const run = async (kind: 'create' | 'join') => {
    setLastKind(kind);
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

  const recover = (action: EntryAction) => {
    switch (action) {
      case 'edit-nickname':
        nicknameRef.current?.focus();
        nicknameRef.current?.select();
        break;
      case 'retry-room-code':
        roomCodeRef.current?.focus();
        roomCodeRef.current?.select();
        break;
      case 'return-to-entry':
        setRoomCode('');
        setError(null);
        roomCodeRef.current?.focus();
        break;
      case 'create-new-room':
        setRoomCode('');
        void run('create');
        break;
      case 'retry-later':
      case 'retry':
        void run(lastKind);
        break;
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
        {!support.supported && (
          <p className="notice browser-notice" role="note">
            {SUPPORTED_BROWSERS_TEXT}
            {!support.webgl && ' This browser did not provide WebGL, so the 3D race may not load.'}
          </p>
        )}
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

          {error && <RoomEntryRecovery error={error} onAction={recover} />}

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
        <div className="actions">
          <button type="button" className="link-button help-link" onClick={onOpenHelp}>
            How to play &amp; privacy
          </button>
          <a className="link-button" href="/privacy">
            Privacy notice
          </a>
        </div>
      </section>
      <footer className="fineprint">
        A parody party game. Guest play only — no accounts. Up to 5 players per room.
      </footer>
    </main>
  );
}
