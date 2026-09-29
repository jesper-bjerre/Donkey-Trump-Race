import type { LobbyPlayer, RoomSession } from '@dtr/shared-protocol';
import type { LobbyView } from '../../src/screens/MultiplayerLobby.js';

const NAMES = ['LarsFan', 'Mette', 'Jumpman Løkke', 'Søren_2', 'Anne-Grethe'] as const;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const;

export function lobbyPlayer(slotIndex: number, overrides: Partial<LobbyPlayer> = {}): LobbyPlayer {
  return {
    id: `p_${slotIndex}`,
    slotIndex,
    nickname: NAMES[slotIndex]!,
    color: COLORS[slotIndex]!,
    role: slotIndex === 0 ? 'host' : 'participant',
    ready: slotIndex === 0,
    connected: true,
    ...overrides,
  };
}

export function lobbyView(playerCount: number, overrides: Partial<LobbyView> = {}): LobbyView {
  return {
    roomCode: 'A7K2Q',
    state: 'lobby',
    hostId: 'p_0',
    players: Array.from({ length: playerCount }, (_, i) => lobbyPlayer(i)),
    maxPlayers: 5,
    minPlayers: 2,
    ...overrides,
  };
}

export function roomSession(slotIndex = 0): RoomSession {
  const p = lobbyPlayer(slotIndex);
  return {
    roomCode: 'A7K2Q',
    playerId: p.id,
    slotIndex,
    color: p.color,
    role: p.role,
    roomToken: 'eyJzYW1wbGUiOnRydWV9.c2lnbmF0dXJl',
    expiresAt: 1_790_001_800_000,
    websocketUrl: 'ws://localhost/ws',
    roster: [p],
  };
}

/** Minimal stand-in for GameSocket in component tests. */
export function fakeSocket() {
  const sent: unknown[] = [];
  return {
    sent,
    token: 'eyJzYW1wbGUiOnRydWV9.c2lnbmF0dXJl',
    send: (body: unknown) => sent.push(body),
  };
}
