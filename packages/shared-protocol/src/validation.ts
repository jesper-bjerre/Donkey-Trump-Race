import { z } from 'zod';

/** Unicode letters/digits plus space, hyphen, underscore. Supports names like "Løkke". */
export const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]{2,16}$/u;
/** 5 characters, excluding ambiguous I, O, 0 and 1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;

export function normalizeNickname(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function isValidNickname(raw: string): boolean {
  return NICKNAME_PATTERN.test(normalizeNickname(raw));
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRoomCode(raw: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(raw));
}

/** Maximum accepted room token length; real tokens are ~250 bytes. */
export const MAX_ROOM_TOKEN_LENGTH = 1024;

export const nicknameSchema = z
  .string()
  .max(64)
  .transform(normalizeNickname)
  .pipe(z.string().regex(NICKNAME_PATTERN));

export const roomCodeSchema = z
  .string()
  .max(16)
  .transform(normalizeRoomCode)
  .pipe(z.string().regex(ROOM_CODE_PATTERN));

/** Structural check only (`base64url.base64url`); the signature is verified server-side. */
export const roomTokenSchema = z
  .string()
  .min(3)
  .max(MAX_ROOM_TOKEN_LENGTH)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
