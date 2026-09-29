import { useEffect, useRef, useState } from 'react';
import type { FinishEntry, MatchHighlights } from '@dtr/shared-protocol';
import { StructuredError } from '../components/common/StructuredError.js';
import { RaceHighlights } from '../components/results/RaceHighlights.js';
import { RescueOrderList } from '../components/results/RescueOrderList.js';

export interface MatchResult {
  matchId: string;
  finishOrder: FinishEntry[];
  highlights: MatchHighlights;
  outcome: 'completed' | 'interrupted';
  canReplay: boolean;
}

interface Props {
  result: MatchResult;
  localPlayerId: string;
  isHost: boolean;
  onReplay: () => Promise<void>;
  onBackToLobby: () => void;
  onLeave: () => void;
}

export function MatchResults({
  result,
  localPlayerId,
  isHost,
  onReplay,
  onBackToLobby,
  onLeave,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const winner = result.finishOrder[0];
  const mine = result.finishOrder.find((f) => f.playerId === localPlayerId);
  const interrupted = result.outcome === 'interrupted';

  const replay = async () => {
    setReplaying(true);
    setReplayError(null);
    try {
      await onReplay();
    } catch (error) {
      setReplayError(error instanceof Error ? error.message : 'Could not start a rematch.');
    } finally {
      setReplaying(false);
    }
  };

  return (
    <main className="screen results" aria-labelledby="results-title">
      <header className="results-header">
        <img className="results-face" src="/sprites/face-motzfeldt-happy.webp" alt="" />
        <div>
          <h1 id="results-title" ref={headingRef} tabIndex={-1}>
            {interrupted
              ? 'The race was interrupted'
              : winner
                ? `${winner.nickname} rescued Motzfeldt!`
                : 'Nobody reached Motzfeldt this time'}
          </h1>
          <p className="muted">
            {mine ? `You finished #${mine.rank}.` : 'You did not reach the top — next time!'}
          </p>
        </div>
      </header>

      {interrupted && (
        <StructuredError
          title="Something went wrong on the server"
          message="The match had to stop early. Nobody was penalised — you can start a new race from the lobby."
          actions={[]}
        />
      )}

      <section className="card" aria-labelledby="order-title">
        <h2 id="order-title">Rescue order</h2>
        <RescueOrderList finishOrder={result.finishOrder} localPlayerId={localPlayerId} />
      </section>

      <section className="card" aria-labelledby="highlights-title">
        <h2 id="highlights-title">Race highlights</h2>
        <RaceHighlights highlights={result.highlights} />
      </section>

      <section className="actions" aria-label="What next">
        {isHost && result.canReplay && (
          <button
            type="button"
            className="primary"
            disabled={replaying}
            onClick={() => void replay()}
          >
            {replaying ? 'Starting…' : 'Play again'}
          </button>
        )}
        <button
          type="button"
          className={isHost && result.canReplay ? 'secondary' : 'primary'}
          onClick={onBackToLobby}
        >
          Back to lobby
        </button>
        <button type="button" className="link-button" onClick={onLeave}>
          Leave room
        </button>
      </section>
      <p className="muted" role="status">
        {!result.canReplay
          ? 'Rematch unavailable: not enough players are left in the room.'
          : isHost
            ? ''
            : 'Waiting for the host to start a rematch…'}
      </p>
      {replayError && (
        <p className="error" role="alert">
          {replayError}
        </p>
      )}
    </main>
  );
}
