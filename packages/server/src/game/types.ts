import type { ClientInputCommand, GameEvent, ItemType, PlayerColorId } from '@dtr/shared-protocol';
import type { MotionState, MovementInput } from '@dtr/shared-simulation';

export interface MatchPlayerInfo {
  id: string;
  slotIndex: number;
  nickname: string;
  color: PlayerColorId;
  connected: boolean;
  /** Computer-controlled: the server generates its input every tick. */
  isBot?: boolean;
}

export interface PlayerSim {
  info: MatchPlayerInfo;
  motion: MotionState;
  inputQueue: ClientInputCommand[];
  currentInput: MovementInput;
  inputTicksLeft: number;
  lastInputSeq: number;
  movementDisabledUntilMs: number;
  knockedDown: boolean;
  fallPenalty: boolean;
  falling: boolean;
  heldItem: ItemType | null;
  useItemRequested: boolean;
  speedBoostUntilMs: number;
  shieldUntilMs: number;
  finishRank: number | null;
  finishTick: number | null;
  removed: boolean;
}

export interface BarrelSim {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  floor: number;
  dropping: boolean;
  targetFloor: number;
  ladderDecisions: Set<string>;
}

export interface ItemBoxSim {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnAtMs: number;
}

export type EmitEvent = (event: Omit<GameEvent, 'serverTimeMs'>) => void;

export interface MatchStats {
  barrelHits: number;
  falls: number;
  shoves: number;
  itemUses: number;
  disconnects: number;
}
