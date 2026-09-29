import type { LevelMetadata } from '@dtr/shared-level';
import type { AuthoritativeSnapshot, GameEvent, PlayerSnapshot } from '@dtr/shared-protocol';
import type { GameSocket } from './GameSocket.js';
import { ServerClock, SnapshotBuffer } from './interpolation.js';
import { LocalPredictor, type PredictionContext } from './prediction.js';

const TELEPORT_DISTANCE = 4;
const MAX_EVENTS = 6;

export interface FeedEvent extends GameEvent {
  id: number;
  receivedAt: number;
}

/** Client-side state of one running match: snapshot buffer, clock, prediction and event feed. */
export class MatchSession {
  readonly buffer = new SnapshotBuffer();
  readonly clock = new ServerClock();
  readonly predictor: LocalPredictor;
  events: FeedEvent[] = [];
  private eventId = 0;
  private unsubscribe: () => void;

  constructor(
    readonly matchId: string,
    readonly level: LevelMetadata,
    readonly localPlayerId: string,
    readonly socket: GameSocket,
  ) {
    this.predictor = new LocalPredictor(level);
    this.unsubscribe = socket.onMessage((message) => {
      if (message.type === 'server.snapshot') this.onSnapshot(message.snapshot);
      if (message.type === 'server.event') this.onEvent(message.event);
    });
  }

  dispose(): void {
    this.unsubscribe();
  }

  latest(): AuthoritativeSnapshot | undefined {
    return this.buffer.latest();
  }

  localSnapshot(): PlayerSnapshot | undefined {
    return this.latest()?.players.find((p) => p.id === this.localPlayerId);
  }

  serverNow(): number {
    return this.clock.now(performance.now());
  }

  predictionContext(
    player: PlayerSnapshot,
    snapshot: AuthoritativeSnapshot,
    serverTimeMs: number,
  ): PredictionContext {
    return {
      disabled:
        snapshot.phase !== 'racing' ||
        player.finishRank !== null ||
        serverTimeMs < player.movementDisabledUntilMs,
      speedMultiplier: serverTimeMs < player.speedBoostUntilMs ? 1.5 : 1,
    };
  }

  playerName(id: string | undefined): string {
    if (!id) return 'Someone';
    const player = this.latest()?.players.find((p) => p.id === id);
    if (!player) return 'Someone';
    return id === this.localPlayerId ? 'You' : player.nickname;
  }

  private onSnapshot(snapshot: AuthoritativeSnapshot): void {
    this.buffer.add(snapshot);
    this.clock.observe(snapshot.serverTimeMs, performance.now());
    const me = snapshot.players.find((p) => p.id === this.localPlayerId);
    if (!me) return;
    const predicted = this.predictor.state;
    const teleported =
      predicted !== null &&
      Math.hypot(predicted.x - me.x, predicted.y - me.y) > TELEPORT_DISTANCE &&
      me.fallPenalty;
    if (!predicted || teleported || me.finishRank !== null) {
      this.predictor.reset(me);
    } else {
      this.predictor.reconcile(me, this.predictionContext(me, snapshot, snapshot.serverTimeMs));
    }
  }

  private onEvent(event: GameEvent): void {
    this.events = [
      { ...event, id: ++this.eventId, receivedAt: performance.now() },
      ...this.events,
    ].slice(0, MAX_EVENTS);
  }
}
