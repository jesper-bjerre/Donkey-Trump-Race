import { describe, expect, it } from 'vitest';
import { RoomTokenService } from '../src/auth/roomTokens.js';

const SECRET = 'test-secret-placeholder-0123456789';
const subject = { roomCode: 'A7K2Q', playerId: 'p_1', slotIndex: 0, role: 'host' as const };

describe('RoomTokenService', () => {
  it('signs and verifies scoped claims', () => {
    const tokens = new RoomTokenService(SECRET, 60_000, () => 1000);
    const { token } = tokens.issue(subject);
    expect(tokens.verify(token)).toMatchObject({ ...subject, iat: 1000, exp: 61_000 });
  });

  it('rejects expired tokens', () => {
    let now = 1000;
    const tokens = new RoomTokenService(SECRET, 60_000, () => now);
    const { token } = tokens.issue(subject);
    now = 61_000;
    expect(tokens.verify(token)).toBeNull();
  });

  it('rejects tampered tokens and foreign signatures', () => {
    const tokens = new RoomTokenService(SECRET, 60_000);
    const { token } = tokens.issue(subject);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...subject, role: 'host', playerId: 'p_2' })).toString('base64url');
    expect(tokens.verify(`${forged}.${signature}`)).toBeNull();
    expect(tokens.verify(`${payload}.x${signature}`)).toBeNull();
    const other = new RoomTokenService('another-secret-placeholder-xyz', 60_000);
    expect(other.verify(token)).toBeNull();
    expect(tokens.verify('garbage')).toBeNull();
  });
});
