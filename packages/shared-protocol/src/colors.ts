export const MAX_PLAYERS = 5;

export const PLAYER_COLORS = [
  { id: 'red', hex: '#e53935', label: 'Red' },
  { id: 'blue', hex: '#1e88e5', label: 'Blue' },
  { id: 'green', hex: '#43a047', label: 'Green' },
  { id: 'yellow', hex: '#fdd835', label: 'Yellow' },
  { id: 'purple', hex: '#8e24aa', label: 'Purple' },
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];
export type PlayerColorId = PlayerColor['id'];

export const PLAYER_COLOR_IDS = PLAYER_COLORS.map((c) => c.id) as [
  PlayerColorId,
  ...PlayerColorId[],
];

export function colorForSlot(slotIndex: number): PlayerColor {
  const color = PLAYER_COLORS[slotIndex];
  if (!color) throw new RangeError(`No color for slot ${slotIndex}`);
  return color;
}

export function colorById(id: PlayerColorId): PlayerColor {
  return PLAYER_COLORS.find((c) => c.id === id) ?? PLAYER_COLORS[0];
}

export function slotLabel(slotIndex: number): string {
  return `Player ${slotIndex + 1}`;
}
