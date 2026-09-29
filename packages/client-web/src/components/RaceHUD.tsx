import { ITEM_DEFINITIONS } from '@dtr/shared-items';
import {
  colorById,
  type ItemType,
  type MatchPhase,
  type PlayerColorId,
} from '@dtr/shared-protocol';
import type { ConnectionStatus } from '../net/GameSocket.js';

export interface HudState {
  phase: MatchPhase;
  countdownMs: number;
  raceEndsInMs: number | null;
  position: number | null;
  playerCount: number;
  floor: number;
  floorCount: number;
  heldItem: ItemType | null;
  penaltyMs: number;
  penaltyKind: 'fall' | 'knockdown' | null;
  speedBoostMs: number;
  shieldMs: number;
  finishRank: number | null;
  latencyMs: number | null;
  snapshotAgeMs: number | null;
  events: Array<{ id: number; text: string }>;
  ranking: Array<{
    id: string;
    nickname: string;
    color: PlayerColorId;
    slotIndex: number;
    finishRank: number | null;
    isLocal: boolean;
  }>;
}

interface Props {
  hud: HudState;
  connection: ConnectionStatus;
  onOpenHelp: () => void;
}

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`;

export function RaceHUD({ hud, connection, onOpenHelp }: Props) {
  const countdown = hud.phase === 'countdown' ? Math.ceil(hud.countdownMs / 1000) : null;
  const item = hud.heldItem ? ITEM_DEFINITIONS[hud.heldItem] : null;
  const objective =
    hud.finishRank !== null
      ? `You rescued Motzfeldt — ${ordinal(hud.finishRank)} place!`
      : hud.floor >= hud.floorCount - 2
        ? 'Climb the last ladder to Motzfeldt!'
        : `Climb to Motzfeldt — floor ${hud.floor + 1} of ${hud.floorCount}`;

  return (
    <div className="hud">
      <section className="hud-top-left" aria-label="Race standings">
        <div className="hud-position" aria-label="Position">
          {hud.position ? ordinal(hud.position) : '–'}
          <span className="muted">/{hud.playerCount}</span>
        </div>
        <ol className="hud-ranking">
          {hud.ranking.map((p) => (
            <li key={p.id} className={p.isLocal ? 'me' : undefined}>
              <span
                className="swatch"
                style={{ background: colorById(p.color).hex }}
                aria-hidden="true"
              />
              <span>
                P{p.slotIndex + 1} {p.nickname}
                {p.finishRank !== null && ' 🏁'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="hud-objective" role="status" aria-label="Objective">
        {objective}
        {hud.raceEndsInMs !== null && hud.phase === 'racing' && (
          <span className="hud-timer"> · race ends in {Math.ceil(hud.raceEndsInMs / 1000)}s</span>
        )}
      </section>

      {countdown !== null && countdown > 0 && (
        <div className="hud-countdown" role="status" aria-live="assertive" aria-label="Countdown">
          {countdown}
        </div>
      )}
      {hud.phase === 'racing' &&
        hud.countdownMs === 0 &&
        hud.penaltyMs === 0 &&
        hud.finishRank === null && (
          <span className="visually-hidden" role="status">
            Go!
          </span>
        )}

      {hud.penaltyMs > 0 && (
        <div className="hud-penalty" role="status" aria-label="Penalty">
          {hud.penaltyKind === 'fall' ? 'Respawning' : 'Seeing stars'} …{' '}
          {(hud.penaltyMs / 1000).toFixed(1)}s
        </div>
      )}

      <section className="hud-item" aria-label="Power-up">
        <div className={`item-slot${item ? ' full' : ''}`}>
          <span aria-hidden="true">{item?.icon ?? '?'}</span>
        </div>
        <div>
          <strong>{item ? item.displayName : 'No item'}</strong>
          <small>{item ? 'Press E to use' : 'Grab a ? box'}</small>
          {hud.speedBoostMs > 0 && (
            <small className="effect">Kaffe Boost {(hud.speedBoostMs / 1000).toFixed(1)}s</small>
          )}
          {hud.shieldMs > 0 && (
            <small className="effect">Shield {(hud.shieldMs / 1000).toFixed(1)}s</small>
          )}
        </div>
      </section>

      <section className="hud-feed" aria-label="Race events" aria-live="polite">
        {hud.events.slice(0, 4).map((e) => (
          <p key={e.id}>{e.text}</p>
        ))}
      </section>

      <section className="hud-controls" aria-label="Controls">
        <span>
          <kbd>W</kbd>/<kbd>↑</kbd> run &amp; climb
        </span>
        <span>
          <kbd>A</kbd>
          <kbd>D</kbd> lanes
        </span>
        <span>
          <kbd>Space</kbd> jump
        </span>
        <span>
          <kbd>E</kbd> item
        </span>
        <button type="button" className="link-button" onClick={onOpenHelp}>
          Help (?)
        </button>
      </section>

      <section className="hud-connection" aria-label="Connection">
        {connection !== 'open' ? (
          <span className="warn" role="status">
            {connection === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </span>
        ) : (
          <span className="muted">
            {hud.latencyMs !== null ? `${hud.latencyMs} ms` : '…'}
            {hud.snapshotAgeMs !== null && ` · ${hud.snapshotAgeMs} ms`}
          </span>
        )}
      </section>
    </div>
  );
}
