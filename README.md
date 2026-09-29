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
| `packages/server-telemetry`  | Telemetry taxonomy, JSONL export to Blob, audit log, GDPR requests, beta KPIs     |
| `packages/client-web`        | React UI + Three.js renderer, client prediction/reconciliation and interpolation  |
| `infra/azure`                | Terraform for Azure Container Apps, ACR, Key Vault, Blob, monitoring (see below)  |

Server environment variables:

| Variable                                       | Purpose                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PORT` (8080), `HOST`                          | Listen address                                                                                |
| `APP_ENV`                                      | Environment name in telemetry and audit records (`dev`, `staging`, `production`)              |
| `ROOM_TOKEN_SECRET`                            | Room token signing key (required in production; Key Vault reference in Azure)                 |
| `KEY_VAULT_URL`                                | Optional: read secrets from Key Vault with managed identity instead of env vars               |
| `ALLOWED_ORIGINS`                              | Comma-separated origins allowed for WebSocket upgrades and cross-origin REST (CORS)           |
| `ALLOW_SOLO`                                   | Allow 1-player matches (local testing)                                                        |
| `FILL_WITH_BOTS`                               | Fill free slots with computer players so every race has 5 racers (default on; `0` disables)   |
| `HSTS`, `TRUST_PROXY`                          | Default on when `NODE_ENV=production`                                                         |
| `RATE_LIMIT_SCALE`                             | Multiplies REST rate limits (default 1; the e2e suite uses 20)                                |
| `TELEMETRY_SINK`                               | `none` (default), `memory`, `file` (writes to `TELEMETRY_DATA_DIR`, default `.data`), `azure` |
| `TELEMETRY_STORAGE_URL`, `TELEMETRY_HASH_SALT` | Blob endpoint and pseudonym salt for the `azure` sink                                         |
| `CLIENT_DIST_DIR`                              | Built client to serve (auto-detected)                                                         |

## Quality gates

```sh
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test:unit          # Vitest: unit + React component tests (jsdom, Testing Library, axe-core)
pnpm test:integration   # Vitest: REST + WebSocket against a real server instance
pnpm build && pnpm test:e2e      # Playwright, Chromium + Firefox, against the built app
pnpm test:a11y          # axe checks (component + browser); pnpm test:keyboard for keyboard-only flows
pnpm fixtures:regenerate         # rewrite committed expected fixtures after an intended rule change
pnpm sprites                     # regenerate sprites from docs/design/graphics
```

Operational tools:

```sh
pnpm smoke:staging -- --baseUrl https://<env>          # post-deploy smoke test
pnpm soak:multiplayer -- --baseUrl http://localhost:8080 --rooms=20 --playersPerRoom=5
pnpm beta:summary -- --releaseCandidateId rc-1 --source file:.data/telemetry
pnpm workflow:lint                                      # actionlint + SHA-pinned actions
pnpm security:checksums / pnpm security:sbom
```

CI: `.github/workflows/validate.yml` (quality gates, Terraform, Playwright on both browsers),
`security.yml` (dependency review and audit, gitleaks, Trivy, SBOM, checksums, workflow lint),
`deploy.yml` (main → dev; manual staging/production with approval) and
`deploy-staging-smoke.yml`. The `Dockerfile` builds one non-root image with only `node` in the
runtime layer, serving the game on port 8080 with a `/healthz` check.

## Deployment

Azure infrastructure and the GitHub OIDC setup are described step by step in
[`infra/README.md`](infra/README.md). Nothing has been provisioned yet.

## Before a public release

Names and likenesses are parody and need legal/IP review before any public release; the beta
sign-off report (`pnpm beta:summary`) tracks that review together with privacy and accessibility
in `docs/beta/release-gates.json`.
