import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MVP_VERTICAL_MAP } from '@dtr/shared-level';
import type {
  FinishEntry,
  MatchHighlights,
  RoomSession,
  ServerMessage,
} from '@dtr/shared-protocol';
import { HelpPrivacyModal } from './components/help/HelpPrivacyModal.js';
import { GameSocket, type ConnectionStatus } from './net/GameSocket.js';
import { MatchSession } from './net/MatchSession.js';
import { LandingRoomEntry } from './screens/LandingRoomEntry.js';
import { MatchResults } from './screens/MatchResults.js';
import { MultiplayerLobby, type LobbyView } from './screens/MultiplayerLobby.js';

// Three.js is only needed once a race starts; keep it out of the landing bundle.
const MatchScreen = lazy(() =>
  import('./screens/MatchScreen.js').then((m) => ({ default: m.MatchScreen })),
);

type Screen = 'entry' | 'lobby' | 'match' | 'results';

export interface MatchResult {
  matchId: string;
  finishOrder: FinishEntry[];
  highlights: MatchHighlights;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('entry');
  const [session, setSession] = useState<RoomSession | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [match, setMatch] = useState<MatchSession | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const socketRef = useRef<GameSocket | null>(null);
  const matchRef = useRef<MatchSession | null>(null);

  const leave = useCallback((message?: string) => {
    socketRef.current?.close();
    socketRef.current = null;
    matchRef.current?.dispose();
    matchRef.current = null;
    setMatch(null);
    setSession(null);
    setLobby(null);
    setResult(null);
    setNotice(message ?? null);
    setScreen('entry');
  }, []);

  const handleJoined = useCallback((joined: RoomSession) => {
    socketRef.current?.close();
    const socket = new GameSocket(joined.roomToken);
    socketRef.current = socket;
    setSession(joined);
    setNotice(null);
    setScreen('lobby');
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !session) return;
    const offStatus = socket.onStatus((next, detail) => {
      setStatus(next);
      if (next === 'closed' && detail) leave(detail);
    });
    const offMessage = socket.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'server.lobbyState':
          setLobby({
            roomCode: message.roomCode,
            state: message.state,
            hostId: message.hostId,
            players: message.players,
            maxPlayers: message.maxPlayers,
            minPlayers: message.minPlayers,
          });
          break;
        case 'server.matchStart':
          if (matchRef.current?.matchId !== message.matchId) {
            matchRef.current?.dispose();
            matchRef.current = new MatchSession(
              message.matchId,
              MVP_VERTICAL_MAP,
              session.playerId,
              socket,
            );
            setMatch(matchRef.current);
          }
          setScreen('match');
          break;
        case 'server.matchEnded':
          setResult({
            matchId: message.matchId,
            finishOrder: message.finishOrder,
            highlights: message.highlights,
          });
          setScreen('results');
          break;
        case 'server.error':
          setNotice(message.message);
          break;
        default:
          break;
      }
    });
    setStatus(socket.status);
    // Connect only after subscribing so no early lobby/match message is missed.
    socket.connect();
    return () => {
      offStatus();
      offMessage();
    };
  }, [session, leave]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '?' || (event.key === 'F1' && !event.repeat)) {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const socket = socketRef.current;

  return (
    <div className="app">
      {screen === 'entry' && (
        <LandingRoomEntry
          onJoined={handleJoined}
          notice={notice}
          onOpenHelp={() => setHelpOpen(true)}
        />
      )}
      {screen === 'lobby' && session && socket && (
        <MultiplayerLobby
          session={session}
          socket={socket}
          lobby={lobby}
          connection={status}
          notice={notice}
          onLeave={() => leave()}
          onOpenHelp={() => setHelpOpen(true)}
        />
      )}
      {screen === 'match' && match && session && (
        <Suspense
          fallback={
            <p className="screen" role="status">
              Loading the tower…
            </p>
          }
        >
          <MatchScreen match={match} connection={status} onOpenHelp={() => setHelpOpen(true)} />
        </Suspense>
      )}
      {screen === 'results' && result && session && (
        <MatchResults
          result={result}
          localPlayerId={session.playerId}
          onBackToLobby={() => setScreen('lobby')}
          onLeave={() => leave()}
        />
      )}
      {helpOpen && <HelpPrivacyModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
