import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MVP_VERTICAL_MAP } from '@dtr/shared-level';
import type { RoomSession, ServerMessage } from '@dtr/shared-protocol';
import { StructuredError } from './components/common/StructuredError.js';
import { HelpPrivacyModal } from './components/help/HelpPrivacyModal.js';
import { ApiError, replayMatch } from './net/api.js';
import { GameSocket, type ConnectionStatus } from './net/GameSocket.js';
import { MatchSession } from './net/MatchSession.js';
import { navigate, parseRoute, type Route } from './routing/routes.js';
import { LandingRoomEntry } from './screens/LandingRoomEntry.js';
import { MatchResults, type MatchResult } from './screens/MatchResults.js';
import { MultiplayerLobby, type LobbyView } from './screens/MultiplayerLobby.js';
import { PrivacyPage } from './screens/PrivacyPage.js';

// Three.js is only needed once a race starts; keep it out of the landing bundle.
const MatchScreen = lazy(() =>
  import('./screens/MatchScreen.js').then((m) => ({ default: m.MatchScreen })),
);

type Screen = 'entry' | 'lobby' | 'match' | 'results' | 'interrupted' | 'privacy';

export type { MatchResult };

/** Why the client left a room involuntarily. Connection loss cannot be recovered in place. */
export interface Interruption {
  reason: 'connection_lost';
  recoverable: false;
  message: string;
  roomCode: string;
}

/** server.error codes that are informational and should not replace the lobby notice. */
const QUIET_ERROR_CODES = new Set(['RATE_LIMITED', 'BAD_REQUEST']);

function currentRoute(): Route {
  return parseRoute(window.location.pathname, window.location.search);
}

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [screen, setScreen] = useState<Screen>(() =>
    currentRoute().name === 'privacy' ? 'privacy' : 'entry',
  );
  const [session, setSession] = useState<RoomSession | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [match, setMatch] = useState<MatchSession | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [notice, setNotice] = useState<string | null>(null);
  const [interruption, setInterruption] = useState<Interruption | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const socketRef = useRef<GameSocket | null>(null);
  const matchRef = useRef<MatchSession | null>(null);
  const noticeRef = useRef<string | null>(null);
  noticeRef.current = notice;

  const go = useCallback((next: Route, mode: 'push' | 'replace' = 'push') => {
    navigate(next, mode);
    setRoute(next);
  }, []);

  const teardown = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    matchRef.current?.dispose();
    matchRef.current = null;
    setMatch(null);
    setSession(null);
    setLobby(null);
    setResult(null);
  }, []);

  const leave = useCallback(
    (message?: string) => {
      teardown();
      setNotice(message ?? null);
      setScreen('entry');
      go({ name: 'home' });
    },
    [teardown, go],
  );

  const interrupt = useCallback(
    (detail: string, roomCode: string) => {
      teardown();
      setInterruption({
        reason: 'connection_lost',
        recoverable: false,
        message: noticeRef.current ?? detail,
        roomCode,
      });
      setNotice(null);
      setScreen('interrupted');
    },
    [teardown],
  );

  const handleJoined = useCallback(
    (joined: RoomSession) => {
      socketRef.current?.close();
      const socket = new GameSocket(joined.roomToken);
      socketRef.current = socket;
      setSession(joined);
      setNotice(null);
      setInterruption(null);
      setScreen('lobby');
      go({ name: 'room', roomCode: joined.roomCode });
    },
    [go],
  );

  useEffect(() => {
    const onPop = () => {
      const next = currentRoute();
      setRoute(next);
      if (next.name === 'privacy') setScreen('privacy');
      else if (next.name === 'home' && !socketRef.current) setScreen('entry');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !session) return;
    const offStatus = socket.onStatus((next, detail) => {
      setStatus(next);
      if (next === 'closed' && detail) interrupt(detail, session.roomCode);
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
          navigate({ name: 'room', roomCode: session.roomCode }, 'replace');
          break;
        case 'server.matchEnded':
          setResult({
            matchId: message.matchId,
            finishOrder: message.finishOrder,
            highlights: message.highlights,
            outcome: message.outcome,
            canReplay: message.canReplay,
          });
          setScreen('results');
          navigate({ name: 'results', roomCode: session.roomCode }, 'replace');
          break;
        case 'server.error':
          if (!QUIET_ERROR_CODES.has(message.code)) setNotice(message.message);
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
  }, [session, interrupt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((event.key === '?' && !typing) || (event.key === 'F1' && !event.repeat)) {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const socket = socketRef.current;
  const isHost = !!session && (lobby ? lobby.hostId === session.playerId : session.role === 'host');
  const entryRoomCode =
    route.name === 'room' || route.name === 'results' ? route.roomCode : undefined;

  const replay = async () => {
    if (!session || !socketRef.current) return;
    try {
      await replayMatch(session.roomCode, socketRef.current.token);
    } catch (error) {
      throw new Error(
        error instanceof ApiError ? error.envelope.error.message : 'Could not start a rematch.',
        { cause: error },
      );
    }
  };

  return (
    <div className="app">
      {screen === 'entry' && (
        <LandingRoomEntry
          key={entryRoomCode ?? 'home'}
          onJoined={handleJoined}
          notice={notice}
          initialRoomCode={entryRoomCode}
          onOpenHelp={() => setHelpOpen(true)}
        />
      )}
      {screen === 'privacy' && (
        <PrivacyPage
          onBack={() => {
            setScreen(session ? 'lobby' : 'entry');
            go(session ? { name: 'room', roomCode: session.roomCode } : { name: 'home' });
          }}
        />
      )}
      {screen === 'interrupted' && interruption && (
        <main className="screen interrupted" aria-labelledby="structured-error-title">
          <StructuredError
            headingLevel={1}
            autoFocus
            title="Connection lost"
            message={interruption.message}
            actions={[
              {
                label: 'Rejoin room',
                primary: true,
                onSelect: () => {
                  setScreen('entry');
                  go({ name: 'room', roomCode: interruption.roomCode });
                },
              },
              {
                label: 'Create a new room',
                onSelect: () => {
                  setInterruption(null);
                  setScreen('entry');
                  go({ name: 'home' });
                },
              },
            ]}
          />
        </main>
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
          <MatchScreen
            match={match}
            connection={status}
            onOpenHelp={() => setHelpOpen(true)}
            onLeave={() => leave()}
          />
        </Suspense>
      )}
      {screen === 'results' && result && session && (
        <MatchResults
          result={result}
          localPlayerId={session.playerId}
          isHost={isHost}
          onReplay={replay}
          onBackToLobby={() => {
            setScreen('lobby');
            go({ name: 'room', roomCode: session.roomCode }, 'replace');
          }}
          onLeave={() => leave()}
        />
      )}
      {helpOpen && <HelpPrivacyModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
