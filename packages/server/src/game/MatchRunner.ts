import { computeProgress, type LevelMetadata } from '@dtr/shared-level';
import {
  validateClientInputCommand,
  type AuthoritativeSnapshot,
  type ClientInputCommand,
  type FinishEntry,
  type GameEvent,
  type MatchHighlights,
  type MatchPhase,
  type PlayerSnapshot,
} from '@dtr/shared-protocol';
import {
  COUNTDOWN_MS,
  createMotionState,
  FINISH_GRACE_MS,
  MATCH_MAX_MS,
  NEUTRAL_INPUT,
  SeededRng,
  SNAPSHOT_EVERY_TICKS,
  stepPlayerMovement,
  TICK_DT,
  TICK_MS,
  TICKS_PER_INPUT,
} from '@dtr/shared-simulation';
import { BossBarrelSystem } from './systems/boss.js';
import { BotController } from './systems/bots.js';
import { FallRespawnSystem } from './systems/fallRespawn.js';
import { ItemSystem } from './systems/items.js';
import { RescueObjective } from './systems/rescue.js';
import { PlayerShoveSystem } from './systems/shove.js';
import { isActive, isDisabled } from './systems/status.js';
import type { MatchPlayerInfo, MatchStats, PlayerSim } from './types.js';

/** Inputs queued beyond this are dropped (oldest first) to bound latency. */
const MAX_QUEUED_INPUTS = 6;

export interface MatchRunnerOptions {
  matchId: string;
  level: LevelMetadata;
  players: MatchPlayerInfo[];
  seed: number;
  countdownMs?: number;
}

export interface MatchResult {
  matchId: string;
  finishOrder: FinishEntry[];
  highlights: MatchHighlights;
}

/**
 * Server-authoritative fixed-tick (60 Hz) simulation of one match. Deterministic for a
 * given seed and input sequence: time is derived from the tick counter, never the wall clock.
 */
export class MatchRunner {
  readonly matchId: string;
  readonly level: LevelMetadata;
  private readonly rng: SeededRng;
  private readonly players: PlayerSim[];
  private readonly boss: BossBarrelSystem;
  private readonly items: ItemSystem;
  private readonly shoves = new PlayerShoveSystem();
  private readonly bots: BotController;
  private readonly raceStartsAtMs: number;
  private readonly stats: MatchStats = {
    barrelHits: 0,
    falls: 0,
    shoves: 0,
    itemUses: 0,
    disconnects: 0,
  };
  private readonly finishOrder: FinishEntry[] = [];
  private pendingEvents: GameEvent[] = [];
  private tickCount = 0;
  private phaseValue: MatchPhase = 'countdown';
  private raceEndsAtMs: number | null = null;

  constructor(options: MatchRunnerOptions) {
    this.matchId = options.matchId;
    this.level = options.level;
    this.rng = new SeededRng(options.seed);
    this.raceStartsAtMs = options.countdownMs ?? COUNTDOWN_MS;
    this.players = [...options.players]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((info) => this.createPlayer(info));
    this.boss = new BossBarrelSystem(this.level, this.rng, this.raceStartsAtMs);
    this.items = new ItemSystem(this.level, this.rng);
    // Separate stream so bot decisions never shift the boss/item sequence.
    this.bots = new BotController(this.level, new SeededRng(options.seed ^ 0x5bd1e995));
  }

  get tick(): number {
    return this.tickCount;
  }

  get nowMs(): number {
    return this.tickCount * TICK_MS;
  }

  get phase(): MatchPhase {
    return this.phaseValue;
  }

  isFinished(): boolean {
    return this.phaseValue === 'finished';
  }

  shouldBroadcastSnapshot(): boolean {
    return this.tickCount % SNAPSHOT_EVERY_TICKS === 0 || this.isFinished();
  }

  submitInput(playerId: string, command: ClientInputCommand): boolean {
    const player = this.find(playerId);
    const valid = validateClientInputCommand(command);
    if (!player || !valid || player.removed) return false;
    const lastQueued = player.inputQueue.at(-1)?.seq ?? player.lastInputSeq;
    if (valid.seq <= lastQueued) return false;
    player.inputQueue.push(valid);
    while (player.inputQueue.length > MAX_QUEUED_INPUTS) player.inputQueue.shift();
    return true;
  }

  requestUseItem(playerId: string): void {
    const player = this.find(playerId);
    if (player) player.useItemRequested = true;
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.find(playerId);
    if (!player) return;
    if (!connected && player.info.connected && !this.isFinished()) this.stats.disconnects++;
    player.info.connected = connected;
    if (!connected) {
      player.inputQueue = [];
      player.currentInput = NEUTRAL_INPUT;
    }
  }

