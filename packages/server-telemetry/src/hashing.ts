import { createHmac } from 'node:crypto';

/** Minimum salt length; the salt lives in Key Vault in deployed environments. */
export const MIN_HASH_SALT_LENGTH = 16;

export interface PseudonymHasher {
  /** Salted, truncated HMAC of a room code; stable for the lifetime of the salt. */
  roomHash(roomCode: string): string;
  playerHash(playerId: string): string;
  /** Hash of free text supplied by a data subject (privacy requests). */
  subjectHash(reference: string): string;
}

function hmac16(salt: string, domain: string, value: string): string {
  return createHmac('sha256', salt).update(`${domain}:${value}`).digest('hex').slice(0, 16);
}

export function createPseudonymHasher(salt: string): PseudonymHasher {
  if (salt.length < MIN_HASH_SALT_LENGTH) throw new Error('Telemetry hash salt is too short');
  return {
    roomHash: (roomCode) => hmac16(salt, 'room', roomCode.toUpperCase()),
    playerHash: (playerId) => hmac16(salt, 'player', playerId),
    subjectHash: (reference) => hmac16(salt, 'subject', reference.normalize('NFC').trim()),
  };
}

/**
 * Replaces a nickname with a salted pseudonym for logs (`nick_1a2b3c4d`).
 * The original nickname cannot be recovered and never leaves the process.
 */
export function maskNickname(nickname: string, salt: string): string {
  return `nick_${hmac16(salt, 'nick', nickname.normalize('NFC')).slice(0, 8)}`;
}
