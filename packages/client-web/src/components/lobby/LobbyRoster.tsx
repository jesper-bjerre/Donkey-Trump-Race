import { colorById, slotLabel, type LobbyPlayer } from '@dtr/shared-protocol';

interface Props {
  players: LobbyPlayer[];
  maxCapacity: number;
  localPlayerId: string;
}

export function LobbyRoster({ players, maxCapacity, localPlayerId }: Props) {
  const slots = Array.from(
    { length: maxCapacity },
    (_, i) => players.find((p) => p.slotIndex === i) ?? null,
  );
  return (
    <ol className="roster" aria-label="Players">
      {slots.map((player, index) => {
        if (!player) {
          return (
            <li key={`empty-${index}`} className="roster-row empty">
              <span className="avatar empty-avatar" aria-hidden="true" />
              <span className="roster-name">
                <span className="slot-label">{slotLabel(index)}</span>
                <span className="muted">Waiting for player…</span>
              </span>
            </li>
          );
        }
        const color = colorById(player.color);
        if (player.isBot) {
          return (
            <li
              key={player.id}
              className="roster-row bot"
              style={{ ['--player-color' as string]: color.hex }}
              aria-label={`${slotLabel(index)}, ${player.nickname}, ${color.label}, computer player until someone joins`}
            >
              <img className="avatar" src="/sprites/face-lokke.webp" alt="" />
              <span className="roster-name">
                <span className="slot-label">
                  {slotLabel(index)} · {color.label}
                </span>
                <strong>{player.nickname}</strong>
              </span>
              <span className="badges">
                <span className="badge bot">Computer</span>
              </span>
            </li>
          );
        }
        return (
          <li
            key={player.id}
            className="roster-row"
            style={{ ['--player-color' as string]: color.hex }}
            aria-label={`${slotLabel(index)}, ${player.nickname}, ${color.label}${player.role === 'host' ? ', host' : ''}${player.ready ? ', ready' : ', not ready'}${player.connected ? '' : ', disconnected'}`}
          >
            <img className="avatar" src="/sprites/face-lokke.webp" alt="" />
            <span className="roster-name">
              <span className="slot-label">
                {slotLabel(index)} · {color.label}
              </span>
              <strong>
                {player.nickname}
                {player.id === localPlayerId && ' (you)'}
              </strong>
            </span>
            <span className="badges">
              {player.role === 'host' && <span className="badge host">Host</span>}
              {player.ready ? (
                <span className="badge ready">Ready</span>
              ) : (
                <span className="badge">Not ready</span>
              )}
              {!player.connected && <span className="badge warn">Offline</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