  removePlayer(playerId: string): void {
    const player = this.find(playerId);
    if (player) player.removed = true;
  }

  drainEvents(): GameEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  advanceTick(): void {
    if (this.phaseValue === 'finished') return;
    this.tickCount++;
    const now = this.nowMs;
    if (this.phaseValue === 'countdown' && now >= this.raceStartsAtMs) this.phaseValue = 'racing';
    const racing = this.phaseValue === 'racing';
    const emit = (e: Omit<GameEvent, 'serverTimeMs'>) =>
      this.pendingEvents.push({ ...e, serverTimeMs: now });

    for (const player of this.players) {
      if (player.info.isBot) {
        if (isActive(player) && racing)
          player.currentInput = this.bots.input(player, this.boss.barrels, now);
      } else {
        this.consumeInput(player);
      }
      if (!isActive(player)) continue;
      if (player.movementDisabledUntilMs > 0 && now >= player.movementDisabledUntilMs) {
        if (player.fallPenalty) emit({ kind: 'respawn', playerId: player.info.id });
        player.knockedDown = false;
        player.fallPenalty = false;
        player.movementDisabledUntilMs = 0;
      }
      const { state, events } = stepPlayerMovement(
        player.motion,
        player.currentInput,
        TICK_DT,
        this.level,
        {
          disabled: !racing || isDisabled(player, now),
          speedMultiplier: now < player.speedBoostUntilMs ? 1.5 : 1,
        },
      );
      player.motion = state;
      player.falling =
        !state.grounded && !state.climbing && state.x > this.level.bounds.rightFallEdgeX;
      if (FallRespawnSystem.detectFall(this.level, player, events.fallConfirmed)) {
        FallRespawnSystem.applyRespawn(this.level, player, now);
        this.stats.falls++;
        emit({ kind: 'fall', playerId: player.info.id });
      }
    }

    if (racing) {
      this.stats.shoves += this.shoves.resolveSideImpacts(this.players, now, emit).shoves;
      this.boss.advanceTick(now, TICK_DT);
      this.boss.resolveHits(this.players, now, emit, this.stats);
      const ranking = this.ranking();
      this.items.resolvePickups(this.players, ranking, now, emit);
      for (const player of this.players) {
        if (!player.useItemRequested) continue;
        player.useItemRequested = false;
        this.items.useItem(player, ranking, now, emit, this.stats);
      }
      this.resolveRescues(now, emit);
      this.checkEnd(now);
    } else {
      for (const player of this.players) player.useItemRequested = false;
    }
  }

  snapshot(): AuthoritativeSnapshot {
    const now = this.nowMs;
    return {
      tick: this.tickCount,
      serverTimeMs: now,
      phase: this.phaseValue,
      raceStartsAtMs: this.raceStartsAtMs,
      raceEndsAtMs: this.raceEndsAtMs,
      players: this.players.filter((p) => !p.removed).map((p) => this.snapshotPlayer(p)),
      barrels: this.boss.snapshotBarrels(),
      itemBoxes: this.items.snapshot(),
      boss: this.boss.snapshotBoss(now),
      finishOrder: [...this.finishOrder],
    };
  }

  /** Match time (ms) when the countdown ends and racing begins. */
  get raceStartMs(): number {
    return this.raceStartsAtMs;
  }

  /** Players in the match (removed players excluded). */
  get playerCount(): number {
    return this.players.filter((p) => !p.removed).length;
  }

  result(): MatchResult {
    const first = this.finishOrder[0];
    return {
      matchId: this.matchId,
      finishOrder: [...this.finishOrder],
      highlights: {
        ...this.stats,
        fastestRescueMs: first ? first.serverTimeMs - this.raceStartsAtMs : null,
      },
    };
  }

  /** Test/debug access to internal player state. */
  debugPlayer(playerId: string): PlayerSim | undefined {
    return this.find(playerId);
  }

  /** Test access to the barrel system. */
  get bossSystem(): BossBarrelSystem {
    return this.boss;
  }

  /** Test access to the item system. */
  get itemSystem(): ItemSystem {
    return this.items;
  }

