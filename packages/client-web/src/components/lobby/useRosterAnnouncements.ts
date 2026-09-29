import { useEffect, useRef, useState } from 'react';
import type { LobbyPlayer } from '@dtr/shared-protocol';

/**
 * Describes what changed between two rosters, for a polite screen-reader announcement.
 * `everConnected` holds players seen online before: a player appears in the roster just
 * before their socket connects, and that first connect is not a "comeback".
 */
export function describeRosterChange(
  allPrevious: readonly LobbyPlayer[],
  allNext: readonly LobbyPlayer[],
  localPlayerId: string,
  everConnected: ReadonlySet<string> = new Set(
    allPrevious.filter((p) => p.connected && !p.isBot).map((p) => p.id),
  ),
): string | null {
  // Computer players come and go as humans join and leave; only humans are announced.
  const previous = allPrevious.filter((p) => !p.isBot);
  const next = allNext.filter((p) => !p.isBot);
  const before = new Map(previous.map((p) => [p.id, p]));
  const after = new Map(next.map((p) => [p.id, p]));
  const messages: string[] = [];
  for (const player of next) {
    const old = before.get(player.id);
    if (player.id === localPlayerId && old) continue;
    if (!old) {
      if (player.id !== localPlayerId) messages.push(`${player.nickname} joined.`);
      continue;
    }
    if (old.connected && !player.connected) messages.push(`${player.nickname} lost connection.`);
    if (!old.connected && player.connected && everConnected.has(player.id))
      messages.push(`${player.nickname} is back.`);
    if (!old.ready && player.ready && player.role !== 'host')
      messages.push(`${player.nickname} is ready.`);
    if (old.role !== 'host' && player.role === 'host')
      messages.push(`${player.nickname} is now the host.`);
  }
  for (const player of previous) {
    if (!after.has(player.id)) messages.push(`${player.nickname} left the room.`);
  }
  return messages.length > 0 ? messages.join(' ') : null;
}

export function useRosterAnnouncements(
  players: readonly LobbyPlayer[] | undefined,
  localPlayerId: string,
): string {
  const previous = useRef<readonly LobbyPlayer[] | null>(null);
  const everConnected = useRef(new Set<string>());
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!players) return;
    if (previous.current) {
      const message = describeRosterChange(
        previous.current,
        players,
        localPlayerId,
        everConnected.current,
      );
      if (message) setAnnouncement(message);
    }
    previous.current = players;
    for (const p of players) if (p.connected) everConnected.current.add(p.id);
  }, [players, localPlayerId]);
  return announcement;
}
