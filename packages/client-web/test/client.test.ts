import { describe, expect, it } from 'vitest';
import { MVP_VERTICAL_MAP as LEVEL } from '@dtr/shared-level';
import type { AuthoritativeSnapshot, PlayerSnapshot } from '@dtr/shared-protocol';
import { createMotionState } from '@dtr/shared-simulation';
import { mapRoomEntryError } from '../src/errors/roomEntryErrorMapper.js';
import { cameraDirection, mapKeysToInput } from '../src/input/keyboard.js';
import { ServerClock, SnapshotBuffer } from '../src/net/interpolation.js';
import { LocalPredictor, SNAP_THRESHOLD } from '../src/net/prediction.js';
import { startBlocker, type LobbyView } from '../src/screens/MultiplayerLobby.js';

const keys = { forward: false, back: false, left: false, right: false, jump: false };
const ctx = { disabled: false, speedMultiplier: 1 };

function player(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 'me',
    slotIndex: 0,
    nickname: 'Me',
    color: 'red',
    x: 10,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    facing: 1,
    floor: 0,
    grounded: true,
    climbing: null,
    movementDisabledUntilMs: 0,
    knockedDown: false,
    fallPenalty: false,
    falling: false,
    heldItem: null,
    speedBoostUntilMs: 0,
    shieldUntilMs: 0,
    finishRank: null,
    lastInputSeq: 0,
    inputTicksLeft: 0,
    connected: true,
    progress: 0,
    ...overrides,
  };
}

function snapshot(tick: number, players: PlayerSnapshot[]): AuthoritativeSnapshot {
  return {
    tick,
    serverTimeMs: (tick * 1000) / 60,
    phase: 'racing',
    raceStartsAtMs: 0,
    raceEndsAtMs: null,
    players,
    barrels: [],
    itemBoxes: [],
    boss: { x: 38.5, y: 16, z: 0, throwing: false },
    finishOrder: [],
  };
}

describe('keyboard mapping', () => {
  it('maps forward/right relative to the run direction', () => {
    expect(mapKeysToInput({ ...keys, forward: true, right: true }, 1)).toMatchObject({
      moveX: 1,
      moveZ: 1,
      climb: 1,
    });
    expect(mapKeysToInput({ ...keys, forward: true, right: true }, -1)).toMatchObject({
      moveX: -1,
      moveZ: -1,
      climb: 1,
    });
    expect(mapKeysToInput({ ...keys, back: true }, 1)).toMatchObject({ moveX: -1, climb: -1 });
  });

  it('faces the next floor while climbing', () => {
    const climbing = { ...createMotionState(36, 2, 0, 0), climbing: 'l0', grounded: false };
    expect(cameraDirection(LEVEL, createMotionState(10, 0, 0, 0))).toBe(1);
    expect(cameraDirection(LEVEL, climbing)).toBe(-1);
  });
});

describe('room entry errors', () => {
  it('maps codes to focus targets and recovery actions', () => {
    expect(mapRoomEntryError('INVALID_NICKNAME')).toMatchObject({
      focusTarget: 'nickname',
      action: 'edit-nickname',
    });
    expect(mapRoomEntryError('ROOM_NOT_FOUND')).toMatchObject({
      focusTarget: 'roomCode',
      action: 'retry-room-code',
    });
    expect(mapRoomEntryError('ROOM_EXPIRED').action).toBe('create-new-room');
    expect(mapRoomEntryError('ROOM_FULL').action).toBe('retry-later');
    expect(mapRoomEntryError('ROOM_IN_PROGRESS').action).toBe('return-to-entry');
  });
});

describe('lobby start blocker', () => {
  const lobby: LobbyView = {
    roomCode: 'A7K2Q',
    state: 'lobby',
    hostId: 'h',
    maxPlayers: 5,
    minPlayers: 2,
    players: [
      {
        id: 'h',
        slotIndex: 0,
        nickname: 'Host',
        color: 'red',
        role: 'host',
        ready: true,
        connected: true,
      },
    ],
  };

  it('explains why the host cannot start yet', () => {
    expect(startBlocker(lobby)).toMatch(/at least 2/);
    const withGuest = {
      ...lobby,
      players: [
        ...lobby.players,
        {
          id: 'g',
          slotIndex: 1,
          nickname: 'Guest',
          color: 'blue' as const,
          role: 'participant' as const,
          ready: false,
          connected: true,
        },
      ],
    };
    expect(startBlocker(withGuest)).toMatch(/Guest/);
    withGuest.players[1]!.ready = true;
    expect(startBlocker(withGuest)).toBeNull();
  });
});

describe('local prediction', () => {
  it('predicts movement immediately and replays unacknowledged inputs', () => {
    const predictor = new LocalPredictor(LEVEL);
    predictor.reconcile(player(), ctx);
    const run = { moveX: 1, moveZ: 0, climb: 0, jump: false };
    predictor.applyInput(run, ctx);
    predictor.applyInput(run, ctx);
    predictor.applyInput(run, ctx);
    const predictedX = predictor.state!.x;
    expect(predictedX).toBeGreaterThan(10);

    // Server has processed only the first input: replaying the other two lands on the same spot.
    const afterOne = 10 + 6 * (2 / 60);
    predictor.reconcile(player({ x: afterOne, vx: 6, lastInputSeq: 1 }), ctx);
    expect(predictor.state!.x).toBeCloseTo(predictedX, 5);
    expect(predictor.pendingCount).toBe(2);
    expect(predictor.lastCorrectionDistance).toBeLessThan(0.01);
  });

  it('smooths small corrections and snaps large ones', () => {
    const predictor = new LocalPredictor(LEVEL);
    predictor.reconcile(player(), ctx);
    predictor.reconcile(player({ x: 10.5 }), ctx);
    const smoothed = predictor.renderPosition(0)!;
    expect(smoothed.x).toBeCloseTo(10, 5);
    expect(predictor.renderPosition(1)!.x).toBeCloseTo(10.5, 3);

    predictor.reconcile(player({ x: 10.5 + SNAP_THRESHOLD + 1 }), ctx);
    expect(predictor.renderPosition(0)!.x).toBeCloseTo(10.5 + SNAP_THRESHOLD + 1, 5);
  });
});

describe('snapshot interpolation', () => {
  it('interpolates remote players between snapshots and excludes the local player', () => {
    const buffer = new SnapshotBuffer();
    buffer.add(snapshot(60, [player({ id: 'me' }), player({ id: 'other', x: 10 })]));
    buffer.add(snapshot(63, [player({ id: 'me' }), player({ id: 'other', x: 11 })]));
    const sampled = buffer.sampleRemotePlayers(1025, 'me');
    expect(sampled.has('me')).toBe(false);
    expect(sampled.get('other')!.x).toBeCloseTo(10.5, 5);
  });

  it('estimates server time from snapshot arrivals', () => {
    const clock = new ServerClock();
    clock.observe(1000, 5000);
    expect(clock.now(5100)).toBe(1100);
  });
});
