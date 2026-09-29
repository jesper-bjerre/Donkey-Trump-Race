import type { BarrelSnapshot, GameEvent, MatchPhase } from '@dtr/shared-protocol';
import type { SoundName, SoundSink } from './SoundEngine.js';

/** Distance walked between two footsteps. */
const STEP_DISTANCE = 0.85;
/** Ladder rungs are 0.5 apart; one hand lands on each. */
const RUNG_DISTANCE = 0.5;
/** Movement larger than this in one frame is a respawn/correction, not a step. */
const TELEPORT_DISTANCE = 3;
/** Distance at which a sound has dropped to half volume. */
const HALF_VOLUME_DISTANCE = 7;
/** Other racers' footsteps sit under your own. */
const REMOTE_STEP_VOLUME = 0.45;

export interface SoundPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  climbing: boolean;
  isLocal: boolean;
}

export interface SoundFrame {
  players: SoundPlayer[];
  barrels: BarrelSnapshot[];
  bossThrowing: boolean;
  boss: { x: number; y: number; z: number } | null;
  phase: MatchPhase;
  countdownMs: number;
  /** Event feed, newest first, with increasing ids. */
  events: Array<GameEvent & { id: number }>;
}

interface Tracked {
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  climbing: boolean;
  step: number;
  rung: number;
  foot: 1 | -1;
}

/**
 * Turns what happens in the race into sound cues: footsteps and ladder clanks from
 * movement, rumbling barrels, the boss winding up, and one-shot effects for hits, falls,
 * items and the rescue. Volume falls off with distance from the local player.
 */
export class SoundDirector {
  private readonly tracked = new Map<string, Tracked>();
  private readonly barrels = new Map<number, boolean>();
  private lastEventId = 0;
  private bossThrowing = false;
  private lastCountdown: number | null = null;
  private lastPhase: MatchPhase | null = null;
  private primed = false;

  constructor(private readonly sink: SoundSink) {}

  update(frame: SoundFrame): void {
    const me = frame.players.find((p) => p.isLocal) ?? null;
    const volumeAt = (x: number, y: number, z: number) => {
      if (!me) return 0.6;
      const d = Math.hypot(x - me.x, (y - me.y) * 1.5, z - me.z);
      return 1 / (1 + (d / HALF_VOLUME_DISTANCE) ** 2);
    };

    this.updateCountdown(frame);
    for (const player of frame.players) this.updatePlayer(player, volumeAt);
    for (const id of this.tracked.keys()) {
      if (!frame.players.some((p) => p.id === id)) this.tracked.delete(id);
    }
    this.updateBarrels(frame, volumeAt);
    this.updateBoss(frame, volumeAt);
    this.updateEvents(frame, volumeAt, me);
    this.primed = true;
  }

  private updateCountdown(frame: SoundFrame): void {
    if (frame.phase === 'countdown') {
      const seconds = Math.ceil(frame.countdownMs / 1000);
      if (seconds !== this.lastCountdown && seconds >= 1 && seconds <= 3 && this.primed)
        this.sink.play('countdownBeep', 1);
      this.lastCountdown = seconds;
    } else if (frame.phase === 'racing' && this.lastPhase === 'countdown') {
      this.sink.play('go', 1);
    }
    this.lastPhase = frame.phase;
  }

  private updatePlayer(
    player: SoundPlayer,
    volumeAt: (x: number, y: number, z: number) => number,
  ): void {
    const prev = this.tracked.get(player.id);
    const next: Tracked = {
      x: player.x,
      y: player.y,
      z: player.z,
      grounded: player.grounded,
      climbing: player.climbing,
      step: prev?.step ?? 0,
      rung: prev?.rung ?? 0,
      foot: prev?.foot ?? 1,
    };
    this.tracked.set(player.id, next);
    if (!prev) return;
    const moved = Math.hypot(player.x - prev.x, player.y - prev.y, player.z - prev.z);
    if (moved > TELEPORT_DISTANCE) return;

    const volume =
      volumeAt(player.x, player.y, player.z) * (player.isLocal ? 1 : REMOTE_STEP_VOLUME);
    if (player.climbing) {
      next.rung += Math.abs(player.y - prev.y);
      if (next.rung >= RUNG_DISTANCE) {
        next.rung -= RUNG_DISTANCE;
        next.foot = next.foot === 1 ? -1 : 1;
        this.sink.play('ladderRung', volume, next.foot === 1 ? 1 : 1.06);
      }
    } else {
      next.rung = 0;
    }

    if (player.grounded && prev.grounded && !player.climbing) {
      next.step += Math.hypot(player.x - prev.x, player.z - prev.z);
      if (next.step >= STEP_DISTANCE) {
        next.step -= STEP_DISTANCE;
        next.foot = next.foot === 1 ? -1 : 1;
        this.sink.play('footstep', volume, next.foot === 1 ? 1 : 0.9);
      }
    } else if (!player.grounded) {
      next.step = STEP_DISTANCE * 0.5;
    }

    const wasOnGround = prev.grounded && !prev.climbing;
    if (wasOnGround && !player.grounded && !player.climbing && player.y > prev.y) {
      this.sink.play('jump', volume);
    }
    if (!prev.grounded && !prev.climbing && player.grounded) {
      this.sink.play('land', volume);
    }
  }

