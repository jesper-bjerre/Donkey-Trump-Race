import { useEffect, useRef, useState } from 'react';
import { computeProgress, getFloorById, type LevelMetadata } from '@dtr/shared-level';
import { TICKS_PER_INPUT, TICK_RATE } from '@dtr/shared-simulation';
import { StructuredError } from '../components/common/StructuredError.js';
import { RaceHUD, type HudState } from '../components/RaceHUD.js';
import { cameraDirection, KeyboardController, mapKeysToInput } from '../input/keyboard.js';
import type { ConnectionStatus } from '../net/GameSocket.js';
import { INTERPOLATION_DELAY_MS } from '../net/interpolation.js';
import type { MatchSession } from '../net/MatchSession.js';
import { SUPPORTED_BROWSERS_TEXT } from '../platform/browserSupport.js';
import { GameRenderer, type RenderPlayer } from '../render/GameRenderer.js';

const INPUT_INTERVAL_S = TICKS_PER_INPUT / TICK_RATE;
const HUD_INTERVAL_MS = 100;
/** How long a "you were shoved" style status stays on screen. */
const STATUS_LINE_MS = 2000;

/** Progress at Motzfeldt's rescue zone, used as 100 %. */
export function rescueProgressPct(level: LevelMetadata, progress: number): number {
  const zone = level.rescueZone;
  const goal = computeProgress(level, getFloorById(level, zone.floorId).index, zone.minX);
  return goal > 0 ? Math.max(0, Math.min(100, Math.round((progress / goal) * 100))) : 0;
}

interface Props {
  match: MatchSession;
  connection: ConnectionStatus;
  onOpenHelp: () => void;
  onLeave: () => void;
}

export function MatchScreen({ match, connection, onOpenHelp, onLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: GameRenderer;
    try {
      renderer = new GameRenderer(container, match.level);
    } catch {
      // No WebGL context (disabled GPU, old browser): explain instead of a blank screen.
      setWebglFailed(true);
      return;
    }
    const keyboard = new KeyboardController();
    let raf = 0;
    let last = performance.now();
    let inputAccumulator = 0;
    let lastHud = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const snapshot = match.latest();
      const serverNow = match.serverNow();
      const me = match.localSnapshot();

      // Fixed-rate input sampling (30 Hz), predicted locally and sent to the server.
      inputAccumulator += dt;
      while (inputAccumulator >= INPUT_INTERVAL_S) {
        inputAccumulator -= INPUT_INTERVAL_S;
        const state = match.predictor.state;
        if (!snapshot || !me || !state) continue;
        const input = mapKeysToInput(keyboard.keyState(), cameraDirection(match.level, state));
        const command = match.predictor.applyInput(
          input,
          match.predictionContext(me, snapshot, serverNow),
        );
        if (command) match.socket.sendInput({ seq: command.seq, ...command.input });
      }
      if (keyboard.consumeUseItem() && me?.heldItem) match.socket.send({ type: 'client.useItem' });

      const players: RenderPlayer[] = [];
      const predictedPos = match.predictor.renderPosition(dt);
      if (me) {
        const pos = me.finishRank === null && predictedPos ? predictedPos : me;
        const state = match.predictor.state;
        players.push({
          ...me,
          ...(state && me.finishRank === null
            ? {
                facing: state.facing,
                climbing: state.climbing,
                grounded: state.grounded,
                vx: state.vx,
                vz: state.vz,
              }
            : {}),
          x: pos.x,
          y: pos.y,
          z: pos.z,
          isLocal: true,
        });
      }
      const renderTime = serverNow - INTERPOLATION_DELAY_MS;
      for (const remote of match.buffer
        .sampleRemotePlayers(renderTime, match.localPlayerId)
        .values()) {
        players.push({ ...remote, isLocal: false });
      }
      const focusState = match.predictor.state;
      renderer.render({
        players,
        barrels: match.buffer.sampleBarrels(renderTime),
        itemBoxes: snapshot?.itemBoxes ?? [],
        boss: snapshot?.boss ?? null,
        focus:
          me && focusState
            ? {
                x: players[0]!.x,
                y: players[0]!.y,
                z: players[0]!.z,
                floorY: match.level.floors[focusState.floor]?.y ?? 0,
                climbing: focusState.climbing !== null,
              }
            : null,
        cameraDirection: focusState ? cameraDirection(match.level, focusState) : 1,
        serverTimeMs: serverNow,
        dtSeconds: dt,
      });

      if (now - lastHud > HUD_INTERVAL_MS) {
        lastHud = now;
        setHud(buildHud(match, serverNow));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      keyboard.dispose();
      renderer.dispose();
    };
  }, [match]);

  if (webglFailed) {
    return (
      <main className="screen interrupted" aria-labelledby="structured-error-title">
        <StructuredError
          headingLevel={1}
          autoFocus
          title="3D graphics are not available"
          message={`This browser could not start WebGL, so the race cannot be shown. ${SUPPORTED_BROWSERS_TEXT}`}
          actions={[{ label: 'Leave room', primary: true, onSelect: onLeave }]}
        />
      </main>
    );
  }

  return (
    <main className="screen match" aria-label="Race">
      <div className="viewport" ref={containerRef} />
      {hud && <RaceHUD hud={hud} connection={connection} onOpenHelp={onOpenHelp} />}
    </main>
  );
}

