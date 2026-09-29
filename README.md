# Donkey Trump Race

A browser-based 3D multiplayer arcade race: up to 5 players race as colored **Jumpman Løkke** up a
Donkey Kong–style tower in a Mario Kart–style chase camera, dodge barrels thrown by the computer-controlled
boss, shove each other, grab items, and try to be first to rescue **Motzfeldt**.

Product docs live in [`docs/`](docs/) (intent, PRD, architecture, backlog, test plan). Character art comes
from the sheets in [`docs/design/graphics`](docs/design/graphics).

## Quick start

Requires Node.js 22+ and pnpm 10.

```sh
pnpm install
pnpm dev          # server on :8080 + Vite client on http://localhost:5173
```

Open http://localhost:5173 in two browser windows, create a room in one and join with the room code in the
other. To test alone, allow solo starts:

```sh
ALLOW_SOLO=1 pnpm dev
```

Production-style run (the server also serves the built client):

```sh
pnpm build
ALLOW_SOLO=1 pnpm start   # http://localhost:8080
```

## Controls

| Key               | Action                                      |
| ----------------- | ------------------------------------------- |
| `W` / `↑`         | Run forward, climb up a ladder              |
| `S` / `↓`         | Run back, climb down                        |
| `A` `D` / `←` `→` | Change lane                                 |
| `Space`           | Jump (only half a floor high — use ladders) |
| `E` / `Shift`     | Use held item                               |
| `?`               | Help & privacy                              |

## Rules implemented

- One tower map: 5 floors plus Motzfeldt's platform; wall on the left, open fall edge on the right.
- Barrel hit → knocked down with stars, no running for exactly 2 s. Falling off the right edge → respawn on
  that floor with the same 2 s penalty.
- Side collisions shove the other player (possibly off the edge).
- Item boxes: Kaffe Boost (speed), Diplomatic Shield (blocks one hit), Tweet Storm (stuns the leader).
  Trailing players get better items.
- First to reach Motzfeldt wins; the race ends when everyone has finished, 30 s after the first finisher, or
  after 5 minutes.

## Architecture

TypeScript pnpm monorepo, server-authoritative (clients send inputs, never positions):

| Package                      | Role                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `packages/shared-protocol`   | zod schemas for REST/WebSocket messages, snapshots, error catalog, colors         |
| `packages/shared-level`      | MVP tower metadata, validators and queries                                        |
| `packages/shared-simulation` | Pure deterministic movement step (used by the server and client prediction)       |
| `packages/shared-items`      | Item definitions and comeback weighting                                           |
| `packages/server`            | Fastify REST lobby, `ws` gateway (`/ws`), 60 Hz match simulation, 20 Hz snapshots |
| `packages/client-web`        | React UI + Three.js renderer, client prediction/reconciliation and interpolation  |

Server environment variables: `PORT` (8080), `HOST`, `ROOM_TOKEN_SECRET` (required in production),
`ALLOW_SOLO`, `ALLOWED_ORIGINS` (comma-separated WebSocket origin allow-list), `CLIENT_DIST_DIR`.

## Quality gates

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test   # unit + integration (Vitest)
pnpm build && pnpm test:e2e                                      # Playwright against the built app
pnpm sprites                                                     # regenerate sprites from docs/design/graphics
```

CI runs the same steps in `.github/workflows/validate.yml`. The `Dockerfile` builds one image serving the
game on port 8080 with a `/healthz` check.

## Not yet implemented

From the backlog, Azure infrastructure (Terraform), deployment pipelines, telemetry export to Blob Storage,
GDPR request endpoints and audit records are deferred. Names and likenesses are parody and need legal/IP
review before any public release.
