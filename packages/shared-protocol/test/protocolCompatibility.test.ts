import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  clientInputMessageSchema,
  itemUseCommandSchema,
  nicknameSchema,
  parseWebSocketMessage,
  roomCodeSchema,
  roomTokenSchema,
  validateWebSocketMessage,
} from '../src/index.js';
import serverSnapshot from './fixtures/serverSnapshot.v1.json' with { type: 'json' };

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('protocolCompatibility', () => {
  const messages: Record<string, unknown> = {
    'client.hello': fixture('example-client-hello.json'),
    'client.input': fixture('clientInput.valid.json'),
    'server.snapshot': { type: 'server.snapshot', protocolVersion: 1, snapshot: serverSnapshot },
    'server.error': fixture('websocketServerError.tokenViolation.json'),
    'server.matchEnded': fixture('serverMatchEnded.v1.json'),
  };

  for (const [type, message] of Object.entries(messages)) {
    it(`round-trips ${type} without changing type or protocolVersion`, () => {
      const parsed = parseWebSocketMessage(JSON.stringify(message));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.message.type).toBe(type);
      expect(parsed.message.protocolVersion).toBe(1);
      expect(JSON.parse(JSON.stringify(parsed.message))).toEqual(message);
    });
  }

  it('requires protocolVersion on every message', () => {
    const { protocolVersion: _v, ...withoutVersion } = messages['client.input'] as Record<
      string,
      unknown
    >;
    expect(validateWebSocketMessage(withoutVersion)).toBeNull();
    expect(validateWebSocketMessage({ ...withoutVersion, protocolVersion: 2 })).toBeNull();
  });

  it('exposes named validation schemas', () => {
    expect(nicknameSchema.parse('  Jumpman   Løkke ')).toBe('Jumpman Løkke');
    expect(nicknameSchema.safeParse('<b>').success).toBe(false);
    expect(roomCodeSchema.parse('a7k2q')).toBe('A7K2Q');
    expect(roomCodeSchema.safeParse('A7K2').success).toBe(false);
    expect(roomTokenSchema.safeParse('abc.def').success).toBe(true);
    expect(roomTokenSchema.safeParse('not a token').success).toBe(false);
    expect(clientInputMessageSchema.safeParse(messages['client.input']).success).toBe(true);
    expect(
      itemUseCommandSchema.safeParse({ type: 'client.useItem', protocolVersion: 1 }).success,
    ).toBe(true);
  });
});