  private updateBarrels(
    frame: SoundFrame,
    volumeAt: (x: number, y: number, z: number) => number,
  ): void {
    let rumble = 0;
    const seen = new Set<number>();
    for (const barrel of frame.barrels) {
      seen.add(barrel.id);
      const volume = volumeAt(barrel.x, barrel.y, barrel.z);
      const wasDropping = this.barrels.get(barrel.id);
      if (wasDropping === undefined) {
        if (this.primed) this.sink.play('barrelThrow', Math.max(0.2, volume));
      } else if (!wasDropping && barrel.dropping) {
        this.sink.play('barrelDrop', volume);
      } else if (wasDropping && !barrel.dropping) {
        this.sink.play('barrelLand', volume);
      }
      this.barrels.set(barrel.id, barrel.dropping);
      if (!barrel.dropping) rumble += volume * Math.min(1, Math.abs(barrel.vx) / 5);
    }
    for (const id of this.barrels.keys()) if (!seen.has(id)) this.barrels.delete(id);
    this.sink.setRumble(Math.min(1, rumble));
  }

  private updateBoss(
    frame: SoundFrame,
    volumeAt: (x: number, y: number, z: number) => number,
  ): void {
    if (frame.bossThrowing && !this.bossThrowing && frame.boss && frame.phase === 'racing') {
      // The boss is heard across the whole tower, just quieter far below.
      this.sink.play(
        'bossGrunt',
        Math.max(0.25, volumeAt(frame.boss.x, frame.boss.y, frame.boss.z)),
      );
    }
    this.bossThrowing = frame.bossThrowing;
  }

  private updateEvents(
    frame: SoundFrame,
    volumeAt: (x: number, y: number, z: number) => number,
    me: SoundPlayer | null,
  ): void {
    const fresh = frame.events.filter((e) => e.id > this.lastEventId).reverse();
    if (frame.events[0]) this.lastEventId = Math.max(this.lastEventId, frame.events[0].id);
    if (!this.primed) return;
    for (const event of fresh) {
      const actor = frame.players.find((p) => p.id === event.playerId);
      const mine = me !== null && event.playerId === me.id;
      const targetedMe = me !== null && event.targetId === me.id;
      const volume = mine || targetedMe ? 1 : actor ? volumeAt(actor.x, actor.y, actor.z) : 0.3;
      const cue = (name: SoundName, v = volume) => this.sink.play(name, v);
      switch (event.kind) {
        case 'barrelHit':
          cue('barrelHit');
          if (mine) cue('dizzy');
          break;
        case 'fall':
          cue('fall', mine ? 1 : volume * 0.7);
          break;
        case 'respawn':
          cue('respawn');
          break;
        case 'shove':
          cue('shove');
          break;
        case 'itemPickup':
          cue('itemPickup', mine ? 1 : volume * 0.5);
          break;
        case 'itemUse':
          if (event.item === 'speedBoost') cue('speedBoost');
          else if (event.item === 'shield') cue('shield');
          else if (event.item === 'tweetStorm') cue('tweetStorm', targetedMe ? 1 : volume);
          break;
        case 'shieldBlock':
          cue('shieldBlock');
          break;
        case 'rescue':
          // Everyone hears someone reach Motzfeldt; it is loudest when it is you.
          cue('rescue', mine ? 1 : 0.45);
          break;
      }
    }
  }
}
