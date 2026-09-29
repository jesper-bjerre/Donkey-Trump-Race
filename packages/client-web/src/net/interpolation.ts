import type { AuthoritativeSnapshot, BarrelSnapshot, PlayerSnapshot } from '@dtr/shared-protocol';

export const INTERPOLATION_DELAY_MS = 100;
/** Remote entities are extrapolated along their velocity for at most this long. */
export const MAX_EXTRAPOLATION_MS = 100;
const MAX_BUFFER = 30;

export interface InterpolationMetrics {
  /** Remote player samples produced. */
  samples: number;
  /** Snapshots discarded because they arrived out of order or duplicated. */
  staleDropped: number;
  /** Samples that had to extrapolate past the newest snapshot. */
  extrapolated: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Estimates the server's match clock from snapshot arrivals. */
export class ServerClock {
  private offset: number | null = null;

  observe(serverTimeMs: number, localNowMs: number): void {
    const sample = serverTimeMs - localNowMs;
    // Prefer the least-delayed sample, drift slowly otherwise.
    if (this.offset === null || sample > this.offset) this.offset = sample;
    else this.offset = this.offset * 0.98 + sample * 0.02;
  }

  now(localNowMs: number): number {
    return this.offset === null ? 0 : localNowMs + this.offset;
  }

  reset(): void {
    this.offset = null;
  }
}

/** Buffers snapshots and samples remote entities ~100 ms in the past for smooth motion. */
export class SnapshotBuffer {
  private snapshots: AuthoritativeSnapshot[] = [];
  readonly metrics: InterpolationMetrics = { samples: 0, staleDropped: 0, extrapolated: 0 };

  add(snapshot: AuthoritativeSnapshot): void {
    const last = this.snapshots.at(-1);
    if (last && snapshot.tick <= last.tick) {
      this.metrics.staleDropped++;
      return;
    }
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_BUFFER) this.snapshots.shift();
  }

  latest(): AuthoritativeSnapshot | undefined {
    return this.snapshots.at(-1);
  }

  clear(): void {
    this.snapshots = [];
  }

  pruneBeforeTick(tick: number): void {
    this.snapshots = this.snapshots.filter((s) => s.tick >= tick);
  }

  private bracket(
    renderTimeMs: number,
  ): [AuthoritativeSnapshot, AuthoritativeSnapshot, number] | null {
    const list = this.snapshots;
    if (list.length === 0) return null;
    if (list.length === 1 || renderTimeMs <= list[0]!.serverTimeMs) return [list[0]!, list[0]!, 0];
    for (let i = list.length - 1; i > 0; i--) {
      const a = list[i - 1]!;
      const b = list[i]!;
      if (renderTimeMs >= a.serverTimeMs) {
        const span = b.serverTimeMs - a.serverTimeMs;
        const t = span > 0 ? Math.min(1, (renderTimeMs - a.serverTimeMs) / span) : 1;
        return [a, b, t];
      }
    }
    const last = list.at(-1)!;
    return [last, last, 0];
  }

  sampleRemotePlayers(
    renderTimeMs: number,
    localPlayerId: string | null,
  ): Map<string, PlayerSnapshot & Vec3> {
    const result = new Map<string, PlayerSnapshot & Vec3>();
    const bracket = this.bracket(renderTimeMs);
    if (!bracket) return result;
    const [a, b, t] = bracket;
    const newest = this.snapshots.at(-1)!;
    // Past the newest snapshot (late packets): extrapolate briefly, then hold.
    const ahead = a === b && b === newest ? renderTimeMs - newest.serverTimeMs : 0;
    const extrapolateS = Math.min(MAX_EXTRAPOLATION_MS, Math.max(0, ahead)) / 1000;
    if (extrapolateS > 0) this.metrics.extrapolated++;
    for (const pb of b.players) {
      if (pb.id === localPlayerId) continue;
      const pa = a.players.find((p) => p.id === pb.id) ?? pb;
      // Teleports (respawns) should not be smeared across the map.
      const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 4;
      const moving = !pb.knockedDown && !pb.fallPenalty;
      const ex = moving ? extrapolateS : 0;
      result.set(pb.id, {
        ...pb,
        x: (jump ? pb.x : lerp(pa.x, pb.x, t)) + pb.vx * ex,
        y: (jump ? pb.y : lerp(pa.y, pb.y, t)) + (pb.grounded ? 0 : pb.vy * ex),
        z: (jump ? pb.z : lerp(pa.z, pb.z, t)) + pb.vz * ex,
      });
      this.metrics.samples++;
    }
    return result;
  }

  sampleBarrels(renderTimeMs: number): BarrelSnapshot[] {
    const bracket = this.bracket(renderTimeMs);
    if (!bracket) return [];
    const [a, b, t] = bracket;
    return b.barrels.map((bb) => {
      const ba = a.barrels.find((x) => x.id === bb.id);
      if (!ba) return bb;
      return { ...bb, x: lerp(ba.x, bb.x, t), y: lerp(ba.y, bb.y, t), z: lerp(ba.z, bb.z, t) };
    });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
