import { describe, expect, it } from 'vitest';
import { SoundDirector, type SoundFrame, type SoundPlayer } from '../src/audio/SoundDirector.js';
import type { SoundName, SoundSink } from '../src/audio/SoundEngine.js';

function recorder() {
  const played: Array<{ name: SoundName; volume: number }> = [];
  let rumble = 0;
  const sink: SoundSink = {
    play: (name, volume) => played.push({ name, volume }),
    setRumble: (level) => {
      rumble = level;
    },
  };
  return { sink, played, names: () => played.map((p) => p.name), rumble: () => rumble };
}

const me = (overrides: Partial<SoundPlayer> = {}): SoundPlayer => ({
  id: 'me',
  x: 0,
  y: 0,
  z: 0,
  grounded: true,
  climbing: false,
  isLocal: true,
  ...overrides,
});

function frame(overrides: Partial<SoundFrame> = {}): SoundFrame {
  return {
    players: [me()],
    barrels: [],
    bossThrowing: false,
    boss: { x: 40, y: 20, z: 0 },
    phase: 'racing',
    countdownMs: 0,
    events: [],
    ...overrides,
  };
}

describe('SoundDirector', () => {
  it('plays footsteps while walking and rung clanks while climbing', () => {
    const { sink, names } = recorder();
    const director = new SoundDirector(sink);
    for (let i = 0; i <= 20; i++) director.update(frame({ players: [me({ x: i * 0.1 })] }));
    expect(names().filter((n) => n === 'footstep')).toHaveLength(2);

    const before = names().length;
    for (let i = 0; i <= 11; i++)
      director.update(
        frame({ players: [me({ x: 2, y: i * 0.1, grounded: false, climbing: true })] }),
      );
    expect(
      names()
        .slice(before)
        .filter((n) => n === 'ladderRung'),
    ).toHaveLength(2);
    expect(names()).not.toContain('jump');
  });

  it('plays a jump and a landing', () => {
    const { sink, names } = recorder();
    const director = new SoundDirector(sink);
    director.update(frame());
    director.update(frame({ players: [me({ y: 0.3, grounded: false })] }));
    director.update(frame({ players: [me({ y: 0, grounded: true })] }));
    expect(names()).toEqual(['jump', 'land']);
  });

  it('stays silent on teleports such as a respawn', () => {
    const { sink, names } = recorder();
    const director = new SoundDirector(sink);
    director.update(frame());
    director.update(frame({ players: [me({ x: 30 })] }));
    expect(names()).toEqual([]);
  });

  it('rumbles for rolling barrels nearby and clonks when they drop down a ladder', () => {
    const { sink, names, rumble } = recorder();
    const director = new SoundDirector(sink);
    const barrel = { id: 1, x: 2, y: 0, z: 0, vx: -5, vy: 0, dropping: false };
    director.update(frame());
    director.update(frame({ barrels: [barrel] }));
    expect(names()).toContain('barrelThrow');
    expect(rumble()).toBeGreaterThan(0.5);
    director.update(frame({ barrels: [{ ...barrel, dropping: true }] }));
    director.update(frame({ barrels: [{ ...barrel, y: -4 }] }));
    expect(names()).toEqual(['barrelThrow', 'barrelDrop', 'barrelLand']);
    director.update(frame());
    expect(rumble()).toBe(0);
  });

  it('plays event sounds once, loud for you and quieter for distant racers', () => {
    const { sink, played } = recorder();
    const director = new SoundDirector(sink);
    const far: SoundPlayer = { ...me(), id: 'far', isLocal: false, x: 40 };
    director.update(frame({ players: [me(), far] }));
    const events = [
      { id: 2, kind: 'barrelHit' as const, playerId: 'far', serverTimeMs: 0 },
      { id: 1, kind: 'barrelHit' as const, playerId: 'me', serverTimeMs: 0 },
    ];
    director.update(frame({ players: [me(), far], events }));
    director.update(frame({ players: [me(), far], events }));
    const hits = played.filter((p) => p.name === 'barrelHit');
    expect(hits).toHaveLength(2);
    expect(hits[0]!.volume).toBe(1);
    expect(hits[1]!.volume).toBeLessThan(0.1);
    expect(played.filter((p) => p.name === 'dizzy')).toHaveLength(1);
  });

  it('beeps the countdown and says go', () => {
    const { sink, names } = recorder();
    const director = new SoundDirector(sink);
    for (const ms of [3500, 2900, 2500, 1900, 900, 100])
      director.update(frame({ phase: 'countdown', countdownMs: ms }));
    director.update(frame({ phase: 'racing' }));
    expect(names()).toEqual(['countdownBeep', 'countdownBeep', 'countdownBeep', 'go']);
  });
});
