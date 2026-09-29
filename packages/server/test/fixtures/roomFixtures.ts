import { PLAYER_COLOR_IDS } from '@dtr/shared-protocol';

/** Deterministic nicknames for a full five-player room (host first). */
export const FIVE_PLAYER_NICKNAMES = [
  'LarsFan',
  'Mette',
  'Jumpman Løkke',
  'Søren_2',
  'Anne-Grethe',
];
export const SIXTH_NICKNAME = 'Sneaky Sixth';

/** Slot colors in join order: every occupied slot gets a distinct one. */
export const EXPECTED_SLOT_COLORS = [...PLAYER_COLOR_IDS];

export const SAMPLE_ROOM_CODES = { valid: 'A7K2Q', malformed: 'nope', ambiguous: 'AOK2Q' };

export interface FakeClock {
  now: () => number;
  advance(ms: number): void;
  set(ms: number): void;
}

export function createFakeClock(start = Date.parse('2026-12-10T18:00:00Z')): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (ms) => {
      current = ms;
    },
  };
}
