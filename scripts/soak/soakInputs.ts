/** Default soak configuration: the PRD's closed-beta target of 20 concurrent 5-player rooms. */
export const SOAK_DEFAULTS = {
  rooms: 20,
  playersPerRoom: 5,
  maxDurationSec: 330,
  out: 'soak-summary.json',
} as const;

/** Deterministic bot names; each bot also gets its own user agent so REST limits apply per bot. */
export function botNickname(room: number, slot: number): string {
  return `Bot ${String(room).padStart(2, '0')}-${slot + 1}`;
}

export function botUserAgent(room: number, slot: number): string {
  return `dtr-soak-bot/${room}.${slot}`;
}
