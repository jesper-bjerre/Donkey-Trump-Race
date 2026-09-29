import type { MatchHighlights } from '@dtr/shared-protocol';

interface Props {
  highlights: MatchHighlights;
}

export function RaceHighlights({ highlights }: Props) {
  const items: Array<[string, string | number]> = [
    [
      'Fastest rescue',
      highlights.fastestRescueMs === null
        ? '—'
        : `${(highlights.fastestRescueMs / 1000).toFixed(1)}s`,
    ],
    ['Barrel hits', highlights.barrelHits],
    ['Falls', highlights.falls],
    ['Shoves', highlights.shoves],
    ['Items used', highlights.itemUses],
    ['Disconnects', highlights.disconnects],
  ];
  return (
    <dl className="highlights">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
