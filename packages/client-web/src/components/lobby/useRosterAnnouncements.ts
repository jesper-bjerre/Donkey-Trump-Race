import { useEffect, useRef, useState } from 'react';
import type { LobbyPlayer } from '@dtr/shared-protocol';

/** Describes what changed between two rosters, for a polite screen-reader announcement. */
export function describeRosterChange(
  previous: readonly LobbyPlayer[],
  next: readonly LobbyPlayer[],
  localPlayerId: string,
): string | null {
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
    if (!old.connected && player.connected) messages.push(`${player.nickname} is back.`);
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
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!players) return;
    if (previous.current) {
      const message = describeRosterChange(previous.current, players, localPlayerId);
      if (message) setAnnouncement(message);
    }
    previous.current = players;
  }, [players, localPlayerId]);
  return announcement;
}
