import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import {
  COLOR_TOKENS,
  CONTRAST_PAIRS,
  contrastRatio,
  cssVarName,
  type ColorToken,
} from '../src/accessibility/tokens.js';
import { describeRosterChange } from '../src/components/lobby/useRosterAnnouncements.js';
import { MAX_EXTRAPOLATION_MS, SnapshotBuffer } from '../src/net/interpolation.js';
import { LocalPredictor, RECONCILE_THRESHOLD } from '../src/net/prediction.js';
import { inviteUrl, parseRoute, routePath } from '../src/routing/routes.js';
import { rescueProgressPct } from '../src/screens/MatchScreen.js';
import { lobbyPlayer } from './fixtures/lobbyFixtures.js';
import { player, snapshot } from './fixtures/playerSnapshots.js';

describe('accessibility tokens', () => {
  it('keeps tokens.css in sync with tokens.ts', () => {
    const css = readFileSync(new URL('../src/accessibility/tokens.css', import.meta.url), 'utf8');
    for (const [token, value] of Object.entries(COLOR_TOKENS)) {
      expect(css, token).toContain(`${cssVarName(token as ColorToken)}: ${value};`);
    }
  });

  it.each(CONTRAST_PAIRS)(
    '$foreground on $background meets $minimum:1 ($usage)',
    ({ foreground, background, minimum }) => {
      expect(
        contrastRatio(COLOR_TOKENS[foreground], COLOR_TOKENS[background]),
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it('computes WCAG contrast correctly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('routes', () => {
  it('parses invite, results, privacy and legacy links', () => {
    expect(parseRoute('/rooms/a7k2q')).toEqual({ name: 'room', roomCode: 'A7K2Q' });
    expect(parseRoute('/rooms/A7K2Q/results/')).toEqual({ name: 'results', roomCode: 'A7K2Q' });
    expect(parseRoute('/privacy')).toEqual({ name: 'privacy' });
    expect(parseRoute('/', '?room=b3c4d')).toEqual({ name: 'room', roomCode: 'B3C4D' });
    expect(parseRoute('/rooms/<script>')).toEqual({ name: 'home' });
    expect(routePath({ name: 'results', roomCode: 'A7K2Q' })).toBe('/rooms/A7K2Q/results');
    expect(inviteUrl('https://game.test', 'A7K2Q')).toBe('https://game.test/rooms/A7K2Q');
  });
});

describe('roster announcements', () => {
  it('describes joins, readiness, disconnects, host changes and departures', () => {
    const before = [lobbyPlayer(0), lobbyPlayer(1)];
    expect(describeRosterChange(before, [...before, lobbyPlayer(2)], 'p_0')).toBe(
      'Jumpman Løkke joined.',
    );
    expect(
      describeRosterChange(before, [lobbyPlayer(0), lobbyPlayer(1, { ready: true })], 'p_0'),
    ).toBe('Mette is ready.');
    expect(
      describeRosterChange(before, [lobbyPlayer(0), lobbyPlayer(1, { connected: false })], 'p_0'),
    ).toBe('Mette lost connection.');
    expect(describeRosterChange(before, [lobbyPlayer(1, { role: 'host' })], 'p_1')).toBe(
      'LarsFan left the room.',
    );
    expect(describeRosterChange(before, before, 'p_0')).toBeNull();
  });
});

describe('reconciliation threshold', () => {
  it('leaves state untouched below the threshold and applies larger corrections', () => {
    const ctx = { disabled: false, speedMultiplier: 1 };
    const predictor = new LocalPredictor(LEVEL);
    predictor.reconcile(player(), ctx);
    const tiny = predictor.reconcile(player({ x: 10 + RECONCILE_THRESHOLD / 2 }), ctx);
    expect(tiny.applied).toBe(false);
    expect(predictor.state!.x).toBe(10);
    expect(predictor.corrections).toBe(0);
    const real = predictor.reconcile(player({ x: 11 }), ctx);
    expect(real).toEqual({ distance: 1, applied: true });
    expect(predictor.state!.x).toBe(11);
  });
});

describe('interpolation metrics', () => {
  it('counts stale snapshots and extrapolates briefly past the newest one', () => {
    const buffer = new SnapshotBuffer();
    buffer.add(snapshot(60, [player({ id: 'other', x: 10, vx: 6 })]));
    buffer.add(snapshot(60, [player({ id: 'other', x: 10, vx: 6 })]));
    expect(buffer.metrics.staleDropped).toBe(1);
    const newest = 1000;
    const late = buffer.sampleRemotePlayers(newest + 50, 'me').get('other')!;
    expect(late.x).toBeCloseTo(10 + 6 * 0.05, 5);
    const veryLate = buffer.sampleRemotePlayers(newest + 1000, 'me').get('other')!;
    expect(veryLate.x).toBeCloseTo(10 + 6 * (MAX_EXTRAPOLATION_MS / 1000), 5);
    expect(buffer.metrics.extrapolated).toBe(2);
    expect(buffer.metrics.samples).toBe(2);
  });
});

describe('HUD rescue progress', () => {
  it('runs from 0% at the start to 100% at Motzfeldt', () => {
    expect(rescueProgressPct(LEVEL, 0)).toBe(0);
    expect(rescueProgressPct(LEVEL, 1e9)).toBe(100);
    const mid = rescueProgressPct(LEVEL, 2 * 40 + 20);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(80);
  });
});
