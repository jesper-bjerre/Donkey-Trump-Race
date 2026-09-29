import type { LevelMetadata } from '@dtr/shared-level';
import type { MotionState, MovementInput } from '@dtr/shared-simulation';

const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const JUMP = ['Space'];
const USE_ITEM = ['KeyE', 'ShiftLeft', 'ShiftRight', 'Enter'];
const GAME_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT, ...JUMP, ...USE_ITEM]);

export interface KeyState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

/**
 * The chase camera always looks along the floor's run direction, so "forward" and
 * "right" are camera-relative and mapped here to world axes.
 */
export function mapKeysToInput(keys: KeyState, runDirection: 1 | -1): MovementInput {
  const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const right = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return {
    moveX: forward * runDirection,
    moveZ: right * runDirection,
    climb: forward,
    jump: keys.jump,
  };
}

/** Camera/controls direction for a player: the run direction of its floor, or of the floor it is climbing to. */
export function cameraDirection(level: LevelMetadata, state: MotionState): 1 | -1 {
  if (state.climbing) {
    const ladder = level.ladders.find((l) => l.id === state.climbing);
    const top = level.floors.find((f) => f.id === ladder?.topFloorId);
    if (top) return top.runDirection;
  }
  return level.floors[state.floor]?.runDirection ?? 1;
}

export class KeyboardController {
  private readonly pressed = new Set<string>();
  private useItemQueued = false;

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  keyState(): KeyState {
    const any = (codes: string[]) => codes.some((c) => this.pressed.has(c));
    return {
      forward: any(FORWARD),
      back: any(BACK),
      left: any(LEFT),
      right: any(RIGHT),
      jump: any(JUMP),
    };
  }

  /** Returns true once per item key press. */
  consumeUseItem(): boolean {
    const queued = this.useItemQueued;
    this.useItemQueued = false;
    return queued;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!GAME_KEYS.has(event.code) || isTypingTarget(event.target)) return;
    event.preventDefault();
    if (USE_ITEM.includes(event.code) && !event.repeat) this.useItemQueued = true;
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.code);
  };

  private readonly onBlur = () => {
    this.pressed.clear();
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
