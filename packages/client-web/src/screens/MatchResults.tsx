import { useEffect, useRef } from 'react';
import { colorById, slotLabel } from '@dtr/shared-protocol';
import type { MatchResult } from '../App.js';

interface Props {
  result: MatchResult;
  localPlayerId: string;
  onBackToLobby: () => void;
  onLeave: () => void;
}

export function MatchResults({ result, localPlayerId, onBackToLobby, onLeave }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const winner = result.finishOrder[0];
  const mine = result.finishOrder.find((f) => f.playerId === localPlayerId);

  return (
    <main className="screen results" aria-labelledby="results-title">
      <header className="results-header">
        <img className="results-face" src="/sprites/face-motzfeldt-happy.webp" alt="" />
        <div>
          <h1 id="results-title" ref={headingRef} tabIndex={-1}>
            {winner
              ? `${winner.nickname} rescued Motzfeldt!`
              : 'Nobody reached Motzfeldt this time'}
          </h1>
          <p className="muted">
            {mine ? `You finished #${mine.rank}.` : 'You did not reach the top — next time!'}
          </p>
        </div>
      </header>

      <section className="card" aria-labelledby="order-title">
        <h2 id="order-title">Rescue order</h2>
        {result.finishOrder.length === 0 ? (
          <p className="muted">No finishers.</p>
        ) : (
          <ol className="rescue-order">
            {result.finishOrder.map((entry) => {
              const color = colorById(entry.color);
              return (
                <li key={entry.playerId} style={{ ['--player-color' as string]: color.hex }}>
                  <span className="rank">#{entry.rank}</span>
                  <span className="swatch" aria-hidden="true" />
                  <span>
                    <strong>{entry.nickname}</strong>
                    {entry.playerId === localPlayerId && ' (you)'}
                    <small className="muted">
                      {' '}
                      {slotLabel(entry.slotIndex)} · {color.label} ·{' '}
                      {(entry.serverTimeMs / 1000).toFixed(1)}s
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card" aria-labelledby="highlights-title">
        <h2 id="highlights-title">Race highlights</h2>
        <dl className="highlights">
          <div>
            <dt>Barrel hits</dt>
            <dd>{result.highlights.barrelHits}</dd>
          </div>
          <div>
            <dt>Falls</dt>
            <dd>{result.highlights.falls}</dd>
          </div>
          <div>
            <dt>Shoves</dt>
            <dd>{result.highlights.shoves}</dd>
          </div>
          <div>
            <dt>Items used</dt>
            <dd>{result.highlights.itemUses}</dd>
          </div>
        </dl>
      </section>

      <div className="actions">
        <button type="button" className="primary" onClick={onBackToLobby}>
          Back to lobby
        </button>
        <button type="button" className="link-button" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </main>
  );
}
