import { FLOOR_SPACING } from '@dtr/shared-level';

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const TICK_DT = 1 / TICK_RATE;
/** Server broadcasts a snapshot every N ticks (60 / 3 = 20 Hz). */
export const SNAPSHOT_EVERY_TICKS = 3;
/** Each client input command covers this many simulation ticks (60 / 2 = 30 Hz). */
export const TICKS_PER_INPUT = 2;

export const RUN_SPEED = 6;
export const LANE_SPEED = 4;
export const CLIMB_SPEED = 3;
export const GRAVITY = 30;
/** Jump reaches only half the distance between floors — floor-to-floor jumps are impossible. */
export const JUMP_APEX = FLOOR_SPACING / 2;
export const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_APEX);

export const PLAYER_RADIUS = 0.45;
export const PLAYER_HEIGHT = 1.5;

/** Knockback velocity decays by this factor per second (exponential). */
export const KNOCKBACK_DECAY = 6;
export const SHOVE_STRENGTH = 9;
export const SHOVE_MIN_CLOSING_SPEED = 0.5;
export const SHOVE_PAIR_COOLDOWN_MS = 300;

/** Once a player drops this far below the floor they left, the fall is confirmed. */
export const FALL_CONFIRM_DEPTH = 3;

export const STUN_MS = 2000;
export const FALL_PENALTY_MS = 2000;

export const BARREL_RADIUS = 0.5;
export const BARREL_HALF_LENGTH = 0.45;
export const BARREL_SPEED = 5;
export const BARREL_GRAVITY = 20;
export const BARREL_LADDER_DROP_CHANCE = 0.3;
export const BARREL_MAX_ACTIVE = 14;
export const BOSS_THROW_INTERVAL_MS = 2200;
export const BOSS_THROW_JITTER_MS = 600;
export const BOSS_THROW_WINDUP_MS = 450;
export const BOSS_FIRST_THROW_DELAY_MS = 1500;

export const ITEM_BOX_RADIUS = 0.8;
export const ITEM_BOX_RESPAWN_MS = 8000;

export const COUNTDOWN_MS = 3000;
export const FINISH_GRACE_MS = 30000;
export const MATCH_MAX_MS = 5 * 60 * 1000;