  private createPlayer(info: MatchPlayerInfo): PlayerSim {
    const spawn = this.level.playerSpawns[info.slotIndex] ?? this.level.playerSpawns[0]!;
    const floor = this.level.floors.find((f) => f.id === spawn.floorId) ?? this.level.floors[0]!;
    const motion = createMotionState(spawn.x, floor.y, spawn.z, floor.index);
    motion.facing = floor.runDirection;
    return {
      info: { ...info },
      motion,
      inputQueue: [],
      currentInput: NEUTRAL_INPUT,
      inputTicksLeft: 0,
      lastInputSeq: 0,
      movementDisabledUntilMs: 0,
      knockedDown: false,
      fallPenalty: false,
      falling: false,
      heldItem: null,
      useItemRequested: false,
      speedBoostUntilMs: 0,
      shieldUntilMs: 0,
      finishRank: null,
      finishTick: null,
      removed: false,
    };
  }

  private find(playerId: string): PlayerSim | undefined {
    return this.players.find((p) => p.info.id === playerId);
  }

  /** Each input command drives TICKS_PER_INPUT ticks; the last input repeats if the queue runs dry. */
  private consumeInput(player: PlayerSim): void {
    if (player.inputTicksLeft <= 0) {
      const next = player.inputQueue.shift();
      if (next) {
        player.currentInput = next;
        player.lastInputSeq = next.seq;
        player.inputTicksLeft = TICKS_PER_INPUT;
      } else if (!player.info.connected) {
        player.currentInput = NEUTRAL_INPUT;
      }
    }
    player.inputTicksLeft--;
  }

  private progressOf(player: PlayerSim): number {
    if (player.finishRank !== null) return 10000 - player.finishRank;
    return (
      computeProgress(this.level, player.motion.floor, player.motion.x) + player.motion.y * 0.01
    );
  }

  /** Active players ordered leader-first. */
  private ranking(): PlayerSim[] {
    return this.players
      .filter(isActive)
      .sort(
        (a, b) => this.progressOf(b) - this.progressOf(a) || a.info.slotIndex - b.info.slotIndex,
      );
  }

  private resolveRescues(now: number, emit: (e: Omit<GameEvent, 'serverTimeMs'>) => void): void {
    const arrivals = RescueObjective.checkCompletion(
      this.level,
      this.players,
      this.tickCount,
      this.finishOrder.length,
    );
    for (const player of arrivals) {
      player.motion.vx = 0;
      player.motion.vz = 0;
      player.motion.kx = 0;
      player.motion.kz = 0;
      player.heldItem = null;
      this.finishOrder.push({
        rank: player.finishRank!,
        playerId: player.info.id,
        slotIndex: player.info.slotIndex,
        nickname: player.info.nickname,
        color: player.info.color,
        finishTick: this.tickCount,
        serverTimeMs: now,
      });
      emit({ kind: 'rescue', playerId: player.info.id });
    }
    if (arrivals.length > 0 && this.raceEndsAtMs === null)
      this.raceEndsAtMs = now + FINISH_GRACE_MS;
  }

  private checkEnd(now: number): void {
    // Bots never hold a race open: it ends once every connected human is done or gone.
    const humans = this.players.filter((p) => !p.info.isBot);
    const contenders = humans.filter((p) => !p.removed && p.info.connected);
    const allDone = contenders.length > 0 && contenders.every((p) => p.finishRank !== null);
    const everyoneGone = humans.every((p) => p.removed || !p.info.connected);
    const graceOver = this.raceEndsAtMs !== null && now >= this.raceEndsAtMs;
    const timeCap = now - this.raceStartsAtMs >= MATCH_MAX_MS;
    if (allDone || graceOver || timeCap || everyoneGone) {
      this.phaseValue = 'finished';
      this.raceEndsAtMs = now;
    }
  }

  private snapshotPlayer(p: PlayerSim): PlayerSnapshot {
    const m = p.motion;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return {
      id: p.info.id,
      slotIndex: p.info.slotIndex,
      nickname: p.info.nickname,
      color: p.info.color,
      x: r(m.x),
      y: r(m.y),
      z: r(m.z),
      vx: r(m.vx),
      vy: r(m.vy),
      vz: r(m.vz),
      kx: r(m.kx),
      kz: r(m.kz),
      facing: m.facing,
      floor: m.floor,
      grounded: m.grounded,
      climbing: m.climbing,
      movementDisabledUntilMs: p.movementDisabledUntilMs,
      knockedDown: p.knockedDown,
      fallPenalty: p.fallPenalty,
      falling: p.falling,
      heldItem: p.heldItem,
      speedBoostUntilMs: p.speedBoostUntilMs,
      shieldUntilMs: p.shieldUntilMs,
      finishRank: p.finishRank,
      lastInputSeq: p.lastInputSeq,
      inputTicksLeft: Math.max(0, p.inputTicksLeft),
      connected: p.info.connected,
      progress: r(this.progressOf(p)),
      ...(p.info.isBot ? { isBot: true } : {}),
    };
  }
}
