import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validateRoomTokenClaims, type Role, type RoomTokenClaims } from '@dtr/shared-protocol';

export interface TokenSubject {
  roomCode: string;
  playerId: string;
  slotIndex: number;
  role: Role;
}

export interface IssuedToken {
  token: string;
  claims: RoomTokenClaims;
}

/** Compact HMAC-SHA256 signed tokens: base64url(claims).base64url(signature). */
export class RoomTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (secret.length < 16) throw new Error('Room token secret is too short');
  }

  issue(subject: TokenSubject): IssuedToken {
    const iat = this.now();
    const claims: RoomTokenClaims = {
      ...subject,
      iat,
      exp: iat + this.ttlMs,
      nonce: randomBytes(8).toString('base64url'),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { token: `${payload}.${this.sign(payload)}`, claims };
  }

  verify(token: string): RoomTokenClaims | null {
    if (typeof token !== 'string' || token.length > 1024) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    return validateRoomTokenClaims(decoded, this.now());
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