function buildHud(match: MatchSession, serverNow: number): HudState {
  const snapshot = match.latest();
  const me = match.localSnapshot();
  const ranking = [...(snapshot?.players ?? [])].sort((a, b) => b.progress - a.progress);
  return {
    phase: snapshot?.phase ?? 'countdown',
    countdownMs: snapshot ? Math.max(0, snapshot.raceStartsAtMs - serverNow) : 0,
    raceEndsInMs:
      snapshot?.raceEndsAtMs != null ? Math.max(0, snapshot.raceEndsAtMs - serverNow) : null,
    position: me ? ranking.findIndex((p) => p.id === me.id) + 1 : null,
    playerCount: ranking.length,
    floor: me ? me.floor : 0,
    floorCount: match.level.floors.length,
    rescueProgressPct: me
      ? me.finishRank !== null
        ? 100
        : rescueProgressPct(match.level, me.progress)
      : 0,
    statusLine: statusLine(match),
    heldItem: me?.heldItem ?? null,
    penaltyMs: me ? Math.max(0, me.movementDisabledUntilMs - serverNow) : 0,
    penaltyKind: me?.fallPenalty ? 'fall' : me?.knockedDown ? 'knockdown' : null,
    speedBoostMs: me ? Math.max(0, me.speedBoostUntilMs - serverNow) : 0,
    shieldMs: me ? Math.max(0, me.shieldUntilMs - serverNow) : 0,
    finishRank: me?.finishRank ?? null,
    latencyMs: match.socket.metrics.latencyMs,
    snapshotAgeMs: snapshot ? Math.max(0, Math.round(serverNow - snapshot.serverTimeMs)) : null,
    events: match.events.map((e) => ({ id: e.id, text: describeEvent(match, e) })),
    ranking: ranking.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      slotIndex: p.slotIndex,
      finishRank: p.finishRank,
      isLocal: p.id === match.localPlayerId,
    })),
  };
}

/** Recent events that happened *to* the local player, as a short status line. */
function statusLine(match: MatchSession): string | null {
  const now = performance.now();
  const recent = match.events.find(
    (e) =>
      now - e.receivedAt < STATUS_LINE_MS &&
      ((e.kind === 'shove' && e.targetId === match.localPlayerId) ||
        (e.kind === 'itemUse' && e.item === 'tweetStorm' && e.targetId === match.localPlayerId)),
  );
  if (!recent) return null;
  const who = match.playerName(recent.playerId);
  return recent.kind === 'shove' ? `${who} shoved you!` : `${who} hit you with a Tweet Storm!`;
}

function describeEvent(match: MatchSession, event: MatchSession['events'][number]): string {
  const who = match.playerName(event.playerId);
  const target = match.playerName(event.targetId);
  switch (event.kind) {
    case 'barrelHit':
      return `💥 ${who} got flattened by a barrel!`;
    case 'fall':
      return `🪂 ${who} fell off the edge!`;
    case 'respawn':
      return `${who} is back in the race.`;
    case 'shove':
      return `🤜 ${who} shoved ${target}!`;
    case 'itemPickup':
      return `🎁 ${who} grabbed an item.`;
    case 'itemUse':
      return event.item === 'tweetStorm'
        ? `🌪️ ${who} sent a Tweet Storm at ${target}!`
        : `✨ ${who} used ${event.item === 'shield' ? 'a shield' : 'a Kaffe Boost'}.`;
    case 'shieldBlock':
      return `🛡️ ${who}'s shield blocked it!`;
    case 'rescue':
      return `🎉 ${who} rescued Motzfeldt!`;
  }
}
