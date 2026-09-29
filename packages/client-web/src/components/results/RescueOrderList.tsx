import { colorById, slotLabel, type FinishEntry } from '@dtr/shared-protocol';

interface Props {
  finishOrder: FinishEntry[];
  localPlayerId: string;
  /** Match time the race began, to show race time rather than time since countdown. */
  raceStartMs?: number;
}

/** Server-confirmed rescue order, rendered exactly as received (never re-sorted locally). */
export function RescueOrderList({ finishOrder, localPlayerId, raceStartMs = 0 }: Props) {
  if (finishOrder.length === 0) return <p className="muted">No finishers.</p>;
  return (
    <ol className="rescue-order">
      {finishOrder.map((entry) => {
        const color = colorById(entry.color);
        const seconds = Math.max(0, entry.serverTimeMs - raceStartMs) / 1000;
        return (
          <li key={entry.playerId} style={{ ['--player-color' as string]: color.hex }}>
            <span className="rank">#{entry.rank}</span>
            <span className="swatch" aria-hidden="true" />
            <span>
              <strong>{entry.nickname}</strong>
              {entry.playerId === localPlayerId && ' (you)'}
              <small className="muted">
                {' '}
                {slotLabel(entry.slotIndex)} · {color.label} · {seconds.toFixed(1)}s
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
