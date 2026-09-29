## Monorepo foundation, CI/CD, and Azure runtime platform

### [P0] Scaffold TypeScript workspace packages

Create the initial TypeScript monorepo package scaffold so Donkey Trump Race can separate browser UI, 3D rendering, netcode, authoritative server logic, shared simulation contracts, telemetry, and infrastructure from day one. The work belongs in the root workspace files package.json, pnpm-workspace.yaml, tsconfig.base.json, and the package entrypoint files under packages/client-web/src/index.ts, packages/client-renderer/src/index.ts, packages/client-netcode/src/index.ts, packages/server-api/src/index.ts, packages/server-realtime/src/index.ts, packages/server-game/src/index.ts, packages/shared-protocol/src/index.ts, packages/shared-simulation/src/index.ts, packages/shared-level/src/index.ts, packages/shared-items/src/index.ts, packages/server-telemetry/src/index.ts, and infra/README.md. The current repository has no package topology, so developers cannot safely share protocol definitions between the React UI, Three.js renderer, raw WebSocket client, REST API, and server-authoritative match simulation. Stakeholders need this boundary because the MVP relies on fair multiplayer outcomes, fast closed-beta iteration, and clear ownership of client, server, shared, and platform concerns. When complete, pnpm can discover every workspace package and each package exports at least one typed placeholder symbol that can be imported by a smoke test without circular dependencies. This story does not implement gameplay mechanics, lobby endpoints, WebSocket protocols, Azure resources, Docker images, linting policy, or deployment automation. It depends only on the chosen architecture capability that shared TypeScript packages must be usable by both browser and Node.js packages. The observable outcome is a repository skeleton that an engineer can clone, install, and inspect to see the exact package boundaries intended for the browser-based multiplayer game.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:platform-foundation, type:implementation, area:monorepo, complexity:high |

**Acceptance Criteria**
- Running pnpm install --frozen-lockfile from the repository root creates node_modules and exits with code 0 using package.json, pnpm-workspace.yaml, and pnpm-lock.yaml.
- File inspection confirms pnpm-workspace.yaml includes packages/* and that package.json defines workspaces-compatible scripts for build, typecheck, test, lint, and format:check.
- File inspection confirms packages/client-web/package.json, packages/client-renderer/package.json, packages/client-netcode/package.json, packages/server-api/package.json, packages/server-realtime/package.json, packages/server-game/package.json, packages/shared-protocol/package.json, packages/shared-simulation/package.json, packages/shared-level/package.json, packages/shared-items/package.json, packages/server-telemetry/package.json, and infra/README.md exist.
- Running pnpm -r exec tsc --noEmit exits with code 0 and verifies that packages/shared-protocol/src/index.ts and packages/shared-simulation/src/index.ts compile under tsconfig.base.json.
- Unit tests: packages/shared-protocol/src/index.test.ts and packages/shared-simulation/src/index.test.ts exist, and running pnpm -r test exits with code 0 for those placeholder package exports.
- System integration tests: packages/client-netcode/src/index.test.ts imports a type or constant from @donkey-trump-race/shared-protocol, packages/server-game/src/index.test.ts imports from @donkey-trump-race/shared-simulation, and pnpm -r test exits with code 0.
- Mock data and fixtures: packages/shared-protocol/test/fixtures/example-client-hello.json is committed and referenced by packages/shared-protocol/src/index.test.ts so tests run without network, Azure, or browser dependencies.

### [P0] Configure strict workspace quality gates

Configure Node.js 22, TypeScript strict mode, pnpm lockfile enforcement, ESLint, Prettier, Vitest, and Playwright so every workspace package starts with automated quality gates before gameplay code grows. The work belongs in .nvmrc, package.json, tsconfig.base.json, eslint.config.js, .prettierrc.json, vitest.config.ts, playwright.config.ts, and package-level test files such as packages/shared-simulation/src/index.test.ts and packages/client-web/e2e/workspace-smoke.spec.ts. The current workspace has package boundaries but lacks enforceable compiler, formatting, unit-test, and browser-smoke standards that DevOps teams can run locally and later in CI. This matters because real-time multiplayer fairness depends on type-safe shared contracts and deterministic tests, while closed-beta reliability depends on catching regressions before deployment. When complete, a developer can run a single set of root commands that validate formatting, linting, strict typechecking, unit tests, and a Playwright smoke test without Azure access. This story does not create GitHub Actions workflows, Dockerfiles, Terraform resources, production deployments, or gameplay-specific simulation behavior. It depends on the repository already having package directories and workspace metadata that pnpm can discover. The observable result is a root-level toolchain where missing lockfile entries, loose TypeScript types, lint violations, formatting drift, and broken browser smoke setup produce deterministic nonzero command exits.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:platform-foundation, type:implementation, area:developer-experience, area:quality, complexity:medium |

**Acceptance Criteria**
- File inspection confirms .nvmrc contains 22 and package.json engines.node requires Node.js 22 compatible versions.
- Running pnpm install --frozen-lockfile exits with code 0 and does not modify pnpm-lock.yaml.
- Running pnpm typecheck exits with code 0 and tsconfig.base.json contains strict: true, noImplicitAny: true, strictNullChecks: true, and noUncheckedIndexedAccess: true.
- Running pnpm lint exits with code 0 using eslint.config.js and includes TypeScript linting for packages/shared-protocol/src/index.ts and packages/server-api/src/index.ts.
- Running pnpm format:check exits with code 0 using .prettierrc.json and validates package.json, pnpm-workspace.yaml, tsconfig.base.json, and packages/shared-simulation/src/index.ts.
- Unit tests: running pnpm test:unit exits with code 0 and executes packages/shared-protocol/src/index.test.ts plus packages/shared-simulation/src/index.test.ts under vitest.config.ts.
- System integration tests: running pnpm test:e2e exits with code 0 and executes packages/client-web/e2e/workspace-smoke.spec.ts through playwright.config.ts against the scaffolded client-web workspace smoke page or generated test fixture.
- Mock data and fixtures: packages/shared-protocol/test/fixtures/example-client-hello.json and packages/client-web/e2e/fixtures/workspace-smoke.json are committed and loaded by the Vitest or Playwright tests without external network calls.

**Depends on:** WO-001

### [P0] Define Azure Terraform platform modules

Create Terraform modules for the Azure runtime platform so the closed-beta game has infrastructure-as-code for CDN delivery, Blob telemetry storage, Container Apps runtime, Key Vault secrets, WAF protection, and Application Insights observability. The work belongs under infra/azure/main.tf, infra/azure/variables.tf, infra/azure/outputs.tf, infra/azure/providers.tf, and module folders such as infra/azure/modules/cdn/main.tf, infra/azure/modules/blob-storage/main.tf, infra/azure/modules/container-apps/main.tf, infra/azure/modules/key-vault/main.tf, infra/azure/modules/waf/main.tf, and infra/azure/modules/application-insights/main.tf. The repository currently has only an infra placeholder, so no platform engineer can review cost, blast radius, secret boundaries, retention, or observability wiring before deployment automation is introduced. Stakeholders need this because the MVP must be cheap, recoverable, observable, GDPR-minimal, and protected at the edge while accepting in-memory active match state as a beta-only risk. When complete, terraform fmt and terraform validate can run against the infra/azure composition and all required module variables and outputs are inspectable in version control. This story does not apply Terraform to a real Azure subscription, create GitHub environment secrets, deploy application containers, upload static assets, or configure live DNS. It depends on the repository scaffold including an infra folder and the platform decision to use single-region Azure hosting plus CDN. The observable outcome is reviewable Terraform code with environment parameters for dev, staging, and production and no hardcoded secret values.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:platform-foundation, type:infrastructure, area:azure, area:terraform, complexity:high |

**Acceptance Criteria**
- File inspection confirms infra/azure/providers.tf pins the azurerm provider and configures Terraform required_version without hardcoded Azure subscription IDs, tenant IDs, client secrets, or storage connection strings.
- Running terraform fmt -check -recursive infra/azure exits with code 0 from a developer environment with Terraform installed.
- Running terraform -chdir=infra/azure init -backend=false exits with code 0 and running terraform -chdir=infra/azure validate exits with code 0 using only checked-in variables and no real Azure credentials.
- File inspection confirms infra/azure/modules/cdn/main.tf, infra/azure/modules/blob-storage/main.tf, infra/azure/modules/container-apps/main.tf, infra/azure/modules/key-vault/main.tf, infra/azure/modules/waf/main.tf, and infra/azure/modules/application-insights/main.tf exist.
- File inspection confirms infra/azure/modules/blob-storage/main.tf defines lifecycle management for telemetry or beta artifact blobs and uses variables for retention days rather than hardcoded production-only values.
- File inspection confirms infra/azure/modules/key-vault/main.tf defines least-privilege secret access inputs and does not contain literal secret values such as passwords, tokens, keys, or connection strings.
- Unit tests: N/A — Terraform modules are declarative infrastructure definitions; validation is covered by terraform fmt, terraform init -backend=false, and terraform validate against infra/azure.
- System integration tests: N/A — live Azure provisioning is intentionally excluded from this story; deployment verification is handled by the later deployment workflow and environment-specific runs.
- Mock data and fixtures: infra/azure/env/dev.tfvars.example, infra/azure/env/staging.tfvars.example, and infra/azure/env/production.tfvars.example are committed with placeholder values such as <azure-region> and no real credentials.

**Depends on:** WO-001

### [P0] Automate validation workflow

Create the GitHub Actions validation workflow so every pull request and main-branch change runs the same lint, format, typecheck, unit-test, Playwright, and workspace build gates used locally. The work belongs in .github/workflows/validate.yml and calls root scripts defined in package.json against the pnpm workspace rooted at pnpm-workspace.yaml. The repository currently depends on manual local execution, which is not enough for a closed-beta multiplayer game where shared protocol changes can break both client prediction and server authority. Stakeholders need this automation because it reduces the blast radius of regressions before they reach dev or staging deployments. When complete, pull_request and push events execute separate jobs with Node.js 22, frozen pnpm install, quality checks, unit tests, browser smoke tests, and package builds. This story does not deploy to Azure, build Docker images for runtime promotion, provision cloud infrastructure, or require production environment approvals. It depends on a working local toolchain with strict TypeScript, ESLint, Prettier, Vitest, Playwright, and pnpm lockfile enforcement. The observable behavior is that a reviewer can inspect .github/workflows/validate.yml and see explicit ordered jobs, cache usage, command invocations, and uploaded test artifacts for troubleshooting failed validation runs.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:platform-foundation, type:ci, area:github-actions, complexity:medium |

**Acceptance Criteria**
- File inspection confirms .github/workflows/validate.yml exists and has on.pull_request and on.push triggers for main.
- File inspection confirms .github/workflows/validate.yml uses actions/setup-node with node-version 22 and pnpm/action-setup with a pnpm version compatible with package.json.
- File inspection confirms the install step in .github/workflows/validate.yml runs pnpm install --frozen-lockfile from the repository root.
- File inspection confirms .github/workflows/validate.yml invokes pnpm lint, pnpm format:check, pnpm typecheck, pnpm test:unit, pnpm test:e2e, and pnpm build in validation jobs.
- Running npx actionlint .github/workflows/validate.yml exits with code 0 when actionlint is available in the developer environment or CI tooling container.
- Unit tests: the workflow contains a step named Unit tests that runs pnpm test:unit and references vitest.config.ts through the root package.json script.
- System integration tests: the workflow contains a step named Playwright tests that runs pnpm test:e2e and uploads playwright-report or test-results using actions/upload-artifact.
- Mock data and fixtures: file inspection confirms the workflow does not download external test data and uses committed fixtures under packages/shared-protocol/test/fixtures/example-client-hello.json and packages/client-web/e2e/fixtures/workspace-smoke.json.

**Depends on:** WO-002

### [P0] Containerize Node runtime services

Containerize the server-api and server-realtime packages and add /healthz readiness endpoints so Azure Container Apps can safely probe the runtime services before routing closed-beta traffic. The work belongs in packages/server-api/src/index.ts, packages/server-api/src/health.ts, packages/server-api/Dockerfile, packages/server-realtime/src/index.ts, packages/server-realtime/src/health.ts, packages/server-realtime/Dockerfile, and package-level tests such as packages/server-api/src/health.test.ts and packages/server-realtime/src/health.test.ts. The current server packages are workspace placeholders and do not expose HTTP readiness behavior or deployable container images. This matters because DevOps and SRE teams need deterministic health checks for rollouts, rollback decisions, and mean-time-to-recovery during scheduled beta sessions. When complete, both service containers can be built locally, started with a PORT environment variable, and queried at GET /healthz to return HTTP 200 with a JSON body identifying service name and status. This story does not implement lobby APIs, room tokens, WebSocket gameplay protocols, telemetry batching, Azure deployment, or production autoscaling. It depends on the workspace toolchain being strict and testable so the new server entrypoints compile under Node.js 22. The observable behavior is that Docker build and curl checks prove both services are deployable units with readiness probes matching the Terraform Container Apps health probe configuration.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:platform-foundation, type:implementation, area:containers, area:server-runtime, complexity:medium |

**Acceptance Criteria**
- Running pnpm --filter @donkey-trump-race/server-api test:unit or pnpm test:unit executes packages/server-api/src/health.test.ts and asserts GET /healthz returns status code 200 with body property status equal to ok.
- Running pnpm --filter @donkey-trump-race/server-realtime test:unit or pnpm test:unit executes packages/server-realtime/src/health.test.ts and asserts GET /healthz returns status code 200 with body property status equal to ok.
- Running pnpm --filter @donkey-trump-race/server-api build and pnpm --filter @donkey-trump-race/server-realtime build exits with code 0 and emits compiled JavaScript under each package build output directory.
- Running docker build -f packages/server-api/Dockerfile . -t donkey-trump-race-server-api:test exits with code 0.
- Running docker build -f packages/server-realtime/Dockerfile . -t donkey-trump-race-server-realtime:test exits with code 0.
- Starting the server-api image with PORT=8080 and requesting http://localhost:8080/healthz returns HTTP 200 and JSON containing service: server-api.
- Starting the server-realtime image with PORT=8081 and requesting http://localhost:8081/healthz returns HTTP 200 and JSON containing service: server-realtime.
- System integration tests: packages/server-api/src/health.integration.test.ts and packages/server-realtime/src/health.integration.test.ts start the service listener on an ephemeral port and validate the /healthz HTTP boundary without Azure Container Apps.
- Mock data and fixtures: N/A — /healthz returns generated service readiness metadata and does not require request fixtures, external data, or persisted state.

**Depends on:** WO-001, WO-002

### [P1] Automate environment deployments

Create the deployment workflow for dev, staging, and production so validated builds can be promoted through GitHub Environments with manual production approval before any closed-beta expansion. The work belongs in .github/workflows/deploy.yml and must coordinate artifacts from the workspace, Dockerfiles under packages/server-api/Dockerfile and packages/server-realtime/Dockerfile, and Terraform code under infra/azure/main.tf. The repository currently has validation automation, Terraform definitions, and containerized services, but no release pipeline that builds images, scans them, deploys to Azure, and separates environments by approval boundary. This matters because multiplayer outages during beta should be isolated to an environment, diagnosable through deployment history, and recoverable by rerunning a known workflow revision. When complete, push to main can deploy dev, workflow_dispatch can target staging or production, and the production job references the production GitHub Environment so repository admins can enforce manual approval. This story does not configure the GitHub Environment approval rule in the GitHub UI, create real Azure credentials, provision resources by hand, implement blue-green traffic shifting, or build gameplay features. It depends on automated validation, Terraform platform modules, and Dockerized runtime services with /healthz readiness endpoints. The observable result is a deploy.yml workflow with explicit needs ordering from validation to build, scan, infrastructure plan or apply, application deployment, and health smoke checks for /healthz.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P1 |
| Labels | epic:platform-foundation, type:cd, area:github-actions, area:azure, complexity:high |

**Acceptance Criteria**
- File inspection confirms .github/workflows/deploy.yml exists with triggers for push to main and workflow_dispatch with an environment input limited to dev, staging, or production.
- File inspection confirms .github/workflows/deploy.yml defines jobs or steps that run pnpm install --frozen-lockfile, pnpm lint, pnpm format:check, pnpm typecheck, pnpm test:unit, and pnpm build before any deploy job.
- File inspection confirms .github/workflows/deploy.yml builds images using packages/server-api/Dockerfile and packages/server-realtime/Dockerfile and tags them with the GitHub SHA or a similarly immutable revision identifier.
- File inspection confirms .github/workflows/deploy.yml includes a container scan step for both server-api and server-realtime images before deployment jobs execute.
- File inspection confirms deploy-dev, deploy-staging, and deploy-production jobs use environment: dev, environment: staging, and environment: production respectively, and the production job is reachable only through workflow_dispatch or protected environment rules.
- File inspection confirms .github/workflows/deploy.yml runs terraform -chdir=infra/azure fmt -check, terraform -chdir=infra/azure init, and terraform -chdir=infra/azure validate or plan before Azure deployment steps.
- File inspection confirms the workflow includes post-deploy smoke checks that request /healthz for server-api and server-realtime URLs supplied by environment variables or GitHub Environment variables.
- Unit tests: N/A — this story is GitHub Actions deployment orchestration; service unit tests are invoked by the workflow through pnpm test:unit rather than newly authored application logic.
- System integration tests: the workflow contains health smoke steps for GET /healthz against both deployed service endpoints and treats non-200 responses as failed deployment checks.
- Mock data and fixtures: N/A — deployment uses built artifacts, container images, Terraform variables, and environment secrets; no mock gameplay or API fixture data is required.

**Depends on:** WO-004, WO-003, WO-005

---

## Shared protocol contracts and deterministic simulation foundations

### [P0] Create shared protocol schemas

Create shared protocol schemas so the browser client and authoritative Node.js server exchange the same REST error envelopes, room token claims, WebSocket messages, input commands, and state snapshots without contract drift. The primary module is SharedProtocol at packages/shared-protocol/src/index.ts, with schema-focused source files under packages/shared-protocol/src/schemas/ and tests under packages/shared-protocol/test/. The current project has no indexed shared-protocol implementation, so downstream room bootstrap, raw WebSocket gameplay, client prediction, and server snapshot broadcasting lack a typed contract boundary. This matters to stakeholders because fair closed-beta multiplayer depends on clients sending bounded inputs while the server owns competitive truth for movement, collisions, items, hazards, fall penalties, and rescue order. When complete, developers can import versioned TypeScript types and runtime validators for POST /api/v1/rooms, POST /api/v1/rooms/{code}/join, client.hello, client.input, client.ready, server.snapshot, server.error, and server.matchEnded payloads. The story should keep the protocol JSON-friendly for MVP debugging and must not introduce binary transport, MessagePack, Socket.IO, REST controllers, token signing logic, room storage, or WebSocket gateway behavior. The work depends on repository/package foundation and TypeScript workspace capability being present, plus the shared error envelope capability being available for typed error responses. It should also preserve privacy-minimal guest play by modelling room tokens as scoped claims rather than account identities. Operationally, the schemas should be deterministic, serializable, and easy to validate in CI so protocol regressions block deployment before they reach beta testers.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:shared-contracts, shared-protocol, typescript, websocket, rest, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-protocol executes packages/shared-protocol/test/protocolSchemas.test.ts and asserts validateClientInput rejects a movement axis outside -1..1, validateRoomTokenClaims rejects an expired exp value, and validateServerSnapshot accepts a committed fixture from packages/shared-protocol/test/fixtures/serverSnapshot.v1.json.
- System integration tests: running npm test --workspace packages/shared-protocol -- protocolCompatibility executes packages/shared-protocol/test/protocolCompatibility.test.ts and round-trips client.hello, client.input, server.snapshot, and server.error JSON fixtures through parseWebSocketMessage without changing the message type field or protocolVersion value.
- Mock data/fixtures: file inspection confirms packages/shared-protocol/test/fixtures contains roomTokenClaims.valid.json, clientInput.valid.json, serverSnapshot.v1.json, restErrorEnvelope.invalidNickname.json, and websocketServerError.tokenViolation.json with no raw secrets and no nickname beyond safe sample values.
- File inspection: packages/shared-protocol/src/index.ts exports RestErrorEnvelope, RoomTokenClaims, WebSocketMessage, ClientInputCommand, AuthoritativeSnapshot, validateRestErrorEnvelope, validateRoomTokenClaims, validateWebSocketMessage, validateClientInputCommand, and validateAuthoritativeSnapshot.
- Protocol boundary: packages/shared-protocol/src/schemas/websocket.ts defines discriminated message types for client.hello, client.input, client.ready, client.useItem, server.snapshot, server.error, server.lobbyState, and server.matchEnded, and each schema includes protocolVersion as a required field.
- API contract: packages/shared-protocol/src/schemas/rest.ts defines POST /api/v1/rooms and POST /api/v1/rooms/{code}/join response shapes with token, roomCode, playerSlot, color, and expiresAt fields for successful room bootstrap, plus a shared RestErrorEnvelope for failures.

**Depends on:** WO-001, WO-002

### [P0] Add shared error catalog

Implement a shared error catalog so lobby and real-time flows return consistent invalid nickname, invalid room code, full room, expired room, in-progress room, token violation, and rate-limit responses that users can recover from. The primary module is SharedErrors at packages/shared-errors/src/index.ts, with catalog definitions in packages/shared-errors/src/catalog.ts and envelope helpers in packages/shared-errors/src/envelope.ts. The current project has no indexed shared-errors implementation, so future REST and WebSocket code would otherwise risk leaking inconsistent messages, stack traces, or internal room state. This matters because the closed-beta join funnel depends on clear recovery paths when a player mistypes a room code, joins after capacity is reached, or presents an expired room token. When complete, developers can import canonical error codes, HTTP status mappings, safe user messages, operational severity, and machine-readable recovery actions from one package. This story does not implement REST endpoints, WebSocket close behavior, rate limiter storage, structured logging sinks, localization, telemetry export, or UI rendering. It depends on TypeScript package foundation and will be consumed by the shared protocol schemas, server REST bootstrap, WebSocket token validation, and lobby UI. The catalog must follow API design conventions by using appropriate HTTP status codes such as 400, 401, 403, 404, 409, 410, and 429, while keeping messages actionable and non-sensitive. The operational goal is to reduce beta support time and make join failure metrics reliable by ensuring every expected failure state has one stable code.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:shared-contracts, shared-errors, api-errors, security, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-errors executes packages/shared-errors/test/errorCatalog.test.ts and asserts INVALID_NICKNAME maps to statusCode 400, INVALID_ROOM_CODE maps to 404, ROOM_FULL maps to 409, ROOM_EXPIRED maps to 410, ROOM_IN_PROGRESS maps to 409, TOKEN_VIOLATION maps to 401 or 403 by violation type, and RATE_LIMITED maps to 429.
- System integration tests: running npm test --workspace packages/shared-errors -- envelopeCompatibility executes packages/shared-errors/test/envelopeCompatibility.test.ts and asserts createErrorEnvelope('ROOM_FULL') serializes to JSON with fields error.code, error.message, error.recoveryAction, requestId, and statusCode without stack or details.secret fields.
- Mock data/fixtures: file inspection confirms packages/shared-errors/test/fixtures contains invalidNickname.json, invalidRoomCode.json, fullRoom.json, expiredRoom.json, inProgressRoom.json, tokenViolation.json, and rateLimited.json for downstream API and UI tests.
- File inspection: packages/shared-errors/src/catalog.ts defines exactly the required canonical error codes INVALID_NICKNAME, INVALID_ROOM_CODE, ROOM_FULL, ROOM_EXPIRED, ROOM_IN_PROGRESS, TOKEN_VIOLATION, and RATE_LIMITED with safe userMessage values.
- Security inspection: packages/shared-errors/src/envelope.ts never includes Error.stack, process.env, raw token values, raw nickname values, or internal room ids in the returned RestErrorEnvelope or WebSocketErrorEnvelope shapes.
- API convention: packages/shared-errors/src/httpStatus.ts exports getHttpStatusForErrorCode and the tests in packages/shared-errors/test/errorCatalog.test.ts assert expected status codes for every catalog entry.

**Depends on:** WO-001, WO-002

### [P0] Model MVP vertical map metadata

Model the shared MVP vertical map metadata so simulation, item placement, rendering, and rescue logic all use the same floors, ladders, left wall, right fall edge, Motzfeldt rescue zone, and boss spawn definitions. The primary module is SharedLevel at packages/shared-level/src/index.ts, with the MVP map data in packages/shared-level/src/maps/mvpVerticalMap.ts and geometry validation in packages/shared-level/src/validators.ts. The current project has no indexed shared-level implementation, so the map rules described in the product and architecture artifacts would otherwise be duplicated in client rendering and server simulation. This matters because Jumpman Løkke must not be able to bypass the intended vertical route, and players must consistently see the same left wall, right fall risk, rescue objective, and boss position across all clients. When complete, developers can import MVP_VERTICAL_MAP and query helpers for floors, ladders, rescue zone, wall bounds, fall edge, spawn points, and boss spawn without hardcoding map constants elsewhere. This story does not create Three.js meshes, textures, camera placement, boss AI, barrel motion, item effects, movement physics, room logic, or telemetry. It depends on TypeScript package foundation and is a prerequisite for deterministic movement helpers and shared item pickup volumes. The metadata should be declarative, unit-aware, and validated at test time to reduce operational risk from bad map data causing stuck players or impossible rescue routes. The map must represent a single MVP vertical level only and must not expand scope into multiple maps or campaign content.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:shared-contracts, shared-level, map-metadata, deterministic-simulation, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-level executes packages/shared-level/test/mvpVerticalMap.test.ts and asserts MVP_VERTICAL_MAP.floors.length is at least 3, MVP_VERTICAL_MAP.ladders.length is at least 2, and every ladder connects two valid floorId values.
- System integration tests: running npm test --workspace packages/shared-level -- mapContract executes packages/shared-level/test/mapContract.test.ts and asserts getRescueZone(MVP_VERTICAL_MAP).id equals 'motzfeldt-rescue', getBossSpawn(MVP_VERTICAL_MAP).x is greater than getPlayableBounds(MVP_VERTICAL_MAP).rightFallEdgeX - 2, and getPlayableBounds(MVP_VERTICAL_MAP).leftWallX is less than every floor segment startX.
- Mock data/fixtures: file inspection confirms packages/shared-level/test/fixtures/mvpVerticalMap.json is committed and equals the serialized MVP_VERTICAL_MAP exported from packages/shared-level/src/maps/mvpVerticalMap.ts.
- File inspection: packages/shared-level/src/types.ts defines LevelMetadata, FloorSegment, LadderVolume, RescueZone, BossSpawn, PlayerSpawn, and PlayableBounds without importing Three.js, React, ws, or server modules.
- Validation behavior: packages/shared-level/src/validators.ts exports validateLevelMetadata, and packages/shared-level/test/mvpVerticalMap.test.ts asserts it rejects a ladder whose bottomFloorId or topFloorId is not present in the floors array.
- Scope control: packages/shared-level/src/maps/mvpVerticalMap.ts exports exactly one MVP map constant named MVP_VERTICAL_MAP and does not define additional production map constants.

**Depends on:** WO-001, WO-002

### [P0] Implement deterministic movement helpers

Implement shared deterministic movement helpers so Jumpman Løkke obeys half-height jumping, ladder traversal, floor collision, left wall blocking, and right-edge fall detection identically in server authority and client prediction. The primary module is SharedSimulation at packages/shared-simulation/src/index.ts, with movement logic in packages/shared-simulation/src/movement.ts and collision queries in packages/shared-simulation/src/collision.ts. The current project has no indexed shared-simulation implementation, so future client and server code could diverge on whether a player can reach a floor, climb a ladder, hit the left wall, or fall from the right edge. This matters because closed-beta players will judge fairness by whether movement outcomes and server corrections match what they see in the browser. When complete, developers can call stepPlayerMovement with a player state, bounded input command, fixed delta time, and MVP_VERTICAL_MAP metadata to receive a deterministic next state and movement events. This story does not implement the authoritative match loop, WebSocket input queue, player-to-player shove mechanics, barrel physics, item effects, rescue completion, rendering animations, or audio/visual feedback. It depends on the shared level metadata capability being available and should consume map data rather than embed duplicate constants. The helpers must be pure, side-effect free, and independent of wall-clock time so CI can replay fixtures exactly and production incidents can be debugged from input snapshots. Operationally, this reduces desynchronization risk and creates a safe contract for later server match runner and client netcode packages.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:shared-contracts, shared-simulation, movement, deterministic-tests, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-simulation executes packages/shared-simulation/test/movement.test.ts and asserts stepPlayerMovement cannot move a grounded player above the next floor using a half-height jump from packages/shared-simulation/test/fixtures/halfHeightJump.json.
- Unit tests: packages/shared-simulation/test/ladderTraversal.test.ts asserts stepPlayerMovement transitions a player upward only when the player position intersects a LadderVolume from packages/shared-level/src/maps/mvpVerticalMap.ts and climbY is positive.
- Unit tests: packages/shared-simulation/test/boundsCollision.test.ts asserts resolveFloorCollision places the player on the expected FloorSegment, blockLeftWall clamps x to getPlayableBounds(MVP_VERTICAL_MAP).leftWallX, and detectRightEdgeFall returns true when x exceeds rightFallEdgeX.
- System integration tests: running npm test --workspace packages/shared-simulation -- levelIntegration executes packages/shared-simulation/test/levelIntegration.test.ts and replays a committed command sequence over MVP_VERTICAL_MAP to assert the final player state exactly matches packages/shared-simulation/test/fixtures/verticalTraversal.expected.json.
- Mock data/fixtures: file inspection confirms packages/shared-simulation/test/fixtures contains halfHeightJump.json, ladderTraversal.json, leftWallBlock.json, rightEdgeFall.json, and verticalTraversal.expected.json with deterministic numeric inputs and outputs.
- File inspection: packages/shared-simulation/src/movement.ts exports stepPlayerMovement, canJump, applyJumpVelocity, applyLadderTraversal, and applyGravity without importing Date, Math.random, Three.js, React, ws, or server runtime modules.

**Depends on:** WO-008

### [P1] Define shared item effect schemas

Define shared item pickup volumes and MVP power-up effect schemas so the server can award and apply self-benefit and opponent-affecting items consistently while the client can render the same pickup and inventory state. The primary module is SharedItems at packages/shared-items/src/index.ts, with pickup definitions in packages/shared-items/src/pickups.ts and effect schemas in packages/shared-items/src/effects.ts. The current project has no indexed shared-items implementation, so item boxes, boosts, shields, opponent stuns, and other competitive effects would otherwise be invented separately by gameplay, UI, and protocol code. This matters because Mario Kart-style comeback mechanics are a key business differentiator, but they must remain server-authoritative and predictable enough that players do not dispute item outcomes. When complete, developers can import typed ItemPickupVolume definitions, item instance schemas, and effect descriptors for one self-benefit item and one opponent-affecting item, with validation that pickup volumes are placed inside the MVP map. This story does not implement random item distribution, inventory UI, visual effects, projectile simulation, collision resolution, rate limiting, match balancing, or final item application in the authoritative match runner. It depends on shared protocol serialization capability and shared level metadata so item definitions are JSON-friendly and map-aware. The work should create deterministic fixtures to support later replay tests and avoid hidden randomness in shared metadata. Operationally, clear item schemas reduce blast radius by letting future item changes be reviewed as data and validated before deployment.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P1 |
| Labels | epic:shared-contracts, shared-items, power-ups, protocol, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-items executes packages/shared-items/test/itemSchemas.test.ts and asserts validateItemEffect accepts SELF_SPEED_BOOST and OPPONENT_STUN descriptors while rejecting unknown effectType values.
- Unit tests: packages/shared-items/test/pickupVolumes.test.ts asserts every MVP_ITEM_PICKUP_VOLUMES entry from packages/shared-items/src/pickups.ts has positive width, height, and depth and is inside getPlayableBounds(MVP_VERTICAL_MAP) from packages/shared-level/src/maps/mvpVerticalMap.ts.
- System integration tests: running npm test --workspace packages/shared-items -- protocolSerialization executes packages/shared-items/test/protocolSerialization.test.ts and asserts item pickup and held item fixtures serialize to JSON and validate against the shared protocol item state shape in packages/shared-protocol/src/schemas/snapshot.ts.
- Mock data/fixtures: file inspection confirms packages/shared-items/test/fixtures contains itemPickupVolumes.mvp.json, selfSpeedBoost.effect.json, opponentStun.effect.json, and heldItem.snapshot.json for downstream simulation and snapshot tests.
- File inspection: packages/shared-items/src/effects.ts defines a discriminated ItemEffect union with categories selfBenefit and opponentAffecting and durationMs fields where applicable.
- Scope control: packages/shared-items/src/effects.ts contains no Math.random, Date.now, server room imports, WebSocket imports, React imports, or Three.js imports, and packages/shared-items/src/pickups.ts exports deterministic metadata only.

**Depends on:** WO-006, WO-008

### [P0] Add deterministic simulation fixtures

Add deterministic shared-simulation test fixtures so ladders, half-height jump, right-edge fall, item pickup, barrel stun, and rescue ordering can be replayed identically by CI and future client/server packages. The primary module is SharedSimulationTestFixtures at packages/shared-simulation/test/fixtures/index.ts, with replay tests in packages/shared-simulation/test/deterministicFixtures.test.ts. The current project has no indexed deterministic fixture suite, so foundational movement and gameplay rule changes could regress without an automated replay proving the same inputs produce the same outputs. This matters because multiplayer reliability and perceived fairness depend on the server resolving hazards, items, falls, and rescue order consistently for every player in a five-player room. When complete, developers can run one workspace test command and see fixture-backed assertions for ladder movement, half-height jump prevention, right-edge fall detection, item pickup volume intersection, exactly 2000 ms barrel stun timing, and simultaneous rescue ordering by server tick and deterministic tie-breaker. This story does not build boss AI, live barrel spawning, WebSocket transport, room lifecycle, rendering, star visual effects, telemetry dashboards, or production incident tooling. It depends on deterministic movement helpers, shared item schemas, shared level metadata, and protocol-compatible snapshot shapes being available. The fixtures should be plain JSON and small enough for code review, because they are operational evidence that future client prediction and server authority are using the same rules. The test harness should avoid wall-clock time, randomness, external services, network sockets, and hidden global state so failures are reproducible in local development and GitHub Actions.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:shared-contracts, deterministic-fixtures, shared-simulation, ci-readiness, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test --workspace packages/shared-simulation executes packages/shared-simulation/test/deterministicFixtures.test.ts and asserts fixtures ladderTraversal.json, halfHeightJump.json, and rightEdgeFall.json replay to the exact expected player states committed in packages/shared-simulation/test/fixtures/expected/*.json.
- Unit tests: packages/shared-simulation/test/itemPickupFixture.test.ts asserts itemPickup.json intersects the configured ItemPickupVolume from packages/shared-items/src/pickups.ts at the expected serverTick and produces the committed held item state in packages/shared-simulation/test/fixtures/expected/itemPickup.expected.json.
- Unit tests: packages/shared-simulation/test/barrelStunFixture.test.ts asserts barrelStun.json produces stunnedUntilMs - hitAtMs === 2000 and rejects movement inputs before stunnedUntilMs while accepting normal movement after stunnedUntilMs.
- Unit tests: packages/shared-simulation/test/rescueOrderingFixture.test.ts asserts rescueOrdering.json orders simultaneous rescue candidates by serverTick first and deterministic playerSlot tie-breaker second, matching packages/shared-simulation/test/fixtures/expected/rescueOrdering.expected.json.
- System integration tests: running npm test --workspace packages/shared-simulation -- deterministicFullRun executes packages/shared-simulation/test/deterministicFullRun.test.ts and replays level, movement, item, stun, and rescue fixtures together without importing server WebSocket gateway, REST API, React, or Three.js modules.
- Mock data/fixtures: file inspection confirms packages/shared-simulation/test/fixtures contains ladderTraversal.json, halfHeightJump.json, rightEdgeFall.json, itemPickup.json, barrelStun.json, rescueOrdering.json, and expected output JSON files under packages/shared-simulation/test/fixtures/expected/.

**Depends on:** WO-014, WO-015

---

## Guest room lifecycle, room-token authorization, and WebSocket session control

### [P0] Build in-memory room lifecycle manager

Implement the server-side room lifecycle manager so guest hosts and invitees can form reliable five-player lobbies without accounts. The primary module is server-room in packages/server-room/src/RoomManager.ts, with supporting shared types in packages/shared-protocol/src/rooms.ts if the protocol package already exists from the server foundation work. This project is currently greenfield from the repository intelligence perspective, so the target state is a deterministic, testable TypeScript service rather than ad hoc room state embedded in HTTP or WebSocket handlers. The RoomManager must create short invite codes, enforce a maximum of five player slots, mark the creator as host, assign each occupied slot a distinct player color, and expire idle lobby rooms after 15 minutes. It must also support match-ended cleanup after 5 minutes and reserve a disconnected player slot during the reconnect grace period without allowing a sixth player to consume that slot. Stakeholders will recognize this as the operational core of the no-install party flow because it prevents overfilled rooms, color collisions, stale lobbies, and ambiguous host ownership. When complete, a developer can instantiate RoomManager in a unit test, create a room with a nickname, join four additional players, observe five unique colors, and receive a structured capacity failure for the sixth join attempt. This story does not include HTTP route handlers, WebSocket token verification, real-time simulation, persistent storage, Azure Blob telemetry export, or client lobby UI. It depends on the server project scaffold, shared validation primitives, and shared protocol type conventions being available so the room service remains decoupled from framework code.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:server-room, priority:P0, complexity:high |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts verifies RoomManager.createRoom, RoomManager.joinRoom, RoomManager.startRoom, RoomManager.releaseDisconnectedSlot, and RoomManager.purgeExpiredRooms.
- System integration tests: N/A — this story exposes an in-process server-room service only; cross-boundary HTTP and WebSocket integration is covered by the API and realtime stories that call RoomManager.
- Mock data and fixtures generated and committed: packages/server-room/src/__tests__/fixtures/roomFixtures.ts exports deterministic nicknames, color palette expectations, fake clock helpers, and sample room codes used by RoomManager.test.ts.
- File inspection confirms packages/server-room/src/RoomManager.ts defines MAX_PLAYERS as 5 and exposes a capacity failure path that returns or throws a typed RoomError with code ROOM_FULL when a sixth active slot is requested.
- File inspection confirms packages/server-room/src/RoomManager.ts assigns exactly one host role during createRoom and does not transfer host role during ordinary joinRoom calls.
- Running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts includes an assertion that five occupied slots have five distinct color values from packages/shared-protocol/src/rooms.ts.
- Running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts includes fake-clock assertions for 15-minute lobby idle TTL, 5-minute post-match TTL, and 60-second reconnect reservation retention.

**Depends on:** WO-006, WO-007

### [P0] Create room API with host token

Implement POST /api/v1/rooms so a guest host can validate a nickname, create a lobby, receive the host slot, and get a short-lived room token for later privileged actions. The primary module is server-api in packages/server-api/src/routes/rooms.ts, with token support in packages/server-api/src/auth/roomTokens.ts and RoomManager injection from packages/server-room/src/RoomManager.ts. The current project goal requires low-friction room creation without accounts, but room code knowledge alone must not authorize match start or WebSocket gameplay. This endpoint turns the domain RoomManager into an HTTPS bootstrap path that the browser lobby can call before opening a realtime connection. The endpoint must accept only allow-listed nicknames, preserve Unicode names such as Løkke, avoid stack traces in responses, and return structured JSON that includes room code, player slot id, host role, assigned color, token expiry, and room token. Stakeholders will see the benefit as a host being able to create a shareable room quickly while operations retain a clear authorization boundary and auditable failure modes. When complete, a developer can send a valid POST /api/v1/rooms request and observe HTTP 201 with a host token scoped to the created room and player slot. Invalid nickname input must produce HTTP 400 with an actionable structured error response and must not create a room. This story does not include joining existing rooms, starting matches, WebSocket client.hello, telemetry export, or client UI rendering. It depends on the in-memory room lifecycle service and shared validation/error response conventions already being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:server-api, priority:P0, complexity:medium |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/roomTokens.test.ts validates room token signing, expiry, roomCode claim, playerSlotId claim, role claim, and rejection of tampered tokens.
- System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.create.int.test.ts sends POST /api/v1/rooms with nickname LarsFan and asserts HTTP 201 plus response fields roomCode, playerId, slotIndex, color, role host, roomToken, and expiresAt.
- Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts provides valid nickname, invalid nickname, deterministic token secret placeholder, and fake clock values for create-room tests.
- POST /api/v1/rooms with nickname containing unsupported symbols returns HTTP 400 and a JSON error.code value of INVALID_NICKNAME from packages/server-api/src/routes/rooms.ts.
- File inspection confirms packages/server-api/src/routes/rooms.ts calls RoomManager.createRoom and never directly mutates RoomManager internal maps.
- File inspection confirms packages/server-api/src/auth/roomTokens.ts uses a server-side secret loaded from configuration and does not include any hard-coded real secret value.
- Running npm test -- packages/server-api/src/__tests__/rooms.create.int.test.ts includes an assertion that the returned roomToken verifies to role host for the same roomCode and playerId.

**Depends on:** WO-012

### [P0] Join room API with capacity checks

Implement POST /api/v1/rooms/{code}/join so invited guests can enter a valid lobby, receive an available slot, and get a distinct Jumpman Løkke color. The primary module is server-api in packages/server-api/src/routes/rooms.ts, backed by RoomManager in packages/server-room/src/RoomManager.ts and shared error types in packages/shared-protocol/src/rooms.ts. The room-code join flow is the main social onboarding path for the closed beta, so the endpoint must distinguish invalid input, missing rooms, expired rooms, full rooms, and in-progress rooms without exposing internals. The API must validate both the path room code and submitted nickname using allow-listed rules before attempting to allocate a slot. Successful joins must return a participant-scoped room token and the current lobby roster needed by the browser to show who has joined. Capacity enforcement must respect active players and reconnect-reserved slots so reconnect grace cannot be bypassed by a late joiner. Stakeholders will recognize the value as fewer failed invite attempts, clearer recovery messages for guests, and no silent overfill beyond the five-player cap. When complete, a developer can create a room, call POST /api/v1/rooms/{code}/join four times successfully, and receive HTTP 409 or the agreed conflict status with ROOM_FULL on the next join. This story does not include creating rooms, starting matches, realtime WebSocket attachment, or client-side lobby rendering. It depends on the in-memory room manager, host-token issuance capability, and structured REST error envelope being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:server-api, priority:P0, complexity:medium |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.join.mapping.test.ts verifies mapJoinRoomError returns HTTP 400 for INVALID_ROOM_CODE, HTTP 404 for ROOM_NOT_FOUND, HTTP 409 for ROOM_FULL, and HTTP 409 for ROOM_IN_PROGRESS.
- System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.join.int.test.ts creates a room through POST /api/v1/rooms and joins it through POST /api/v1/rooms/{code}/join with HTTP 201.
- Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts includes join request bodies, a full-room fixture, expired-room fixture setup, and invalid room-code examples.
- POST /api/v1/rooms/{code}/join with an invalid room code format returns HTTP 400 and JSON error.code INVALID_ROOM_CODE from packages/server-api/src/routes/rooms.ts.
- POST /api/v1/rooms/{code}/join for a nonexistent but well-formed code returns HTTP 404 and JSON error.code ROOM_NOT_FOUND from packages/server-api/src/routes/rooms.ts.
- Running npm test -- packages/server-api/src/__tests__/rooms.join.int.test.ts includes an assertion that all joined response color fields are unique across the five-player roster.
- File inspection confirms packages/server-api/src/routes/rooms.ts signs participant tokens with role participant and does not allow the join route to assign role host.

**Depends on:** WO-012

### [P0] Verify WebSocket hello and inputs

Implement the server-realtime WebSocket gateway so gameplay clients must authenticate with client.hello before sending heartbeat or input commands. The primary module is server-realtime in packages/server-realtime/src/WebSocketGateway.ts, with message schemas in packages/shared-protocol/src/realtime.ts and room-token verification imported from packages/server-api/src/auth/roomTokens.ts or a shared auth location established by the scaffold. The architecture selected raw WebSocket gameplay over Node.js ws because rooms are small and server authority is required for fair competition. The gateway must reject unauthenticated messages, verify room token claims, attach the socket to the correct room and player slot, enforce heartbeat liveness, cap message payload size, and admit only bounded client.input commands after hello succeeds. This directly protects the SLO for stable five-player rooms by preventing malformed or abusive browser traffic from exhausting the single-region game server. The observable target is that a client can connect, send client.hello with a valid room token, receive server.welcome, send heartbeat messages, and submit input at the allowed rate, while invalid tokens and oversized payloads are closed with explicit close codes. Input command admission must validate command type, sequence number, axes, jump, climb, ready, start intent if supported, and item-use fields according to shared protocol bounds, but it must not trust client positions or outcomes. This story does not include reconnect grace lease implementation, match simulation, snapshot broadcasting, item effects, collision resolution, or client-side netcode. It depends on room token issuance, in-memory room state, and shared protocol validation being available so the realtime gateway can verify identity and route commands.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:server-realtime, priority:P0, complexity:high |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-realtime/src/__tests__/messageValidation.test.ts verifies parseClientMessage rejects unknown types, invalid client.input bounds, missing sequence numbers, and payloads over the configured byte cap.
- System integration tests written and passing: running npm test -- packages/server-realtime/src/__tests__/clientHello.int.test.ts opens a WebSocket to the test server, sends client.hello with a valid roomToken, and asserts a server.welcome message for the expected roomCode and playerId.
- Mock data and fixtures generated and committed: packages/server-realtime/src/__tests__/fixtures/realtimeFixtures.ts includes valid hello, invalid token hello, oversize payload, heartbeat, and bounded input command examples.
- A WebSocket connection that sends client.input before client.hello is closed by packages/server-realtime/src/WebSocketGateway.ts with close code 4401 or the documented UNAUTHENTICATED close code.
- A WebSocket connection that sends a client.hello with an invalid or expired roomToken receives server.error or closes with an authentication failure code from packages/server-realtime/src/WebSocketGateway.ts.
- File inspection confirms packages/server-realtime/src/WebSocketGateway.ts sets a maximum inbound payload size constant and applies it before JSON parsing.
- Running npm test -- packages/server-realtime/src/__tests__/heartbeat.int.test.ts verifies heartbeat timeout closes an authenticated but silent socket after the configured liveness window.

**Depends on:** WO-006, WO-012

### [P0] Authorize host match start endpoint

Implement POST /api/v1/rooms/{code}/start so only the room host can transition a valid lobby into an in-progress match. The primary module is server-api in packages/server-api/src/routes/rooms.ts, with authorization performed through packages/server-api/src/auth/roomTokens.ts and lifecycle changes delegated to packages/server-room/src/RoomManager.ts. The lobby host needs a safe start control, but operations need the endpoint to reject participant tokens, missing tokens, stale tokens, underfilled rooms, unready players, and already-started matches with measurable status codes. The endpoint must require Authorization: Bearer <roomToken>, verify the token signature and claims, confirm the role is host for the same room code, and then call the room manager start transition. A valid start requires at least two players and whatever readiness state is exposed by the room manager for occupied slots. Successful start should return HTTP 200 with room code, match id or match state identifier, roster, state in_progress, and server time so downstream realtime systems have an observable boundary. Stakeholders will recognize this as the protection that prevents random joiners from launching a match early or repeatedly restarting an active game. When complete, a developer can create a room, join a second player, mark readiness through the available room manager capability, and call POST /api/v1/rooms/{code}/start with the host token to receive a start response. This story does not include the fixed-tick match simulation, WebSocket snapshot broadcasting, client lobby button behavior, or telemetry dashboards. It depends on create and join APIs issuing scoped room tokens and on the room lifecycle service enforcing player count, readiness, and in-progress state.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:server-api, priority:P0, complexity:medium |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.start.auth.test.ts verifies verifyStartAuthorization rejects missing Authorization header with HTTP 401, participant role with HTTP 403, mismatched roomCode claim with HTTP 403, and expired token with HTTP 401.
- System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.start.int.test.ts creates a room, joins a second player, satisfies readiness, calls POST /api/v1/rooms/{code}/start, and asserts HTTP 200 with state in_progress.
- Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts includes host token, participant token, expired token, not-ready roster, and one-player room fixtures.
- POST /api/v1/rooms/{code}/start with only one player returns HTTP 409 and JSON error.code MIN_PLAYERS_REQUIRED from packages/server-api/src/routes/rooms.ts.
- POST /api/v1/rooms/{code}/start when any required player is not ready returns HTTP 409 and JSON error.code PLAYERS_NOT_READY from packages/server-api/src/routes/rooms.ts.
- Calling POST /api/v1/rooms/{code}/start twice with the same host token returns HTTP 409 and JSON error.code MATCH_ALREADY_STARTED on the second call.
- File inspection confirms packages/server-api/src/routes/rooms.ts never trusts a role value from the request body and only reads host authorization from verified room token claims.

**Depends on:** WO-018, WO-019

### [P1] Reserve slots during reconnect grace

Implement the 60-second reconnect grace lease for dropped WebSocket player slots so transient network loss does not immediately eject a player from an active match. The primary module is server-realtime in packages/server-realtime/src/ReconnectLeaseManager.ts, integrated with packages/server-realtime/src/WebSocketGateway.ts and the RoomManager reservation methods in packages/server-room/src/RoomManager.ts. Browser multiplayer over raw WebSocket will see brief disconnects during beta, and the host should not lose a player slot because of a short Wi-Fi or tab suspension event. On abnormal socket close after successful client.hello, the gateway must mark the player slot disconnected, create a reconnect lease expiring 60 seconds later, and keep the slot and color reserved during that window. A reconnecting client with a valid token for the same room and player slot must reattach to the existing slot, clear the disconnected state, and resume command admission without allocating a new slot. If the lease expires, the reservation must be released so capacity checks and lobby state are accurate. Stakeholders will recognize this as preserving match continuity and reducing forced restarts during invited beta sessions without introducing persistent accounts or durable state. When complete, a developer can connect, authenticate, close the socket, reconnect within 60 seconds with the same room token, and observe the same playerId, slotIndex, and color in server.welcome. This story does not include reconnect UI, token refresh, crash recovery across server restarts, Redis-backed presence, or multi-region session migration. It depends on authenticated WebSocket session state, room manager reconnect reservation support, and valid room-token claims.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:guest-room-lifecycle, area:server-realtime, priority:P1, complexity:medium |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-realtime/src/__tests__/ReconnectLeaseManager.test.ts verifies createLease, consumeLease, expireLeases, same-player matching, and 60-second expiry using a fake clock.
- System integration tests written and passing: running npm test -- packages/server-realtime/src/__tests__/reconnectLease.int.test.ts authenticates a WebSocket, closes it, reconnects within 60 seconds using client.hello, and asserts server.welcome returns the same playerId, slotIndex, and color.
- Mock data and fixtures generated and committed: packages/server-realtime/src/__tests__/fixtures/reconnectFixtures.ts includes authenticated session claims, reconnect-within-grace timing, expired-lease timing, and wrong-player token examples.
- Running npm test -- packages/server-realtime/src/__tests__/reconnectLease.int.test.ts includes an assertion that reconnect after 61 seconds is rejected or treated as slot unavailable with error.code RECONNECT_EXPIRED.
- File inspection confirms packages/server-realtime/src/WebSocketGateway.ts calls RoomManager.releaseDisconnectedSlot or the equivalent reservation method on authenticated socket close.
- File inspection confirms packages/server-realtime/src/ReconnectLeaseManager.ts uses a RECONNECT_GRACE_MS constant equal to 60000.
- A join or capacity test in packages/server-room/src/__tests__/RoomManager.test.ts asserts a grace-reserved slot still counts against the five-player capacity until the lease expires.

**Depends on:** WO-020

### [P0] Add room and realtime integration tests

Add server-api and server-realtime integration tests that validate the complete guest room lifecycle from create room through join, start, client.hello, and reconnect lease behavior. The primary test modules are packages/server-api/src/__tests__/rooms.lifecycle.int.test.ts and packages/server-realtime/src/__tests__/realtime.lifecycle.int.test.ts, using shared fixtures from packages/test-fixtures/src/roomLifecycleFixtures.ts if a shared fixture package exists or from the nearest server test fixture directory. The MVP needs automated boundary tests because room bootstrap, token authorization, and WebSocket attachment are the highest-risk reliability paths before closed beta. These tests should run without external services, real Azure resources, persistent databases, or real secrets. The suite must exercise actual HTTP route registration, actual room token signing with test-only secret placeholders, RoomManager state transitions, local ws connections, payload validation, and reconnect lease timing. Stakeholders will recognize this as operational evidence that valid room joins complete within the expected flow and that common user-facing failures are deterministic rather than discovered during beta sessions. When complete, CI can run a single test command and prove that a host can create a room, participants can join until capacity, the host can start with authorization, a WebSocket client can authenticate through client.hello, and a dropped player can reclaim the same slot within 60 seconds. The tests must include invalid nickname, nonexistent room, full room, participant start denial, invalid token hello, oversized WebSocket payload, and expired reconnect lease cases. This story does not implement new product behavior beyond test wiring and fixture coverage, and it does not add browser UI, load testing, Azure deployment, or telemetry dashboards. It depends on the room manager, REST endpoints, WebSocket hello handling, and reconnect lease capabilities being implemented.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:guest-room-lifecycle, area:testing, priority:P0, complexity:high |

**Acceptance Criteria**
- Unit tests written and passing: running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts packages/server-api/src/__tests__/roomTokens.test.ts packages/server-realtime/src/__tests__/messageValidation.test.ts succeeds as the prerequisite unit suite for lifecycle integration.
- System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.lifecycle.int.test.ts packages/server-realtime/src/__tests__/realtime.lifecycle.int.test.ts validates create room, join room, start match, client.hello, heartbeat, and reconnect lease flows.
- Mock data and fixtures generated and committed: packages/test-fixtures/src/roomLifecycleFixtures.ts or packages/server-api/src/__tests__/fixtures/roomLifecycleFixtures.ts exports deterministic nicknames, invalid room codes, fake token secret placeholder, fake clock schedule, and WebSocket message samples.
- The test file packages/server-api/src/__tests__/rooms.lifecycle.int.test.ts contains assertions for POST /api/v1/rooms returning HTTP 201, POST /api/v1/rooms/{code}/join returning HTTP 201, and POST /api/v1/rooms/{code}/start returning HTTP 200.
- The test file packages/server-api/src/__tests__/rooms.lifecycle.int.test.ts contains assertions for invalid nickname HTTP 400, nonexistent room HTTP 404, full room HTTP 409, and participant start HTTP 403.
- The test file packages/server-realtime/src/__tests__/realtime.lifecycle.int.test.ts contains assertions for client.hello receiving server.welcome, invalid token hello closing or returning server.error, and oversized payload rejection.
- The test file packages/server-realtime/src/__tests__/realtime.lifecycle.int.test.ts contains assertions that reconnect within 60 seconds returns the same playerId and reconnect after 61 seconds returns error.code RECONNECT_EXPIRED or the documented close behavior.

**Depends on:** WO-018, WO-019, WO-023, WO-020, WO-025

---

## Server-authoritative match simulation and competitive gameplay systems

### [P0] Run authoritative fixed-tick matches

Implement a server-authoritative MatchRunner so competitive movement, hazards, items, and rescue outcomes are driven by a deterministic 60 Hz server tick rather than by client-reported positions. The change belongs in the server-game MatchRunner module at packages/server-game/src/MatchRunner.ts, with protocol types consumed from packages/shared-protocol/src/messages.ts and integration through packages/server-realtime/src/GameSocketGateway.ts. Today the closed-beta architecture defines the contract, but the match loop still needs a concrete implementation that can accept validated inputs, advance rooms consistently, and broadcast authoritative snapshots at 20 Hz. This matters to stakeholders because the beta reliability goal depends on players seeing the same race state, avoiding finish-order disputes, and keeping desynchronization below the guardrail target. When complete, clients will send bounded client.input messages, the server will enqueue them by player and sequence number, advance the room simulation every 16.666 ms, and emit server.snapshot messages every 50 ms with tick, server time, players, hazards, items, and finish state placeholders. The implementation should include operational safeguards such as rate-limit counters, dropped-input telemetry hooks, and deterministic time injection so incidents can be reproduced from test fixtures. This story does not implement player movement physics, boss barrel behavior, rescue completion, item effects, or collision resolution beyond calling the extension points those systems will later fill. It depends on the room lifecycle, shared protocol schema, and WebSocket gateway capabilities being available so the runner can be created only for started rooms and can publish snapshots to connected players.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-game, area:realtime, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/matchRunner.test.ts exits with code 0 and includes assertions that MatchRunner.advanceTick increments tick at 60 Hz and MatchRunner.snapshotForRoom emits only every third tick for a 20 Hz snapshot cadence.
- System integration tests: running npm test -- --run packages/server-realtime/test/gameSocketGateway.matchRunner.int.test.ts exits with code 0 and verifies client.input messages sent through packages/server-realtime/src/GameSocketGateway.ts are validated, enqueued via MatchRunner.submitInput, and produce server.snapshot messages containing tick and players fields.
- Mock data and fixtures: packages/server-game/test/fixtures/matchRunnerRoom.fixture.ts is committed and exports a deterministic five-player room fixture with playerSlotId, color, and token claims used by packages/server-game/test/matchRunner.test.ts.
- File inspection of packages/server-game/src/MatchRunner.ts shows exported functions or methods named submitInput, advanceTick, snapshotForRoom, start, and stop, and none of those methods accept client-provided position coordinates as authoritative input.
- File inspection of packages/shared-protocol/src/messages.ts shows client.input and server.snapshot message types with bounded movement axis fields, sequence number, room code, player slot id, server tick, and authoritative entity arrays.
- Running npm test -- --run packages/server-game/test/inputQueue.test.ts exits with code 0 and verifies out-of-order duplicate sequence numbers are ignored by the validated input queue while newer sequence numbers remain available to MatchRunner.advanceTick.

**Depends on:** WO-014, WO-021, WO-020

### [P0] Simulate authoritative player movement

Implement authoritative PlayerState spawning, color slots, movement, half-height jump, ladder climbing, floor collision, and map boundary enforcement so every Jumpman Løkke character follows the same server-owned rules in multiplayer. The change belongs in the server-game PlayerState module at packages/server-game/src/PlayerState.ts, with level metadata read from packages/shared-level/src/levelMetadata.ts and tick integration in packages/server-game/src/MatchRunner.ts. The current architecture names these gameplay obligations, but players do not yet have a server-owned state machine that can spawn up to five distinct colored characters and constrain them to the vertical map. This matters because the core race only feels fair if players cannot cheat floor changes, bypass ladders, or move through the left wall while other clients see a different result. When complete, match start will create one PlayerState per occupied lobby slot, assign the lobby color to each snapshot, place all players at valid spawn points, and update position and velocity from input during each 60 Hz tick. Jump height must be capped at half the floor-to-floor height so players cannot jump from one platform to the next, while ladder climbing must only work when the player capsule intersects a ladder volume. Floor collision should snap grounded players to platforms, left boundary enforcement should prevent movement through the starting-side wall, and right boundary logic should leave fall detection to the separate fall-penalty story. This story does not implement barrel hits, player shoves, item effects, rescue completion, client rendering, or visual character art. It depends on the fixed-tick MatchRunner, room roster and color assignment, and shared one-map level geometry being available.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-game, area:movement, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/playerState.movement.test.ts exits with code 0 and asserts PlayerState.applyInput cannot move x below levelMetadata.bounds.leftWallX.
- Unit tests: packages/server-game/test/playerState.jump.test.ts includes an assertion named halfHeightJumpDoesNotReachNextFloor that verifies PlayerState.applyInput plus MatchRunner.advanceTick never raises y to the next floor height from a standing jump.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.playerSpawn.int.test.ts exits with code 0 and verifies MatchRunner.start creates exactly one PlayerState per occupied lobby slot with the expected color in the server.snapshot players array.
- Mock data and fixtures: packages/shared-level/test/fixtures/verticalMap.fixture.ts is committed and defines at least three floors, two ladders, five spawn points, a leftWallX value, and a rightFallX value used by the player movement tests.
- File inspection of packages/server-game/src/PlayerState.ts shows exported functions or methods named spawnPlayersForRoom, applyInput, resolveFloorCollision, resolveLadderContact, and toSnapshot.
- Running npm test -- --run packages/server-game/test/playerState.ladder.test.ts exits with code 0 and verifies climbY input changes floor only while the player capsule intersects a ladder volume from packages/shared-level/src/levelMetadata.ts.

**Depends on:** WO-008, WO-014, WO-012, WO-028

### [P0] Spawn boss barrel hazards

Implement server-side BossAI that positions the computer-controlled boss on the far-right platform and spawns authoritative barrel hazards on deterministic trajectories. The change belongs in the server-boss BossAI module at packages/server-boss/src/BossAI.ts, with hazard definitions shared through packages/shared-protocol/src/messages.ts and tick integration in packages/server-game/src/MatchRunner.ts. The current match loop can advance authoritative time, but it does not yet own boss placement, barrel spawn cadence, or hazard trajectory state. This matters because the Donkey Trump boss and barrels are a core slapstick pressure system that makes the vertical race readable, competitive, and measurable in beta telemetry. When complete, match start will create one boss state at the far-right boss platform coordinate from level metadata, and MatchRunner.advanceTick will call BossAI to emit barrel hazard entities at configured tick intervals. Each barrel should have an id, spawn tick, position, velocity, radius, active flag, and deterministic path progression that can later be consumed by collision resolution and client rendering. The spawn schedule must be deterministic for tests and operational replay, with an injectable random source reserved only if game design later requires variance. This story does not implement barrel-to-player hit effects, knockdown, star flags, client art, audio, or boss animation. It depends on fixed-tick match execution and shared level geometry that identifies the far-right boss platform and barrel lanes.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-boss, area:hazards, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-boss/test/bossAI.test.ts exits with code 0 and verifies BossAI.createInitialState places boss.position.x equal to levelMetadata.bossPlatform.farRightX.
- Unit tests: packages/server-boss/test/bossAI.test.ts includes an assertion named spawnsBarrelAtConfiguredTickInterval that verifies BossAI.advanceTick creates barrel hazards at the configured spawn interval and not on intermediate ticks.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.bossHazards.int.test.ts exits with code 0 and verifies MatchRunner.snapshotForRoom includes hazards with id, type "barrel", position, velocity, radius, and active fields after BossAI spawn ticks.
- Mock data and fixtures: packages/server-boss/test/fixtures/bossLevel.fixture.ts is committed and includes bossPlatform, barrelSpawnPoint, and barrelLane metadata used by BossAI tests.
- File inspection of packages/server-boss/src/BossAI.ts shows exported functions or methods named createInitialState, advanceTick, spawnBarrel, and toHazardSnapshots.
- N/A — REST API tests are not applicable because BossAI state is created through match simulation and exposed through WebSocket snapshots rather than HTTP endpoints.

**Depends on:** WO-008, WO-028

### [P0] Confirm rescue finish order

Implement server-confirmed Motzfeldt rescue-zone completion and finish ordering so the winner and subsequent placements are determined by authoritative tick time rather than by client claims. The change belongs in the server-game RescueObjective module at packages/server-game/src/RescueObjective.ts, with level objective metadata in packages/shared-level/src/levelMetadata.ts and snapshot exposure through packages/server-game/src/MatchRunner.ts. The current server movement layer can place players on the map, but it does not yet detect the top rescue zone or maintain a deterministic finish order in snapshots. This matters because the product’s primary objective is to race to rescue Motzfeldt, and beta testers need unambiguous match outcomes when multiple players arrive close together. When complete, any non-penalized player whose authoritative capsule intersects the rescue zone will be recorded once with player slot id, finish rank, tick, and server time. Snapshot payloads will include finishOrder sorted by first confirmed tick and a match phase or completed flag once the configured completion condition is reached. The behavior must handle same-tick arrivals deterministically using stable player slot ordering so support and replay investigations can reproduce a disputed finish. This story does not implement the visual Motzfeldt model, result screen UI, match telemetry export batching, or player movement rules outside the objective zone check. It depends on server-owned PlayerState movement and shared level metadata that defines the top rescue zone.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-game, area:objective, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/rescueObjective.test.ts exits with code 0 and verifies RescueObjective.checkCompletion records a player only when PlayerState capsule intersects levelMetadata.objectives.rescueZone.
- Unit tests: packages/server-game/test/rescueObjective.test.ts includes an assertion named sameTickArrivalUsesStableSlotOrder that verifies two same-tick finishers are sorted by playerSlotId when finishTick is equal.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.rescue.int.test.ts exits with code 0 and verifies MatchRunner.snapshotForRoom includes finishOrder with rank, playerSlotId, finishTick, and serverTimeMs after a player enters the rescue zone.
- Mock data and fixtures: packages/server-game/test/fixtures/rescueRace.fixture.ts is committed and contains at least three players positioned below, inside, and above the rescue zone for deterministic tests.
- File inspection of packages/server-game/src/RescueObjective.ts shows exported methods named checkCompletion, getFinishOrder, and toSnapshotFinishOrder.
- N/A — external API endpoint tests are not applicable because rescue completion is exposed through the existing WebSocket server.snapshot contract, not a REST endpoint.

**Depends on:** WO-008, WO-038

### [P0] Resolve side-impact shoves

Implement server-authoritative side-impact player shove resolution so up to five Jumpman Løkke characters can physically push opponents during close competitive racing. The change belongs in the server-collision PlayerShoveSystem module at packages/server-collision/src/PlayerShoveSystem.ts, with PlayerState position updates in packages/server-game/src/PlayerState.ts and tick ordering through packages/server-game/src/MatchRunner.ts. The current movement implementation can update individual players, but it does not yet resolve player-to-player contact or distinguish side impacts from normal overlap correction. This matters because the Mario Kart-style competition promise includes visible shove outcomes that all players see consistently, and client-side-only collision would create fairness and desync incidents. When complete, MatchRunner.advanceTick will compare all active player pairs after movement, detect side impacts using relative positions and velocities, apply a bounded shove impulse or displacement to the impacted player, and prevent players from being pushed through floors, the left wall, or invalid ladder geometry. The system must support all ten unique pairs in a five-player room and produce deterministic ordering so repeated runs with the same inputs generate the same final positions. Shove effects should be visible in the next server.snapshot through changed position or velocity, but no separate visual effect is required in this story. This story does not implement barrel collisions, item effects, respawn penalties, or any client animation polish. It depends on server-owned PlayerState movement and collision bounds being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-collision, area:players, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-collision/test/playerShoveSystem.test.ts exits with code 0 and verifies PlayerShoveSystem.resolveSideImpacts changes the impacted player's x velocity or position when a moving player contacts from the side.
- Unit tests: packages/server-collision/test/playerShoveSystem.test.ts includes an assertion named resolvesTenPairsForFivePlayers that verifies exactly ten unique player pairs are evaluated for a five-player fixture.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.playerShove.int.test.ts exits with code 0 and verifies server.snapshot players contains the shoved player's changed position after MatchRunner.advanceTick.
- Mock data and fixtures: packages/server-collision/test/fixtures/fivePlayerShove.fixture.ts is committed and defines five players with positions for side impact, no contact, and boundary-constrained shove cases.
- File inspection of packages/server-collision/src/PlayerShoveSystem.ts shows exported functions or methods named resolveSideImpacts, detectSideImpact, applyShove, and resolvePostShoveBounds.
- N/A — REST API boundary tests are not applicable because shoves are match simulation behavior exposed through WebSocket snapshots, not HTTP endpoints.

**Depends on:** WO-038

### [P0] Respawn right-edge falls

Implement authoritative right-edge fall detection, safe respawn placement, and delay penalty state so players who fall off the starting-perspective right side return to the race with a comparable movement lock. The change belongs in the server-game FallRespawnSystem module at packages/server-game/src/FallRespawnSystem.ts, with boundary metadata in packages/shared-level/src/levelMetadata.ts and PlayerState status updates in packages/server-game/src/PlayerState.ts. The current movement layer can enforce the left wall and expose the right boundary, but it does not yet detect a completed fall, move the player to a safe respawn point, or apply a penalty delay. This matters because the level rules intentionally allow falling off the right edge, and the recovery must be fair, visible, and server-confirmed rather than dependent on client prediction. When complete, MatchRunner.advanceTick will detect players whose authoritative position crosses the right fall threshold or fall-kill volume, set a fallPenalty status, place them at a configured safe respawn point, and disable normal movement for the configured delay duration. The delay should reuse the same timing infrastructure as movement stun so snapshots can show movementDisabledUntilMs and a fallPenalty flag. Respawn placement must choose a safe point on a valid floor, avoid spawning outside map bounds, and behave deterministically for up to five players. This story does not implement barrel knockdown, visual respawn effects, UI countdowns, or item-based teleport behavior. It depends on authoritative PlayerState movement and shared level geometry with right fall edge and respawn points.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-game, area:respawn, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/fallRespawnSystem.test.ts exits with code 0 and verifies FallRespawnSystem.detectFall returns true when player.position.x exceeds levelMetadata.bounds.rightFallX.
- Unit tests: packages/server-game/test/fallRespawnSystem.test.ts includes an assertion named respawnPointIsInsidePlayableBounds that verifies applyRespawn places the player between leftWallX and rightFallX on a defined floor.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.fallRespawn.int.test.ts exits with code 0 and verifies server.snapshot shows fallPenalty true and movementDisabledUntilMs after a player crosses the right edge during MatchRunner.advanceTick.
- Mock data and fixtures: packages/server-game/test/fixtures/fallRespawn.fixture.ts is committed and includes falling, safe, boundary-equal, and multi-player occupied respawn scenarios.
- File inspection of packages/server-game/src/FallRespawnSystem.ts shows exported functions or methods named detectFall, chooseRespawnPoint, applyRespawn, and applyFallPenalty.
- N/A — external service integration tests are not applicable because fall respawn uses in-memory level metadata and is exposed through WebSocket snapshots.

**Depends on:** WO-008, WO-038

### [P1] Apply authoritative item effects

Implement server-authoritative item pickup awards and power-up effects so collected items can benefit the owning player or affect opponents consistently across multiplayer clients. The change belongs in the server-game ItemSystem module at packages/server-game/src/ItemSystem.ts, with item definitions in packages/shared-items/src/itemDefinitions.ts and snapshot contract updates in packages/shared-protocol/src/messages.ts. The current player simulation can move characters through the map, but it does not yet detect item pickup volumes, award inventory, validate item-use input, or apply self-benefit and opponent-affecting effects. This matters because Mario Kart-style comeback opportunities are a stated feature for the MVP, and the server must prevent clients from inventing items or applying effects to rivals. When complete, active item pickups will exist in server match state, the first eligible player intersecting a pickup volume will receive a server-selected item, and the pickup will be marked consumed or respawn-scheduled according to the item definition. At minimum, one self-benefit item such as a temporary speed boost and one opponent-affecting item such as a targeted slow or shove effect must be implemented through server-side state changes visible in snapshots. Item use must be driven by validated input, checked against the player inventory, and resolved with deterministic target selection or explicit server-validated target fields. This story does not implement client item UI, final game balancing, advanced item distribution algorithms, or visual pickup assets. It depends on shared item definitions and authoritative PlayerState movement with collision volumes.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P1 |
| Labels | epic:server-authoritative-gameplay, area:server-game, area:items, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/itemSystem.test.ts exits with code 0 and verifies ItemSystem.resolvePickups awards an item when PlayerState capsule intersects an active pickup volume from packages/shared-items/src/itemDefinitions.ts.
- Unit tests: packages/server-game/test/itemSystem.test.ts includes assertions that ItemSystem.useItem applies a self speedBoost status to the owning PlayerState and applies an opponent slow status to a different PlayerState.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.items.int.test.ts exits with code 0 and verifies a client.input useItem command consumed by MatchRunner changes the relevant PlayerSnapshot status fields in server.snapshot.
- Mock data and fixtures: packages/server-game/test/fixtures/itemEffects.fixture.ts is committed and includes pickup volumes, a leading player, a trailing player, speed boost inventory, opponent slow inventory, and consumed-pickup examples.
- File inspection of packages/server-game/src/ItemSystem.ts shows exported functions or methods named resolvePickups, awardItem, useItem, applySelfEffect, applyOpponentEffect, and toItemSnapshots.
- File inspection of packages/shared-items/src/itemDefinitions.ts shows at least two item definitions with ids speed_boost and opponent_slow, each with durationMs and effectType fields.

**Depends on:** WO-015, WO-038

### [P0] Apply barrel knockdown stun

Implement server-side barrel hit resolution so a player struck by an authoritative barrel enters knockdown state, exposes a star-effect flag, and cannot move normally for exactly 2000 ms. The change belongs in the server-collision BarrelCollisionSystem module at packages/server-collision/src/BarrelCollisionSystem.ts, with PlayerState updates in packages/server-game/src/PlayerState.ts and hazard input from packages/server-boss/src/BossAI.ts. The current server can own players and barrel hazards, but it does not yet resolve collisions or enforce the required two-second movement stun. This matters because barrel hits are one of the clearest fairness-sensitive moments in the match, and players must see the same knockdown outcome regardless of client latency or prediction. When complete, MatchRunner.advanceTick will test active barrel hazards against player capsules after movement and hazard advancement, mark hit players knockedDown with starEffect true, and set movementDisabledUntilMs to current server time plus exactly 2000 ms. While stunned, PlayerState.applyInput must ignore normal run, jump, and climb commands, while snapshots continue to show the player position and status flags for client feedback. At or after the 2000 ms deadline, the player should automatically return to normal controllable state without requiring a client recovery command. This story does not implement barrel spawning, star rendering, audio effects, or side-impact player shove behavior. It depends on server-owned PlayerState, deterministic barrel hazards, and the fixed tick runner that supplies authoritative server time.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:server-collision, area:hazards, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-collision/test/barrelCollisionSystem.test.ts exits with code 0 and verifies BarrelCollisionSystem.resolveHits sets player.status.knockedDown to true and player.status.starEffect to true on capsule-to-barrel intersection.
- Unit tests: packages/server-collision/test/barrelCollisionSystem.test.ts includes an assertion named stunDurationIsExactly2000Ms that verifies movementDisabledUntilMs equals hitServerTimeMs + 2000.
- System integration tests: running npm test -- --run packages/server-game/test/matchRunner.barrelStun.int.test.ts exits with code 0 and verifies MatchRunner ignores movement input for a hit player until the first tick at or after movementDisabledUntilMs.
- Mock data and fixtures: packages/server-collision/test/fixtures/barrelHit.fixture.ts is committed and defines one colliding barrel, one non-colliding barrel, one vulnerable player, and one already-stunned player.
- File inspection of packages/server-collision/src/BarrelCollisionSystem.ts shows exported functions or methods named resolveHits, intersectsBarrel, and applyKnockdownStun.
- File inspection of packages/shared-protocol/src/messages.ts shows PlayerSnapshot status supports knockedDown, starEffect, and movementDisabledUntilMs fields for client reconciliation.

**Depends on:** WO-014, WO-038, WO-039

### [P0] Cover deterministic match systems

Add deterministic server-side match tests for rescue ordering, barrel stun, side shove, fall respawn, and item effects so the closed-beta gameplay loop has automated regression coverage before multiplayer hardening. The change belongs in the server-game deterministic test suite at packages/server-game/test/deterministicMatchScenarios.test.ts, with supporting fixtures under packages/server-game/test/fixtures/deterministicMatchScenarios.fixture.ts and system-specific imports from server-game, server-collision, and server-boss modules. The current gameplay systems are implemented across separate modules, but there is not yet a single scenario suite proving they compose correctly in the fixed-tick MatchRunner pipeline. This matters operationally because desync, disputed finish order, and penalty timing failures are expensive to debug once beta testers are connected through WebSockets. When complete, developers can run one targeted command that advances deterministic matches through rescue, barrel hit, shove, fall, and item scenarios without external services, sockets, rendering, Azure Blob Storage, or wall-clock timers. The suite should assert exact tick numbers, server times, state flags, movement lock deadlines, and snapshot fields using committed fixtures. These tests should also act as runbook-grade reproducibility examples for support incidents where a match outcome is challenged. This story does not add new gameplay behavior beyond test-only fixtures, assertions, and any small test harness utilities required to drive existing public module APIs. It depends on the rescue, barrel, shove, fall respawn, and item systems being implemented and exposed through MatchRunner snapshots.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:server-authoritative-gameplay, area:tests, area:reliability, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- --run packages/server-game/test/deterministicMatchScenarios.test.ts exits with code 0 and includes assertions for rescue finish ordering, barrel stun duration, side shove displacement, fall respawn penalty, and item effect application.
- System integration tests: packages/server-game/test/deterministicMatchScenarios.test.ts drives packages/server-game/src/MatchRunner.ts through public start, submitInput, advanceTick, and snapshotForRoom methods rather than calling private internals directly.
- Mock data and fixtures: packages/server-game/test/fixtures/deterministicMatchScenarios.fixture.ts is committed and exports deterministic room roster, level metadata references, barrel hazard setup, shove setup, fall setup, rescue setup, and item setup data.
- The rescue scenario in packages/server-game/test/deterministicMatchScenarios.test.ts asserts that same-tick rescue finishers appear in server.snapshot finishOrder sorted by the documented stable slot order.
- The barrel stun scenario in packages/server-game/test/deterministicMatchScenarios.test.ts asserts movementDisabledUntilMs - hitServerTimeMs equals 2000 and that movement input before the deadline does not change the player x position.
- The fall respawn scenario in packages/server-game/test/deterministicMatchScenarios.test.ts asserts the respawned PlayerSnapshot position is within levelMetadata bounds and status.fallPenalty is true until the configured movement-disabled deadline.

**Depends on:** WO-044, WO-048, WO-045, WO-046, WO-047

---

## React guest entry, lobby, results, and recovery screens

### [P0] Build guest room entry screen

Implement the React landing and guest room entry screen so players can immediately create or join a Donkey Trump Race room without accounts, reducing onboarding friction for closed-beta party sessions. The work belongs in the LandingRoomEntry module at client-web/src/screens/LandingRoomEntry.tsx, with supporting form components under client-web/src/components/room-entry/. Today the indexed project has no client-web implementation available, so this story establishes the visible entry point for the browser client while integrating with the already-defined room bootstrap capability. The completed screen displays the exact title “Donkey Trump Race”, a host create-room form, a join-room form with room code and nickname fields, and supported-browser guidance for WebGL-capable modern browsers. Nicknames must render Unicode correctly, including names such as “Jumpman Løkke”, without lossy normalization or replacement characters. Submitting the create form calls the room creation bootstrap endpoint and routes the host into the lobby with the returned room code, player color, and short-lived room token. Submitting the join form calls the room join endpoint and routes the player into the lobby when the server accepts the code and nickname. This story does not include lobby roster rendering, structured recovery copy for all server-side error types, help/privacy modal content, gameplay rendering, or WebSocket match simulation. It depends on the shared room and player protocol contracts, the server REST bootstrap endpoints for room creation and joining, and the client routing shell needed to navigate from entry to lobby.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:react-ui, area:client-web, area:lobby-bootstrap, priority:P0, complexity:medium |

**Acceptance Criteria**
- Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes an assertion in client-web/src/screens/__tests__/LandingRoomEntry.test.tsx that getByRole("heading", { name: "Donkey Trump Race" }) is present in client-web/src/screens/LandingRoomEntry.tsx.
- Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes assertions that client-web/src/screens/LandingRoomEntry.tsx renders form controls with accessible names "Nickname", "Room code", "Create room", and "Join room".
- Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes an assertion that the nickname fixture value "Jumpman Løkke" from client-web/src/test/fixtures/roomEntryFixtures.ts is displayed unchanged after typing into the nickname input.
- Running npm test --workspace client-web -- roomEntryClient.test.ts verifies client-web/src/api/roomEntryClient.ts sends POST /api/v1/rooms with a JSON body containing nickname and sends POST /api/v1/rooms/{code}/join with nickname for the join flow.
- Running npm run test:integration --workspace client-web -- room-entry-flow.spec.ts validates that mocked POST /api/v1/rooms and POST /api/v1/rooms/A7K2Q/join responses route the browser from client-web/src/screens/LandingRoomEntry.tsx to /rooms/A7K2Q/lobby.
- Mock data is committed in client-web/src/test/fixtures/roomEntryFixtures.ts with at least one create-room success payload, one join-room success payload, and one Unicode nickname value used by client-web/src/screens/__tests__/LandingRoomEntry.test.tsx.
- Unit tests are written and passing for client-web/src/screens/LandingRoomEntry.tsx and client-web/src/api/roomEntryClient.ts using npm test --workspace client-web -- LandingRoomEntry.test.tsx roomEntryClient.test.ts.
- System integration tests are written and passing for the service boundary by intercepting POST /api/v1/rooms and POST /api/v1/rooms/{code}/join in client-web/src/integration/room-entry-flow.spec.ts.
- File inspection of client-web/src/screens/LandingRoomEntry.tsx shows no password, email, account registration, social login, or MFA fields are rendered for the guest-only entry flow.

**Depends on:** WO-006, WO-018, WO-019

### [P0] Build multiplayer lobby screen

Implement the React multiplayer lobby screen so hosts and invited players can see who joined, understand room capacity, mark readiness, and start a match only when the server-authorized lobby state allows it. The work belongs in the MultiplayerLobby module at client-web/src/screens/MultiplayerLobby.tsx, with roster components under client-web/src/components/lobby/. Today there is no indexed client-web lobby implementation, so players would have no operational view of room code, assigned colors, readiness, capacity, or reconnect status after the entry flow succeeds. The completed screen displays the room code prominently for sharing, shows up to 5 player slots, renders each player with both a color label and a non-color identifier, and reflects ready or not-ready state from the authoritative lobby state. The host sees a start button that is disabled until the server-reported lobby state says the match can start, while non-host players see a clear waiting-for-host status. The screen also includes a reconnect hint explaining the short reconnect grace behavior without implying persistent accounts or profiles. Lobby updates must be driven by the completed realtime lobby state capability rather than local assumptions, because player slots and readiness are competitive session state. This story does not include the landing forms, structured error recovery screens, gameplay rendering, match result summaries, or accessibility-wide remediation beyond labels needed for this screen. It depends on room bootstrap state from the entry screen, shared lobby/player contracts, realtime lobby roster updates, ready-state commands, and the host start-match endpoint.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:react-ui, area:client-web, area:lobby, area:websocket, priority:P0, complexity:medium |

**Acceptance Criteria**
- Running npm test --workspace client-web -- MultiplayerLobby.test.tsx includes an assertion that client-web/src/screens/MultiplayerLobby.tsx renders the room code fixture "A7K2Q" from client-web/src/test/fixtures/lobbyFixtures.ts in an element with accessible name "Room code".
- Running npm test --workspace client-web -- LobbyRoster.test.tsx verifies client-web/src/components/lobby/LobbyRoster.tsx renders exactly 5 slot rows when lobbyFixtures.maxCapacity is 5, including occupied and empty slot states.
- Running npm test --workspace client-web -- LobbyRoster.test.tsx includes assertions that each occupied player row renders both player.colorLabel and player.slotLabel from client-web/src/test/fixtures/lobbyFixtures.ts rather than relying only on CSS color.
- Running npm test --workspace client-web -- MultiplayerLobby.test.tsx verifies the host start button in client-web/src/screens/MultiplayerLobby.tsx has disabled=true when canStartMatch is false and disabled=false when canStartMatch is true.
- Running npm run test:integration --workspace client-web -- lobby-realtime.spec.ts validates that a mocked server.lobbyState WebSocket message updates ready state text in client-web/src/screens/MultiplayerLobby.tsx without reloading the page.
- Running npm run test:integration --workspace client-web -- lobby-start.spec.ts validates that clicking the host start button sends POST /api/v1/rooms/A7K2Q/start with Authorization: Bearer <room-token> and handles a 202 response by navigating to the match route.
- Mock data is committed in client-web/src/test/fixtures/lobbyFixtures.ts with host, participant, empty slot, full room, disconnected, and reconnect-grace lobby states.
- Unit tests are written and passing for client-web/src/screens/MultiplayerLobby.tsx, client-web/src/components/lobby/LobbyRoster.tsx, and client-web/src/components/lobby/HostStartButton.tsx using npm test --workspace client-web -- MultiplayerLobby.test.tsx LobbyRoster.test.tsx HostStartButton.test.tsx.
- System integration tests are written and passing for WebSocket lobby-state updates and POST /api/v1/rooms/{code}/start in client-web/src/integration/lobby-realtime.spec.ts and client-web/src/integration/lobby-start.spec.ts.

**Depends on:** WO-023, WO-020, WO-024

### [P0] Implement entry error recovery

Implement structured React error recovery for invalid nickname, invalid room code, expired room, full room, and in-progress room responses so players receive actionable next steps instead of opaque failures during the room entry path. The work belongs in the RoomEntryRecovery module at client-web/src/components/recovery/RoomEntryRecovery.tsx and the room bootstrap API adapter at client-web/src/api/roomEntryClient.ts. Today the indexed client-web package has no structured recovery implementation, so expected user-facing REST failures would either be unhandled or reduced to generic transport errors. The completed behavior maps server error codes and HTTP statuses to safe messages, field focus targets, and recovery actions such as editing the nickname, retyping the room code, creating a new room, or returning to entry. Invalid nickname responses must keep the nickname value editable and focus the nickname field, while invalid room code responses must focus the room code field. Expired, full, and in-progress room responses must not add the user to hidden state and must present recovery actions that preserve the guest-only model. Error copy must not expose stack traces, internal room identifiers, token contents, or infrastructure details. This story does not implement the create/join forms themselves, lobby roster UI, modal help/privacy content, or server-side validation logic. It depends on the shared structured error catalog, REST bootstrap endpoints returning consistent error envelopes, and the landing entry screen hosting the recovery component.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:react-ui, area:client-web, area:error-recovery, area:security, priority:P0, complexity:medium |

**Acceptance Criteria**
- Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps HTTP 400 with error.code "INVALID_NICKNAME" to focusTarget "nickname" and action "edit-nickname".
- Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps HTTP 404 with error.code "INVALID_ROOM_CODE" to focusTarget "roomCode" and action "retry-room-code".
- Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps error.code "ROOM_EXPIRED", "ROOM_FULL", and "ROOM_IN_PROGRESS" to recovery actions "create-new-room", "retry-later", and "return-to-entry" respectively.
- Running npm test --workspace client-web -- RoomEntryRecovery.test.tsx verifies client-web/src/components/recovery/RoomEntryRecovery.tsx renders no stack trace text when the fixture error payload in client-web/src/test/fixtures/roomEntryErrorFixtures.ts contains a debug.stack property.
- Running npm run test:integration --workspace client-web -- room-entry-errors.spec.ts validates that mocked POST /api/v1/rooms/A7K2Q/join responses with status codes 400, 404, 409, and 410 render the expected recovery component state in client-web/src/screens/LandingRoomEntry.tsx.
- Mock data is committed in client-web/src/test/fixtures/roomEntryErrorFixtures.ts with structured error envelopes for invalid nickname, invalid room code, expired room, full room, in-progress room, and generic network failure.
- Unit tests are written and passing for client-web/src/errors/roomEntryErrorMapper.ts and client-web/src/components/recovery/RoomEntryRecovery.tsx using npm test --workspace client-web -- roomEntryErrorMapper.test.ts RoomEntryRecovery.test.tsx.
- System integration tests are written and passing for the REST error boundary in client-web/src/integration/room-entry-errors.spec.ts using POST /api/v1/rooms and POST /api/v1/rooms/{code}/join mocks.
- File inspection of client-web/src/errors/roomEntryErrorMapper.ts shows a default branch for unknown error.code values that returns a generic safe message and does not interpolate server debug fields.

**Depends on:** WO-007, WO-019, WO-024

### [P1] Add help and privacy modal

Implement the HelpPrivacyModal so players can quickly understand keyboard controls, guest-only sessions, telemetry disclosure, and the privacy notice before joining or hosting beta matches. The work belongs in the HelpPrivacyModal module at client-web/src/components/help/HelpPrivacyModal.tsx and is launched from client-web/src/screens/LandingRoomEntry.tsx. Today the indexed client-web package has no help or privacy disclosure UI, creating a compliance and onboarding gap for the GDPR-minimal closed beta. The completed modal describes the supported keyboard controls for lobby and menu use, explains that guest sessions use only nickname and room code, and states that non-sensitive telemetry is collected for room creation, join failures, match starts and ends, disconnects, and match-breaking errors. The modal includes a visible privacy notice link that points to the configured privacy route or static document path without embedding legal copy that belongs outside this component. It must be dismissible by button, Escape key, and backdrop behavior only when focus handling remains deterministic. The disclosure must avoid claims about accounts, advertising, payments, or persistent profiles because those are outside MVP scope. This story does not implement full privacy-rights workflows, blob retention automation, legal approval, or accessibility remediation across every screen. It depends on the landing screen being available and on the agreed guest-only session and telemetry policy from the product and architecture artifacts.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P1 |
| Labels | epic:react-ui, area:client-web, area:privacy, area:onboarding, priority:P1, complexity:medium |

**Acceptance Criteria**
- Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies client-web/src/components/help/HelpPrivacyModal.tsx renders text containing "keyboard", "guest", "nickname", "room code", and "telemetry".
- Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies the privacy notice link in client-web/src/components/help/HelpPrivacyModal.tsx has href="/privacy" and accessible name "Privacy notice".
- Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies pressing Escape calls onClose exactly once for the open modal in client-web/src/components/help/HelpPrivacyModal.tsx.
- Running npm test --workspace client-web -- LandingRoomEntry.test.tsx verifies client-web/src/screens/LandingRoomEntry.tsx renders a "Help and privacy" button that opens HelpPrivacyModal.
- Running npm run test:integration --workspace client-web -- help-privacy-modal.spec.ts validates that keyboard navigation can open the modal from client-web/src/screens/LandingRoomEntry.tsx, activate the /privacy link, and close the modal without submitting POST /api/v1/rooms.
- Mock data is committed in client-web/src/test/fixtures/helpPrivacyFixtures.ts with modal copy segments and a privacyLink fixture used by client-web/src/components/help/__tests__/HelpPrivacyModal.test.tsx.
- Unit tests are written and passing for client-web/src/components/help/HelpPrivacyModal.tsx using npm test --workspace client-web -- HelpPrivacyModal.test.tsx.
- System integration tests are written and passing for the landing-to-modal interaction in client-web/src/integration/help-privacy-modal.spec.ts; no external privacy service is required because /privacy is a static client route fixture.
- File inspection of client-web/src/components/help/HelpPrivacyModal.tsx shows no account registration, advertising tracker, payment, or persistent profile claims in the modal copy.

**Depends on:** WO-024

### [P0] Build match results screen

Implement the React match results screen so players see the server-confirmed rescue order, race highlights, and safe replay or return-to-lobby actions after a match ends. The work belongs in the MatchResults module at client-web/src/screens/MatchResults.tsx, with summary components under client-web/src/components/results/. Today the indexed client-web package has no result screen, so authoritative rescue outcomes from the match runner would have no visible post-match destination. The completed screen renders the ordered rescue finish list exactly as provided by the server result payload rather than sorting locally by client timestamps. It also displays race highlights such as barrel hits, falls, item uses, fastest rescue, and disconnects when those fields are present in the result payload. A replay action requests a new match through the server-approved replay route or endpoint, while a return-to-lobby action navigates back to the room lobby when the room remains available. The screen must show a safe unavailable state if replay or return-to-lobby is not permitted by the server, because in-memory rooms can expire after match end. This story does not implement gameplay simulation, rescue detection, result generation on the server, structured room-entry errors, or accessibility-wide audit fixes. It depends on the server-confirmed match result contract, completed room/match endpoint capability, and client routing from the gameplay shell to the results route.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:react-ui, area:client-web, area:results, area:match-flow, priority:P0, complexity:medium |

**Acceptance Criteria**
- Running npm test --workspace client-web -- MatchResults.test.tsx verifies client-web/src/screens/MatchResults.tsx renders rescueOrder from client-web/src/test/fixtures/matchResultsFixtures.ts in the same order as the fixture array.
- Running npm test --workspace client-web -- RaceHighlights.test.tsx verifies client-web/src/components/results/RaceHighlights.tsx renders fixture highlight counts for barrelHits, falls, itemUses, and disconnects.
- Running npm test --workspace client-web -- MatchResults.test.tsx verifies the replay button in client-web/src/screens/MatchResults.tsx is disabled when resultActions.canReplay is false and enabled when resultActions.canReplay is true.
- Running npm test --workspace client-web -- MatchResults.test.tsx verifies the return-to-lobby button navigates to /rooms/A7K2Q/lobby when resultActions.canReturnToLobby is true in client-web/src/test/fixtures/matchResultsFixtures.ts.
- Running npm run test:integration --workspace client-web -- match-results-flow.spec.ts validates that a mocked server.matchEnded WebSocket message with matchId "match-001" routes the client to /rooms/A7K2Q/results/match-001 and renders client-web/src/screens/MatchResults.tsx.
- Running npm run test:integration --workspace client-web -- match-replay.spec.ts validates that clicking replay sends POST /api/v1/rooms/A7K2Q/replay with Authorization: Bearer <room-token> and handles a 202 response by navigating to the lobby or match route specified by the mocked response.
- Mock data is committed in client-web/src/test/fixtures/matchResultsFixtures.ts with at least one complete result payload, one no-highlights payload, one replay-disabled payload, and one expired-room action payload.
- Unit tests are written and passing for client-web/src/screens/MatchResults.tsx, client-web/src/components/results/RescueOrderList.tsx, and client-web/src/components/results/RaceHighlights.tsx using npm test --workspace client-web -- MatchResults.test.tsx RescueOrderList.test.tsx RaceHighlights.test.tsx.
- System integration tests are written and passing for server.matchEnded navigation and POST /api/v1/rooms/{code}/replay in client-web/src/integration/match-results-flow.spec.ts and client-web/src/integration/match-replay.spec.ts.

**Depends on:** WO-006, WO-044

### [P0] Harden UI accessibility coverage

Add WCAG 2.1 AA keyboard focus, screen reader labels, contrast tokens, and non-color-only player identifiers across landing, lobby, errors, help, and results so the closed-beta core flow is operable without a mouse and understandable beyond color alone. The work belongs in the client-web accessibility layer at client-web/src/styles/accessibilityTokens.css and client-web/src/accessibility/, with screen-level updates in LandingRoomEntry, MultiplayerLobby, RoomEntryRecovery, HelpPrivacyModal, and MatchResults. Today those client-web modules have no indexed accessibility hardening implementation, and prior feature stories may introduce usable screens that still need cross-flow verification for keyboard order, status announcements, focus restoration, and contrast tokens. The completed behavior provides visible focus outlines, predictable tab order, screen reader names for forms and status regions, aria-live announcements for lobby and error changes, and player identifiers that combine color labels with slot names or icons. The color palette must expose contrast-safe tokens used by the relevant components instead of hard-coded low-contrast values. Keyboard-only users must be able to open help, create or join a room, recover from entry errors, review lobby state, operate allowed start/replay actions, and return to lobby or entry. This story does not add new product features, change server contracts, implement gameplay controls, or perform manual legal/privacy approval. It depends on all landing, lobby, recovery, help/privacy, and results screens existing so accessibility can be validated end-to-end.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:react-ui, area:client-web, area:accessibility, area:wcag, priority:P0, complexity:high |

**Acceptance Criteria**
- Running npm test --workspace client-web -- accessibilityTokens.test.ts verifies client-web/src/styles/accessibilityTokens.css exports focus, surface, text, warning, success, and player identifier tokens referenced by client-web/src/accessibility/accessibilityTokens.ts.
- Running npm test --workspace client-web -- screenReaderLabels.test.tsx verifies client-web/src/screens/LandingRoomEntry.tsx, client-web/src/screens/MultiplayerLobby.tsx, client-web/src/components/recovery/RoomEntryRecovery.tsx, and client-web/src/screens/MatchResults.tsx expose named landmarks or regions for their primary content.
- Running npm test --workspace client-web -- nonColorPlayerIdentifiers.test.tsx verifies client-web/src/components/lobby/LobbyRoster.tsx and client-web/src/components/results/RescueOrderList.tsx render each player with a slot label such as "Player 1" in addition to any color label.
- Running npm test --workspace client-web -- focusManagement.test.tsx verifies client-web/src/components/help/HelpPrivacyModal.tsx restores focus to the "Help and privacy" button in client-web/src/screens/LandingRoomEntry.tsx after the modal closes.
- Running npm test --workspace client-web -- recoveryFocus.test.tsx verifies client-web/src/components/recovery/RoomEntryRecovery.tsx causes invalid nickname recovery to focus the nickname input and invalid room code recovery to focus the room code input in client-web/src/screens/LandingRoomEntry.tsx.
- Running npm run test:a11y --workspace client-web -- core-flow.a11y.spec.ts reports zero axe violations for /, /rooms/A7K2Q/lobby, /rooms/A7K2Q/results/match-001, and the recovery fixture state rendered from client-web/src/test/fixtures/roomEntryErrorFixtures.ts.
- Running npm run test:keyboard --workspace client-web -- core-keyboard-flow.spec.ts validates keyboard-only navigation can reach Create room, Join room, Help and privacy, Ready, Start match when enabled, Replay when enabled, and Return to lobby controls without pointer events.
- Mock data is committed or reused in client-web/src/test/fixtures/accessibilityFixtures.ts to render landing, lobby, recovery, help modal, and results states without live REST or WebSocket services.
- Unit tests are written and passing for accessibility token usage, labels, focus management, and non-color identifiers using npm test --workspace client-web -- accessibilityTokens.test.ts screenReaderLabels.test.tsx focusManagement.test.tsx nonColorPlayerIdentifiers.test.tsx.
- System integration tests are written and passing for automated accessibility and keyboard-only flows in client-web/src/integration/core-flow.a11y.spec.ts and client-web/src/integration/core-keyboard-flow.spec.ts.

**Depends on:** WO-024, WO-031, WO-032, WO-033, WO-056

---

## Three.js rendering, in-match HUD, and browser netcode

### [P0] Bootstrap MVP Three.js race scene

Implement the client-renderer ThreeScene bootstrap so closed-beta players immediately see the Donkey Trump Race title, the one-map vertical arena, and the rescue objective needed to understand the match goal. The work belongs in the ThreeScene module at packages/client-renderer/src/ThreeScene.ts, backed by MVP level metadata in packages/shared-level/src/mvpLevel.ts and renderer tests in packages/client-renderer/src/__tests__/ThreeScene.test.ts. Today there is no indexed implementation for the browser 3D scene, so a player cannot visually confirm the floors, ladders, left wall, right fall edge, or Motzfeldt rescue point described by the product scope. This story gives stakeholders the first observable browser proof that the game is a modern 3D web experience rather than only a lobby or protocol shell. When complete, loading the renderer in a test harness creates a Three.js scene with multiple vertical floors, ladder volumes, a left-side wall boundary, an open right-side fall edge marker, a top rescue point, basic lighting, and a 3D text or mesh title reading Donkey Trump Race. The scene should expose deterministic object names or userData tags so future effects, camera logic, and netcode-fed entity rendering can attach without scraping arbitrary mesh order. This story does not include playable character meshes, camera follow behavior, WebSocket networking, barrel hazards, items, or HUD overlays. It depends on shared level geometry definitions and browser build scaffolding being available, and it should keep placeholder geometry simple enough to preserve WebGL startup reliability on supported beta browsers.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:threejs-rendering, area:client-renderer, complexity:medium, operability:webgl-smoke |

**Acceptance Criteria**
- File inspection shows packages/client-renderer/src/ThreeScene.ts exports createThreeScene and the returned scene contains object names mvp.floor.*, mvp.ladder.*, mvp.leftWall, mvp.rightFallEdge, mvp.rescuePoint, and mvp.title.
- Running npm run test --workspace @dtr/client-renderer -- ThreeScene.test.ts exits with code 0 and includes assertions that packages/client-renderer/src/__tests__/ThreeScene.test.ts finds at least three floor meshes and at least two ladder meshes.
- Running npm run test --workspace @dtr/shared-level -- mvpLevel.test.ts exits with code 0 and packages/shared-level/src/__tests__/mvpLevel.test.ts asserts the left wall x boundary is less than the start position and the right fall edge x boundary is greater than the start position.
- System integration test: running npm run test:integration -- renderer-scene-smoke exits with code 0 and packages/client-renderer/test/sceneSmoke.test.ts mounts createThreeScene with a WebGL-capable test renderer without throwing.
- Mock data / fixtures: packages/shared-level/fixtures/mvpLevel.fixture.json is committed and npm run test --workspace @dtr/shared-level -- mvpLevelFixture.test.ts verifies it contains floors, ladders, leftWall, rightFallEdge, rescuePoint, and titleText fields.
- N/A — no database migration is applicable because the MVP scene uses committed TypeScript metadata and JSON fixtures rather than persistent storage.

**Depends on:** WO-008, WO-024

### [P0] Implement predictive WebSocket client

Implement the client-netcode WebSocket gameplay loop so the browser sends bounded inputs, predicts local movement, reconciles against authoritative snapshots, and exposes state for the renderer and HUD. The work belongs in packages/client-netcode/src/WebSocketGameClient.ts, packages/client-netcode/src/prediction.ts, and packages/client-netcode/src/reconciliation.ts, using message contracts from packages/shared-protocol/src/messages.ts. The current greenfield client has no real-time transport, which means players cannot enter an authoritative match loop or observe fairness-preserving server corrections. This story delivers the most reliability-sensitive browser capability because it connects local responsiveness with server-owned competitive truth. When complete, the client opens a raw WebSocket, sends client.hello once, emits client.input at the configured cadence with monotonically increasing sequence numbers, buffers unacknowledged local inputs, applies authoritative snapshot.playerStates, and reconciles the local player only when correction thresholds are exceeded. The implementation should surface latency, connection state, correction distance, and last snapshot age for operational HUD visibility without logging secrets or raw room tokens. Observable completion includes deterministic unit tests for prediction and reconciliation plus integration tests against a mock WebSocket server that sends snapshots and validates input envelopes. This story does not include remote player interpolation, 3D rendering, lobby REST bootstrap, server simulation, binary protocol optimization, or item effect visuals. It depends on shared protocol schemas, input controller output, and an authoritative WebSocket server contract.

| Field | Value |
|---|---|
| Story Points | 13 |
| Hours | 130h |
| Priority | P0 |
| Labels | epic:browser-netcode, area:client-netcode, complexity:high, reliability:critical, operability:latency-metrics |

**Acceptance Criteria**
- File inspection shows packages/client-netcode/src/WebSocketGameClient.ts exports WebSocketGameClient with connect, disconnect, sendInput, subscribeToSnapshots, and getConnectionMetrics methods.
- Running npm run test --workspace @dtr/client-netcode -- prediction.test.ts exits with code 0 and packages/client-netcode/src/__tests__/prediction.test.ts asserts local input replay produces deterministic position and velocity values for committed fixtures.
- Running npm run test --workspace @dtr/client-netcode -- reconciliation.test.ts exits with code 0 and asserts corrections below the configured threshold do not snap local state while corrections above the threshold update predicted state and record correctionDistance.
- System integration test: running npm run test:integration -- websocket-client-loop exits with code 0 and packages/client-netcode/test/websocketLoop.integration.test.ts verifies client.hello, client.input sequence numbers, server snapshot handling, and disconnect cleanup against a mock ws server.
- Mock data / fixtures: packages/shared-protocol/fixtures/snapshots.basicMatch.json and packages/client-netcode/fixtures/inputSequence.json are committed and used by prediction, reconciliation, and WebSocket integration tests.
- Running npm run test --workspace @dtr/shared-protocol -- messages.test.ts exits with code 0 and packages/shared-protocol/src/__tests__/messages.test.ts rejects malformed client.input payloads with a typed validation error.

**Depends on:** WO-014, WO-020, WO-028

### [P0] Render colored Jumpman placeholders

Implement Jumpman Løkke placeholder meshes so up to five multiplayer participants are visible side by side with distinct colors and readable labels. The work belongs in packages/client-renderer/src/JumpmanLokkeMesh.ts, with color-slot inputs from packages/shared-protocol/src/playerState.ts and a renderer harness in packages/client-renderer/src/__tests__/JumpmanLokkeMesh.test.ts. The current greenfield renderer has no character representation, so lobby color assignment and server player states cannot yet become visible in the 3D scene. This story creates the minimum spectator-readable identity layer needed for five-player closed-beta play before final art exists. When complete, the renderer can create five simple cartoon-like placeholder Jumpman meshes with different material colors, stable player labels, and non-color-only identifiers attached above or near each character. The meshes should accept transforms from predicted local state or authoritative remote snapshots without deciding gameplay physics. Observable completion means a test scene can mount five player meshes side by side and inspect that each has a unique slot color, label text, playerId metadata, and named root group. This story does not include polished caricature art, animation blending, skin customization, input handling, camera behavior, or lobby color assignment logic. It depends on the MVP scene bootstrap and shared player-state/color-slot contracts being present.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:threejs-rendering, area:client-renderer, area:accessibility, complexity:medium |

**Acceptance Criteria**
- File inspection shows packages/client-renderer/src/JumpmanLokkeMesh.ts exports createJumpmanLokkeMesh and updateJumpmanLokkeMesh, and each returned root group name begins with player.jumpman.
- Running npm run test --workspace @dtr/client-renderer -- JumpmanLokkeMesh.test.ts exits with code 0 and asserts five created meshes have five distinct material color values.
- Running npm run test --workspace @dtr/client-renderer -- JumpmanLokkeMesh.test.ts exits with code 0 and asserts each mesh includes a non-color label child named player.label with the provided displayName or slot label.
- System integration test: running npm run test:integration -- renderer-five-players exits with code 0 and packages/client-renderer/test/fivePlayerVisibility.test.ts mounts five player groups into packages/client-renderer/src/ThreeScene.ts without duplicate object names.
- Mock data / fixtures: packages/shared-protocol/fixtures/playerStates.fivePlayers.json is committed and packages/client-renderer/src/__tests__/JumpmanLokkeMesh.test.ts imports it to render five side-by-side placeholder players without external services.
- N/A — database fixtures are not applicable because player visibility tests use committed protocol JSON fixtures and no persistent store.

**Depends on:** WO-031, WO-034

### [P0] Interpolate remote player snapshots

Implement remote player interpolation so other players move smoothly from authoritative snapshot.playerStates while the local player remains prediction-driven. The work belongs in packages/client-netcode/src/interpolation.ts and should feed renderer update data for packages/client-renderer/src/JumpmanLokkeMesh.ts. The current netcode can ingest authoritative snapshots but does not yet provide a render-delay buffer for remote players, so remote motion would appear jittery under normal WebSocket timing variance. This story protects the closed-beta fairness and fun perception by making server-authoritative updates look continuous without handing authority to the browser. When complete, the client stores remote player states by server tick, renders them at a configurable delay behind the newest snapshot, interpolates position and rotation between bracketing snapshots, and handles missing samples with bounded hold or extrapolation rules. Developers should be able to run unit tests that provide sparse snapshot fixtures and assert exact interpolated transforms at requested render times. The implementation must expose interpolation buffer metrics such as sample count, render delay, and dropped stale snapshot count for operational debugging. This story does not include local prediction, WebSocket connection management, camera follow logic, character mesh creation, or server snapshot generation. It depends on authoritative snapshot handling and the shared player-state contract already being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:browser-netcode, area:client-netcode, area:client-renderer, complexity:medium, operability:jitter-metrics |

**Acceptance Criteria**
- File inspection shows packages/client-netcode/src/interpolation.ts exports createRemotePlayerInterpolator with addSnapshot, sampleRemotePlayers, pruneBeforeTick, and getInterpolationMetrics methods.
- Running npm run test --workspace @dtr/client-netcode -- interpolation.test.ts exits with code 0 and packages/client-netcode/src/__tests__/interpolation.test.ts asserts position interpolation between two snapshot.playerStates samples within numeric tolerances.
- Running npm run test --workspace @dtr/client-netcode -- interpolation.test.ts exits with code 0 and asserts localPlayerId is excluded from remote interpolation output.
- System integration test: running npm run test:integration -- remote-interpolation-renderer exits with code 0 and packages/client-netcode/test/remoteInterpolationRenderer.integration.test.ts feeds interpolated transforms into packages/client-renderer/src/JumpmanLokkeMesh.ts update calls.
- Mock data / fixtures: packages/shared-protocol/fixtures/snapshots.remotePlayers.json is committed and contains at least three server ticks with at least two remote player states used by interpolation tests.
- N/A — database fixtures are not applicable because remote interpolation uses committed snapshot JSON fixtures only.

**Depends on:** WO-038, WO-040

### [P0] Add third-person follow camera

Implement a MarioKartCamera follow system so the local player sees Jumpman Løkke from a responsive third-person perspective suited to racing upward through the vertical map. The work belongs in packages/client-renderer/src/MarioKartCamera.ts and should integrate with local player visual state from packages/client-renderer/src/JumpmanLokkeMesh.ts and scene bounds from packages/shared-level/src/mvpLevel.ts. The current renderer can show a static scene and player placeholders but has no camera controller that follows the predicted local character without inheriting remote snapshot jitter. This story is important because the product promise explicitly calls for Mario Kart-style gameplay feel rather than a flat side-on platformer view. When complete, the camera maintains a configurable chase offset behind and above the local player, looks ahead toward the movement direction, smooths sudden corrections, and clamps framing enough to keep ladders, floors, and fall-edge context visible. Developers should be able to run deterministic camera tests against a sequence of local transforms and verify exact camera position tolerances. This story does not include input capture, prediction math, remote interpolation, split-screen, cinematic cameras, or gamepad support. It depends on an MVP scene, visible local player mesh, and shared level bounds being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:threejs-rendering, area:client-renderer, complexity:medium, gamefeel:camera |

**Acceptance Criteria**
- File inspection shows packages/client-renderer/src/MarioKartCamera.ts exports createMarioKartCameraController with updateCameraFollow and resetCameraFollow methods.
- Running npm run test --workspace @dtr/client-renderer -- MarioKartCamera.test.ts exits with code 0 and asserts updateCameraFollow places the camera behind and above a local player transform within configured numeric tolerances.
- Running npm run test --workspace @dtr/client-renderer -- MarioKartCamera.test.ts exits with code 0 and asserts a large authoritative correction is smoothed over multiple updates rather than applying the full delta in one frame.
- System integration test: running npm run test:integration -- renderer-camera-follow exits with code 0 and packages/client-renderer/test/cameraFollowScene.test.ts mounts the controller with packages/client-renderer/src/ThreeScene.ts and a Jumpman mesh.
- Mock data / fixtures: packages/client-renderer/fixtures/localPlayerMotion.json is committed and used by packages/client-renderer/src/__tests__/MarioKartCamera.test.ts for repeatable follow-path assertions.
- N/A — database test data is not applicable because camera follow behavior uses local transform fixtures only.

**Depends on:** WO-034, WO-043

### [P1] Display item pickups and power HUD

Implement ItemPickupEffects and the client-web power-up HUD so players can see collectible items, their current self-benefit item, and opponent-affecting item states during a match. The work belongs in packages/client-renderer/src/ItemPickupEffects.ts for 3D pickups and packages/client-web/src/components/PowerUpHUD.tsx for the React overlay, using definitions from packages/shared-items/src/itemDefinitions.ts. The current client has no item presentation, so the comeback and competitive interaction system would be invisible even if the server already awards and applies item effects. This story gives beta players immediate feedback that an item was collected, what they are holding, and whether an active effect is helping them or affecting opponents. When complete, item pickup meshes appear at server-defined positions, collected pickups transition to a visible cooldown or hidden state, and the HUD displays current power-up name, type, target category, duration remaining, and a non-color icon or label. The renderer and HUD must treat the server snapshot as authoritative and must not decide award probability or item impact. Observable completion includes unit tests for item definition mapping, renderer pickup object updates, and React HUD rendering from committed fixtures. This story does not include item balance, server-side pickup collision, item-use input binding, projectile visuals, audio, or advanced Mario Kart-style item roulette. It depends on the shared item system and MVP scene being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:threejs-rendering, area:client-renderer, area:client-web, complexity:medium, priority:p1 |

**Acceptance Criteria**
- File inspection shows packages/client-renderer/src/ItemPickupEffects.ts exports createItemPickupEffects and updateItemPickupEffects, and packages/client-web/src/components/PowerUpHUD.tsx exports PowerUpHUD.
- Running npm run test --workspace @dtr/shared-items -- itemDefinitions.test.ts exits with code 0 and packages/shared-items/src/__tests__/itemDefinitions.test.ts asserts at least one self-benefit item and at least one opponent-affecting item are defined.
- Running npm run test --workspace @dtr/client-renderer -- ItemPickupEffects.test.ts exits with code 0 and asserts item pickup fixtures create named scene objects item.pickup.* with visible, collected, and cooldown states.
- Running npm run test --workspace @dtr/client-web -- PowerUpHUD.test.tsx exits with code 0 and asserts the current power-up name, target category, and duration remaining are rendered from packages/shared-items/fixtures/itemStates.basic.json.
- System integration test: running npm run test:integration -- item-effects-hud exits with code 0 and packages/client-web/test/itemHudIntegration.test.tsx renders PowerUpHUD from a mocked server.snapshot item state without a live WebSocket.
- Mock data / fixtures: packages/shared-items/fixtures/itemStates.basic.json is committed and includes one self-benefit state, one opponent-affecting state, and one collected pickup cooldown state.

**Depends on:** WO-047, WO-034

### [P0] Render boss barrel stun feedback

Implement BossBarrelStunEffects so players can see the computer-controlled boss, barrel hazards, knockdown poses, star effects, and fall respawn feedback in the MVP arena. The work belongs in packages/client-renderer/src/BossBarrelStunEffects.ts and should consume authoritative hazard and player status data from packages/shared-protocol/src/matchState.ts. The current renderer can show the map and players but has no visual feedback for the highest-risk slapstick mechanics that make the game understandable during beta. This story gives players and observers clear confirmation that barrel hits and right-edge falls have triggered server-confirmed penalties. When complete, the scene can render a placeholder boss group at the far-right platform location, barrel meshes from snapshot barrel states, a knocked-down pose or orientation change for stunned players, rotating star indicators during stun, and respawn feedback after fall penalties. The implementation should keep all effects driven by server-authoritative state fields rather than client guesses about collisions. Observable completion means committed fixtures can drive barrel positions, stun timers, and fall respawn states through the effect module and tests can inspect named scene objects. This story does not include boss AI, barrel physics, authoritative collision detection, audio effects, final character art, or HUD timer display. It depends on server-provided boss, barrel, stun, fall, and respawn state being present in snapshots and on the MVP scene being available.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:threejs-rendering, area:client-renderer, complexity:medium, gameplay-feedback:hazards |

**Acceptance Criteria**
- File inspection shows packages/client-renderer/src/BossBarrelStunEffects.ts exports createBossBarrelStunEffects and updateBossBarrelStunEffects functions.
- Running npm run test --workspace @dtr/client-renderer -- BossBarrelStunEffects.test.ts exits with code 0 and asserts the boss group named boss.trumpPlaceholder is positioned at the far-right platform anchor from packages/shared-level/src/mvpLevel.ts.
- Running npm run test --workspace @dtr/client-renderer -- BossBarrelStunEffects.test.ts exits with code 0 and asserts stunned player fixture states create star effect objects named effect.stars.* and set a knockdown visual state on the matching player group.
- System integration test: running npm run test:integration -- renderer-hazard-effects exits with code 0 and packages/client-renderer/test/hazardEffectsScene.integration.test.ts applies barrel, stun, and fall respawn fixtures to packages/client-renderer/src/ThreeScene.ts.
- Mock data / fixtures: packages/shared-protocol/fixtures/hazardSnapshot.stunAndFall.json is committed and includes bossState, barrelStates, playerStates with stunnedUntilMs, and fallRespawn state used by renderer tests.
- N/A — database fixtures are not applicable because barrel, stun, and fall feedback tests use committed snapshot fixtures.

**Depends on:** WO-039, WO-048, WO-046, WO-034

### [P0] Build accessible in-match RaceHUD

Implement the client-web RaceHUD overlay so players can monitor latency, rescue progress, current power-up, barrel or fall penalty timers, shove feedback, and keyboard control hints during a live match. The work belongs in packages/client-web/src/components/RaceHUD.tsx and should consume netcode metrics from packages/client-netcode/src/WebSocketGameClient.ts plus match state from packages/shared-protocol/src/matchState.ts. The current client has no in-match HUD, so players would not understand network health, penalty duration, objective progress, active power-up status, or control affordances during closed beta. This story makes the match operable for players and supportable for SRE-style beta observation because it exposes latency and correction indicators without requiring console access. When complete, the HUD renders accessible regions for connection status, ping in milliseconds, snapshot age, rescue progress percentage or step text, current power-up summary, remaining stun or fall penalty time, recent shove feedback, and keyboard hints. The HUD should display non-color-only cues and aria labels so accessibility checks can verify core match status. This story does not include lobby screens, REST room creation, renderer scene objects, server telemetry export, or final visual polish. It depends on netcode metrics, authoritative match snapshots, item state definitions, barrel or fall penalty status, and player shove state being available to the browser.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:in-match-hud, area:client-web, area:accessibility, complexity:medium, operability:player-observability |

**Acceptance Criteria**
- File inspection shows packages/client-web/src/components/RaceHUD.tsx exports RaceHUD and accepts props for connectionMetrics, localPlayerState, matchState, itemState, shoveFeedback, and controlHints.
- Running npm run test --workspace @dtr/client-web -- RaceHUD.test.tsx exits with code 0 and asserts latencyMs, snapshotAgeMs, rescue progress text, current power-up text, penalty timer text, shove feedback text, and keyboard hints are rendered from fixtures.
- Running npm run test --workspace @dtr/client-web -- RaceHUD.a11y.test.tsx exits with code 0 and asserts the HUD contains labeled status regions with aria-label values for connection, objective, power-up, penalty, shove feedback, and controls.
- System integration test: running npm run test:integration -- race-hud-netcode-state exits with code 0 and packages/client-web/test/raceHudNetcode.integration.test.tsx maps a mocked WebSocketGameClient metrics object and server.snapshot fixture into RaceHUD props.
- Mock data / fixtures: packages/client-web/fixtures/raceHudState.basic.json is committed and includes latency, rescue progress, current power-up, stunned penalty, fall penalty, shove feedback, and keyboard hint examples.
- N/A — database fixtures are not applicable because RaceHUD renders committed client state fixtures and mocked netcode metrics.

**Depends on:** WO-044, WO-048, WO-047, WO-040

---

## Telemetry, privacy, auditability, and beta evidence pipeline

### [P0] Define telemetry event taxonomy

Define the server telemetry event taxonomy for the closed-beta game so stakeholders can measure onboarding, match reliability, fairness corrections, and match-breaking failures without collecting unnecessary personal data. The change belongs in the shared protocol and server telemetry modules, primarily packages/shared-protocol/src/telemetry.ts and packages/server-telemetry/src/eventTaxonomy.ts. The current greenfield baseline has architecture-level observability requirements but no enforceable TypeScript event contract for room_create, join_failure, match_start, match_end, disconnect, barrel_hit, fall, item_use, rescue_complete, desync_correction, or match_breaking_error. This matters because beta exit decisions depend on consistent event names, payloads, timestamps, room hashes, player slot references, privacy classification, and non-sensitive failure reasons. When complete, developers can import strongly typed event builders and validators, create each required event using compile-time-safe payloads, and verify that raw nicknames and room codes are rejected from telemetry payloads. The story does not implement Azure Blob export, Application Insights dashboards, gameplay instrumentation, privacy request storage, or lifecycle purge policies. It depends on the room and protocol foundations being available, including room identifiers, player slot concepts, match lifecycle types, and shared error codes. The taxonomy should keep game-specific terms like barrel hits, falls, item use, rescue completion, and desync corrections recognizable to product and SRE reviewers while preserving GDPR minimization. The implementation should include committed fixtures because downstream exporter, dashboard, and beta report work will reuse the same canonical examples.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, observability, privacy, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-telemetry/test/eventTaxonomy.test.ts validates buildTelemetryEvent rejects payloads containing nickname or roomCode fields in packages/server-telemetry/src/eventTaxonomy.ts.
- Unit tests: running npm test -- packages/shared-protocol/test/telemetrySchema.test.ts asserts TelemetryEventName in packages/shared-protocol/src/telemetry.ts includes room_create, join_failure, match_start, match_end, disconnect, barrel_hit, fall, item_use, rescue_complete, desync_correction, and match_breaking_error.
- System integration tests: running npm run test:integration -- packages/server-telemetry/test/telemetryContract.integration.test.ts validates every fixture in packages/server-telemetry/test/fixtures/telemetry-events.json is accepted by validateTelemetryEvent.
- Mock data / fixtures: packages/server-telemetry/test/fixtures/telemetry-events.json contains one valid JSON object fixture for each required telemetry event name and no fixture contains nickname, roomCode, token, or ipAddress keys.
- File inspection: packages/shared-protocol/src/telemetry.ts exports TelemetryEvent, TelemetryEventName, TelemetryPrivacyClass, and TelemetryEventPayloadMap with no TypeScript any annotations.

**Depends on:** WO-001, WO-002

### [P0] Export telemetry JSONL batches

Implement the server telemetry Azure Blob JSONL batch exporter so closed-beta event evidence is durably stored with masked nicknames and operationally useful partition paths. The change belongs in packages/server-telemetry/src/blobBatchExporter.ts and packages/server-telemetry/src/nicknameMasker.ts, with Azure client wiring isolated from game code. The current target architecture requires Azure Blob Storage but has no exporter that batches telemetry events, masks guest nicknames, or writes to telemetry/year=/month=/day=/roomHash=/matchEvents.jsonl. This matters because SREs and product stakeholders need low-cost durable evidence for join success, completion rate, disconnects, desync corrections, and match-breaking failures without deploying a relational analytics stack. When complete, server modules can enqueue normalized telemetry events and the exporter flushes JSONL batches on interval, on match close, and on graceful shutdown using dependency-injected storage clients. The observable output is a blob append or upload operation at a path such as telemetry/year=2026/month=12/day=09/roomHash=abc123/matchEvents.jsonl containing one JSON object per line. This story does not add event emission to RoomManager, the WebSocket gateway, or MatchRunner, and it does not create dashboards, lifecycle rules, or beta summary rollups. It depends on the telemetry taxonomy and the Azure Blob Storage foundation being available, including container name configuration and managed identity or environment-based credentials. The implementation should fail closed for privacy by masking nickname-like fields before serialization and by recording exporter failures through structured logs without leaking payload secrets. Fixtures should use an in-memory Azure Blob mock so local and CI verification do not need live cloud credentials.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, azure-blob, observability, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-telemetry/test/nicknameMasker.test.ts verifies maskNickname in packages/server-telemetry/src/nicknameMasker.ts converts LarsFan to a deterministic masked value and preserves no raw nickname substring.
- Unit tests: running npm test -- packages/server-telemetry/test/blobPathBuilder.test.ts verifies buildTelemetryBlobPath in packages/server-telemetry/src/blobPathBuilder.ts returns telemetry/year=2026/month=12/day=09/roomHash=abc123/matchEvents.jsonl for a fixed timestamp and roomHash.
- System integration tests: running npm run test:integration -- packages/server-telemetry/test/blobBatchExporter.integration.test.ts flushes packages/server-telemetry/test/fixtures/telemetry-events.json through InMemoryBlobClient and asserts the blob body contains newline-delimited JSON records.
- Mock data / fixtures: packages/server-telemetry/test/fixtures/telemetry-export-batch.json contains at least three telemetry events from different event names and no nickname, roomCode, token, or ipAddress keys.
- File inspection: packages/server-telemetry/src/blobBatchExporter.ts imports the Azure Blob abstraction from packages/server-telemetry/src/blobClient.ts and does not import RoomManager, MatchRunner, or WebSocket gateway modules.

**Depends on:** WO-003, WO-009

### [P0] Record GDPR privacy requests

Implement server-side privacy request records for GDPR export and deletion so the closed-beta can respond to data subject rights without adding persistent accounts. The change belongs in packages/server-telemetry/src/privacyRequestService.ts and the REST boundary packages/server-api/src/privacyRoutes.ts, storing records under privacy/requests/requestId.json. The current architecture defines GDPR as in scope and Azure Blob as the durable store, but there is no service that validates privacy requests, writes request metadata, or tracks export and deletion status. This matters because guest nicknames and beta identifiers can still be personal data, and the sponsor cannot expand beta safely without a traceable access and erasure workflow. When complete, a validated privacy request produces a JSON document containing requestId, requestType, submittedAt, subjectReference, verificationStatus, requestStatus, targetSelectors, and audit correlation without storing raw room tokens or unnecessary identity data. The story does not perform bulk deletion of telemetry partitions, create a user account system, implement legal review, or generate beta release summaries. It depends on the Azure Blob writer and telemetry privacy conventions, including masking and partitioning. The service should support export and deletion request types with explicit statuses such as received, verifying, completed, rejected, and failed. The API layer must return structured responses and appropriate HTTP status codes while the storage service remains testable without a live Azure account. Committed fixtures should represent valid export, valid deletion, invalid type, and malformed subject reference cases.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, gdpr, privacy, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-telemetry/test/privacyRequestService.test.ts verifies createPrivacyRequest in packages/server-telemetry/src/privacyRequestService.ts writes blob path privacy/requests/req_123.json for requestId req_123.
- Unit tests: running npm test -- packages/server-telemetry/test/privacyRequestValidation.test.ts verifies packages/server-telemetry/src/privacyRequestSchema.ts rejects requestType values outside export and deletion with validation error code invalid_request_type.
- System integration tests: running npm run test:integration -- packages/server-api/test/privacyRoutes.integration.test.ts posts to POST /api/v1/privacy/requests in packages/server-api/src/privacyRoutes.ts and asserts HTTP 202 plus response body requestId and requestStatus received.
- Mock data / fixtures: packages/server-telemetry/test/fixtures/privacy-requests.json contains valid export, valid deletion, invalid type, and malformed subject reference request examples.
- File inspection: packages/server-telemetry/src/privacyRequestService.ts stores subjectReference as a masked or hashed value and does not write roomToken, rawNickname, or rawRoomCode fields to privacy/requests/requestId.json.

**Depends on:** WO-016

### [P0] Configure Blob lifecycle purges

Configure Azure Blob lifecycle purge policies for telemetry, audit, privacy, and beta report partitions so operational evidence is retained only for the approved windows and purged automatically. The change belongs in infra/azure/blob-lifecycle.bicep and infra/azure/storage.bicep, with validation coverage in infra/azure/tests/blob-lifecycle.test.ts. The current infrastructure baseline has Azure Blob Storage as the intended durable store, but there is no infrastructure-as-code policy that enforces retention separation across telemetry, audit, privacy, and beta-reports prefixes. This matters because GDPR data minimization, audit policy, and beta evidence requirements have different retention expectations and manual cleanup would be error-prone during closed beta. When complete, storage lifecycle rules target telemetry/year= partitions, audit/year= partitions, privacy/requests artifacts, and beta-reports/releaseCandidateId summaries with explicit delete-after-day settings. The observable behavior is an Azure deployment template that applies lifecycle management to the storage account without granting application code permission to bypass retention rules. This story does not implement telemetry export, audit writing, privacy request creation, or beta summary generation. It depends on the blob path conventions for telemetry, audit records, privacy requests, and beta reports being established. The implementation should document retention values in infra/azure/retention-policy.json so SREs can review the cost and compliance posture in pull requests. Tests should compile or validate the infrastructure template locally and assert each required prefix has exactly one lifecycle rule.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, infrastructure, azure-blob, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- infra/azure/tests/blob-lifecycle.test.ts asserts infra/azure/blob-lifecycle.bicep contains lifecycle rules for telemetry/, audit/, privacy/requests/, and beta-reports/ prefixes.
- System integration tests: running npm run infra:what-if -- infra/azure/storage.bicep validates the storage account deployment plan includes a Microsoft.Storage/storageAccounts/managementPolicies resource named default.
- Mock data / fixtures: infra/azure/tests/fixtures/blob-prefixes.json contains telemetry/year=2026/month=12/day=09/roomHash=abc/matchEvents.jsonl, audit/year=2026/month=12/day=09/audit.jsonl, privacy/requests/req_123.json, and beta-reports/rc-001/summary.json.
- File inspection: infra/azure/retention-policy.json defines numeric retentionDays values for telemetry, audit, privacyRequests, and betaReports and includes audit retention of at least 365 days.
- File inspection: infra/azure/storage.bicep references infra/azure/blob-lifecycle.bicep or an equivalent module and does not require application code changes to enforce blob deletion.

**Depends on:** WO-003, WO-016, WO-022

### [P0] Write immutable audit records

Implement immutable audit records for room token issuance, token rejection, start-match authorization, and privacy requests so security-sensitive beta actions can be reviewed independently from operational telemetry. The change belongs in packages/server-telemetry/src/auditWriter.ts with emission hooks in packages/server-api/src/RoomManager.ts, packages/server-api/src/matchStartRoutes.ts, packages/server-realtime/src/Gateway.ts, and packages/server-telemetry/src/privacyRequestService.ts. The current telemetry pipeline can persist operational events, but it does not yet produce separate append-only audit records with actor, timestamp, resource, action, decision, and safe change details. This matters because organization policy requires immutable audit records for authentication events, authorization decisions, data mutations, and privacy actions, and beta operations need traceability when room tokens are issued or rejected. When complete, token issuance creates a token_issued audit action, invalid token or scope rejection creates token_rejected, match start checks create start_match_authorized or start_match_denied, and privacy request creation creates privacy_request_recorded. The story does not add new user authentication, change token cryptography, create dashboards, or implement privacy data deletion itself. It depends on the telemetry taxonomy, blob exporter abstraction, and privacy request record service. The audit writer should store JSONL under audit/year=/month=/day=/audit.jsonl and should not share the shorter telemetry retention assumptions. Audit payloads must include hashed actor and resource identifiers rather than raw nicknames, raw room codes, or token values. Tests should prove audit writes are append-only at the service boundary and that callers cannot update or delete an audit record through the writer.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, audit, security, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-telemetry/test/auditWriter.test.ts verifies appendAuditRecord in packages/server-telemetry/src/auditWriter.ts writes JSONL records with action, decision, actorHash, resourceHash, occurredAt, and correlationId.
- Unit tests: running npm test -- packages/server-api/test/tokenAudit.test.ts asserts packages/server-api/src/RoomManager.ts emits token_issued for successful room token issuance and token_rejected for invalid join or token rejection paths.
- Unit tests: running npm test -- packages/server-api/test/startMatchAudit.test.ts asserts packages/server-api/src/matchStartRoutes.ts emits start_match_authorized for a valid host token and start_match_denied for a participant token.
- System integration tests: running npm run test:integration -- packages/server-api/test/privacyAudit.integration.test.ts posts to POST /api/v1/privacy/requests and asserts privacy_request_recorded appears in the in-memory audit blob audit/year=2026/month=12/day=09/audit.jsonl.
- Mock data / fixtures: packages/server-telemetry/test/fixtures/audit-records.json contains examples for token_issued, token_rejected, start_match_authorized, start_match_denied, and privacy_request_recorded without raw token, nickname, or roomCode fields.

**Depends on:** WO-009, WO-016, WO-022

### [P0] Emit server telemetry events

Emit the defined server telemetry events from room, WebSocket, and match execution paths so beta reliability evidence is produced automatically during real gameplay. The change belongs in packages/server-api/src/RoomManager.ts, packages/server-realtime/src/Gateway.ts, and packages/server-game/src/MatchRunner.ts, with telemetry publishing routed through packages/server-telemetry/src/telemetryPublisher.ts. The current implementation baseline has room lifecycle, realtime gateway, and match runner capabilities, but those flows do not yet publish normalized events into the blob batch exporter. This matters because closed-beta decisions require measured room creation, join failures, match starts and ends, disconnects, barrel hits, falls, item uses, rescue completions, desync corrections, and match-breaking errors rather than anecdotal playtest notes. When complete, creating a room emits room_create, invalid or full joins emit join_failure, match start and completion emit lifecycle events, and gameplay outcomes emit the corresponding event names with roomHash and matchId correlation. The story does not define new taxonomy fields, implement Azure Blob writer internals, add dashboards, or change gameplay rules such as stun duration, item effects, or rescue ordering. It depends on the room manager, realtime gateway, match runner, authoritative gameplay systems, and the JSONL exporter being available. The implementation should use dependency injection so tests can inject a recording telemetry publisher and assert emitted events without needing Azure. The operational behavior should be safe under telemetry failures: a failed enqueue should log a structured warning but must not block room creation, match ticks, or WebSocket message handling. Fixtures must include representative room, gateway, and match scenarios so integration tests can validate service boundaries.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:telemetry-privacy-audit, platform, observability, server, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-api/test/RoomManager.telemetry.test.ts asserts RoomManager.createRoom in packages/server-api/src/RoomManager.ts emits room_create with roomHash and host playerSlot.
- Unit tests: running npm test -- packages/server-api/test/RoomManager.joinFailureTelemetry.test.ts asserts RoomManager.joinRoom in packages/server-api/src/RoomManager.ts emits join_failure for invalid_code, room_full, expired_room, and in_progress cases.
- Unit tests: running npm test -- packages/server-game/test/MatchRunner.telemetry.test.ts asserts MatchRunner in packages/server-game/src/MatchRunner.ts emits match_start, barrel_hit, fall, item_use, rescue_complete, desync_correction, match_end, and match_breaking_error in deterministic fixture scenarios.
- System integration tests: running npm run test:integration -- packages/server-realtime/test/Gateway.telemetry.integration.test.ts connects through packages/server-realtime/src/Gateway.ts, sends client.hello, closes the socket, and asserts disconnect is recorded by RecordingTelemetryPublisher.
- Mock data / fixtures: packages/server-game/test/fixtures/match-telemetry-scenarios.json and packages/server-api/test/fixtures/room-telemetry-scenarios.json contain deterministic inputs for event assertions without Azure Blob credentials.

**Depends on:** WO-018, WO-023, WO-020, WO-028, WO-016

### [P1] Create telemetry dashboards and alerts

Create Application Insights dashboards and alerts for beta reliability SLIs so DevOps and SRE reviewers can detect onboarding, match completion, desync, error, and disconnect regressions during invited testing. The change belongs in infra/azure/app-insights-dashboard.bicep and infra/azure/app-insights-alerts.bicep, with query definitions in infra/azure/queries/*.kql. The current infrastructure baseline may deploy monitoring primitives, but there are no dashboard tiles or alert rules tied to join success rate, match completion rate, desync correction rate, match-breaking errors, or WebSocket disconnects. This matters because beta success criteria include join reliability, completion rate, desynchronization guardrails, and match-breaking error thresholds that must be visible without manually reading JSONL blobs. When complete, Azure resources define workbook or dashboard content plus scheduled query alerts for each required SLI, using event names emitted by the server telemetry pipeline. The story does not alter telemetry event emission, gameplay behavior, Blob lifecycle policy, or beta report generation. It depends on the deployed Azure monitoring foundation and server-side telemetry events being emitted with stable event names and correlation fields. The operational output should include alert names, KQL query files, threshold parameters, and action group wiring with environment-specific enablement. Tests should statically validate that every query references the correct event names and that dashboard definitions include all required SLI tiles. Cost should be controlled by using aggregated customEvents queries and scheduled query alert frequencies appropriate for closed beta rather than high-cardinality per-player alerting.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:telemetry-privacy-audit, platform, observability, azure-monitor, complexity:medium |

**Acceptance Criteria**
- Unit tests: running npm test -- infra/azure/tests/app-insights-queries.test.ts asserts infra/azure/queries/join-success-rate.kql references room_create and join_failure customEvents names.
- Unit tests: running npm test -- infra/azure/tests/app-insights-queries.test.ts asserts infra/azure/queries/match-completion-rate.kql references match_start and match_end customEvents names.
- System integration tests: running npm run infra:what-if -- infra/azure/app-insights-alerts.bicep validates scheduled query alert resources for join-success-rate, match-completion-rate, desync-correction-rate, match-breaking-errors, and websocket-disconnects.
- Mock data / fixtures: infra/azure/tests/fixtures/application-insights-events.json contains customEvents examples for room_create, join_failure, match_start, match_end, desync_correction, match_breaking_error, and disconnect.
- File inspection: infra/azure/app-insights-dashboard.bicep defines dashboard or workbook sections titled Join success rate, Match completion rate, Desync correction rate, Match-breaking errors, and WebSocket disconnects.

**Depends on:** WO-003, WO-041

### [P1] Generate beta evidence summaries

Implement a beta reports summary generator keyed by releaseCandidateId so the public-release decision gate can review privacy status, accessibility status, telemetry KPI rollups, and legal/IP gate status in one artifact. The change belongs in packages/server-telemetry/src/betaReportGenerator.ts and writes summaries under beta-reports/releaseCandidateId/summary.json. The current evidence pipeline can store telemetry and privacy request records, but it does not yet aggregate those records into a release-candidate summary for sponsor sign-off. This matters because the closed-beta rollout requires explicit evidence for match completion, join success, desync correction, match-breaking errors, privacy readiness, accessibility readiness, and legal/IP readiness before any public release activity. When complete, a developer can run a command such as npm run beta:summary -- --releaseCandidateId rc-001 --from 2026-12-09 --to 2027-01-20 and receive a JSON summary artifact in the beta-reports partition. The story does not create dashboards, perform manual legal review, conduct accessibility testing, or modify gameplay telemetry emission. It depends on telemetry JSONL export, gameplay event emission, and privacy request storage, plus external status inputs for accessibility and legal/IP gates. The generator should accept status input JSON files so non-code reviewers can provide gate outcomes without embedding subjective approvals in source code. The telemetry rollups should include numerator, denominator, percentage, and sourceBlobCount for join success rate, match completion rate, desync correction rate, match-breaking error rate, and disconnect count. Fixtures must include sample telemetry JSONL, privacy request records, accessibility status, and legal/IP status so CI can validate the generator without Azure.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P1 |
| Labels | epic:telemetry-privacy-audit, platform, beta-evidence, reporting, complexity:high |

**Acceptance Criteria**
- Unit tests: running npm test -- packages/server-telemetry/test/betaReportGenerator.test.ts verifies generateBetaSummary in packages/server-telemetry/src/betaReportGenerator.ts calculates joinSuccessRate from room_create and join_failure fixture events.
- Unit tests: running npm test -- packages/server-telemetry/test/betaKpiRollups.test.ts verifies packages/server-telemetry/src/betaKpiRollups.ts calculates matchCompletionRate from match_start and match_end and matchBreakingErrorRate from match_breaking_error fixtures.
- System integration tests: running npm run test:integration -- packages/server-telemetry/test/betaReportGenerator.integration.test.ts writes beta-reports/rc-001/summary.json through InMemoryBlobClient and asserts releaseCandidateId equals rc-001.
- Mock data / fixtures: packages/server-telemetry/test/fixtures/beta-report/ contains telemetry-jsonl, privacy-requests, accessibility-status.json, legal-ip-status.json, and expected-summary.json used by the generator tests.
- File inspection: packages/server-telemetry/src/betaReportGenerator.ts includes privacyStatus, accessibilityStatus, telemetryKpis, legalIpGateStatus, generatedAt, sourceWindow, and sourceBlobCount fields in the summary schema.

**Depends on:** WO-016, WO-041, WO-022

---

## Security hardening, input validation, and supply-chain controls

### [P0] Automate supply-chain security checks

Add a dedicated GitHub Actions security workflow for dependency review, secret scanning, container scanning, SBOM generation, and artifact integrity checks so every beta build has automated supply-chain evidence before deployment. The implementation belongs in .github/workflows/security.yml with supporting package and container metadata referenced from package.json and Dockerfile. This workflow must run on pull_request and push to main, and it must fail when dependency review, secret scan, container vulnerability scan, SBOM generation, or artifact checksum verification detects a blocking issue. The business value is operational confidence that the browser client, Node.js game server, and container image are not shipped with obvious vulnerable dependencies or leaked credentials during closed beta. When complete, the workflow uploads an SBOM artifact, produces checksum files for build artifacts, scans the container image, and checks dependency changes before merge. This story does not remediate individual vulnerabilities, rotate leaked secrets, change deployment approvals, or provision Azure resources. It depends on the repository having a lockfile, build scripts, and a container build path. The workflow must use pinned action versions or immutable SHAs where practical and must not echo secrets into logs. The output should be actionable for SRE and DevOps reviewers by naming the failed security gate and artifact path.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:security-hardening, github-actions, supply-chain, sbom, container-security, complexity:medium |

**Acceptance Criteria**
- File inspection confirms .github/workflows/security.yml exists and defines jobs named dependency-review, secret-scan, container-scan, sbom, and artifact-integrity.
- File inspection confirms .github/workflows/security.yml triggers on pull_request and push to main and declares permissions with least privilege, including contents: read and security-events: write only where required.
- Running npm run workflow:lint -- .github/workflows/security.yml validates the workflow syntax and rejects unpinned actions according to the repository workflow lint rules.
- Running npm run build produces artifacts under dist/ and running npm run security:checksums creates checksum files referenced by the artifact-integrity job in .github/workflows/security.yml.
- Running npm run security:sbom creates an SBOM artifact at artifacts/sbom/sbom.spdx.json or artifacts/sbom/sbom.cyclonedx.json, and the sbom job uploads that artifact path.
- Unit tests N/A — this story adds CI workflow and artifact verification configuration, not application logic; verification is performed by workflow lint and security script commands referenced in package.json.
- System integration tests N/A — this story does not change REST endpoints, WebSocket message handling, or service boundaries; the security workflow validates build and container artifacts instead.
- Mock data and fixtures are committed at tests/fixtures/security/sample-secret-scan.txt and tests/fixtures/security/sample-checksums.txt for local scanner and checksum script validation without external dependencies.

**Depends on:** WO-004, WO-005

### [P0] Validate API and realtime inputs

Add Zod allow-list validation schemas for nicknames, room codes, room tokens, client.input messages, and item-use commands so guest players cannot submit malformed or hostile data into the lobby or match simulation. The implementation belongs in the sharedProtocol module at packages/shared-protocol/src/validation.ts and must be enforced from packages/server-api/src/routes/rooms.ts and packages/server-realtime/src/gateway.ts. The current target state is that every browser-originated value is parsed from unknown data into a typed, bounded object before room creation, joining, or gameplay processing. This protects the closed-beta experience by keeping room creation, 5-player joins, item use, movement, and rescue outcomes server-authoritative and resistant to client tampering. When the story is complete, invalid nicknames return structured HTTP 400 responses, invalid room codes never reach room lookup, invalid room tokens are rejected before WebSocket attachment, and malformed gameplay commands are rejected without entering the match queue. Nicknames must allow expected Unicode display names such as Løkke while still rejecting control characters, script fragments, excessive length, and unsupported symbols. Room codes must remain short invite codes with uppercase alphanumeric allow-listing, and client.input payloads must constrain sequence numbers, axes, action names, and item identifiers. This story does not add rate limiting, security headers, token signing-key rotation, new gameplay item types, or UI copy changes beyond returning existing structured validation errors. It depends on the REST room bootstrap endpoints, the raw WebSocket gameplay gateway, and shared protocol package boundaries already existing so validation can be centralized rather than duplicated.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:security-hardening, security, validation, websocket, api, complexity:medium |

**Acceptance Criteria**
- File inspection confirms packages/shared-protocol/src/validation.ts exports Zod schemas named nicknameSchema, roomCodeSchema, roomTokenSchema, clientInputMessageSchema, and itemUseCommandSchema, and each schema uses allow-listed characters or explicit numeric bounds rather than permissive z.any.
- Running npm test -- --run packages/shared-protocol verifies unit tests in packages/shared-protocol/src/validation.test.ts reject nickname input containing <script>, reject room code abc123, reject client.input axis values outside -1 to 1, and accept the nickname Løkke.
- Running npm test -- --run packages/server-api verifies integration tests in packages/server-api/src/routes/rooms.validation.test.ts return HTTP 400 from POST /api/v1/rooms for an invalid nickname and HTTP 400 from POST /api/v1/rooms/{code}/join for an invalid room code before room manager lookup is invoked.
- Running npm test -- --run packages/server-realtime verifies integration tests in packages/server-realtime/src/gateway.validation.test.ts reject malformed client.input and item-use WebSocket messages without calling submitInput or applyItemUse.
- Mock data and fixtures are committed at tests/fixtures/security/invalid-payloads.json and tests/fixtures/security/valid-payloads.json, and both fixture files are imported by packages/shared-protocol/src/validation.test.ts.
- File inspection confirms packages/server-api/src/routes/rooms.ts and packages/server-realtime/src/gateway.ts parse request bodies and WebSocket payloads as unknown before applying the shared Zod schemas.
- Running npm run typecheck reports no TypeScript errors for packages/shared-protocol/src/validation.ts, packages/server-api/src/routes/rooms.ts, and packages/server-realtime/src/gateway.ts.

**Depends on:** WO-006, WO-007

### [P0] Secure Azure secrets and OIDC

Configure Azure Key Vault and GitHub OIDC access for room-token signing keys, Blob writer credentials, and deployment credentials so no long-lived production secrets are committed or stored in workflow files. The implementation belongs in the infraAzure module at infra/azure/key-vault.bicep and the deployment workflow integration at .github/workflows/deploy.yml. The target is an automation-first path where GitHub Actions uses federated identity to deploy infrastructure and read only the secrets required for the environment being deployed. This protects beta reliability and incident recovery by making signing-key ownership, Blob telemetry access, and deployment permissions explicit, auditable, and revocable. When complete, Key Vault contains named secret placeholders and access policies or RBAC assignments for the API runtime identity, realtime runtime identity, Blob writer identity, and GitHub deployment identity. The room-token signing key must be retrieved at runtime from Key Vault rather than from a committed .env file or hardcoded workflow variable. This story does not rotate real production secrets, create a persistent user account system, provision a relational database, or change the token claims format. It depends on the Azure resource group, hosting identity model, and GitHub Actions deployment workflow being present. The delivered code must be safe to validate without exposing actual secret values, using parameter names and placeholders only.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P0 |
| Labels | epic:security-hardening, azure, key-vault, github-actions, secrets-management, complexity:high |

**Acceptance Criteria**
- File inspection confirms infra/azure/key-vault.bicep defines an Azure Key Vault resource and secret names room-token-signing-key, blob-writer-credential, and deployment-credential without embedding real secret values.
- File inspection confirms infra/azure/github-oidc.bicep defines federated credential configuration for GitHub Actions using repository donkey-trump-race and environment-specific subject filters rather than a broad wildcard subject.
- Running npm run infra:validate -- infra/azure/main.bicep validates Key Vault, managed identity, and GitHub OIDC modules without requiring real secret values.
- File inspection confirms .github/workflows/deploy.yml uses Azure login with OIDC permissions id-token: write and does not contain AZURE_CLIENT_SECRET, storage account keys, room-token signing keys, or raw connection strings.
- Running npm test -- --run packages/server-api verifies unit tests in packages/server-api/src/config/secrets.test.ts load room-token signing configuration from the Key Vault-backed secret provider abstraction and reject missing room-token-signing-key.
- System integration coverage is present in packages/server-api/src/config/secrets.integration.test.ts using tests/fixtures/security/key-vault-secrets.json and a fake Key Vault client, verifying server startup fails closed when room-token-signing-key is absent.
- Mock data and fixtures are committed at tests/fixtures/security/key-vault-secrets.json with placeholder values only and no live tenant ids, subscription ids, client secrets, private keys, or storage keys.

**Depends on:** WO-003, WO-010

### [P0] Throttle room and gameplay requests

Add rate limiting to room creation, room joining, and client.input WebSocket messages so abusive clients cannot exhaust the closed-beta server or gain unfair gameplay advantage. The implementation belongs in serverApi middleware at packages/server-api/src/middleware/rateLimit.ts and the realtime gateway path at packages/server-realtime/src/gateway.ts with a per-connection helper in packages/server-realtime/src/inputRateLimiter.ts. The REST endpoints POST /api/v1/rooms and POST /api/v1/rooms/{code}/join must enforce per-IP and user-agent limits with structured 429 responses. The WebSocket gameplay channel must accept the intended 30 Hz client.input cadence with a small burst budget for network jitter while rejecting sustained over-rate senders before messages reach authoritative simulation. This protects lobby availability and competitive fairness for up to 5 players per room and the expected closed-beta concurrency of about 20 rooms. When complete, a normal browser sending inputs at 30 messages per second is accepted, short jitter bursts are tolerated, and sustained flooding causes a safe realtime error or close code with masked security telemetry. This story does not define new validation schemas, change movement physics, tune snapshot frequency, configure CDN WAF rules, or add bot-detection services. It depends on request validation being centralized and on REST room endpoints plus WebSocket client.input handling already being implemented. The target behavior should be deterministic in tests using fake timers so operational teams can verify limits without running an external load tool.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:security-hardening, security, rate-limiting, reliability, websocket, complexity:medium |

**Acceptance Criteria**
- File inspection confirms packages/server-api/src/middleware/rateLimit.ts defines rate-limit policies for POST /api/v1/rooms and POST /api/v1/rooms/{code}/join and returns HTTP 429 with a Retry-After header when the limit is exceeded.
- Running npm test -- --run packages/server-api verifies integration tests in packages/server-api/src/middleware/rateLimit.test.ts receive HTTP 429 from POST /api/v1/rooms after the configured create-room limit and HTTP 429 from POST /api/v1/rooms/{code}/join after the configured join limit.
- Running npm test -- --run packages/server-realtime verifies unit tests in packages/server-realtime/src/inputRateLimiter.test.ts accept 30 client.input messages in one simulated second plus the configured jitter burst and reject a sustained 60 Hz stream.
- Running npm test -- --run packages/server-realtime verifies integration tests in packages/server-realtime/src/gateway.rateLimit.test.ts prevent over-rate client.input messages from invoking submitInput in packages/server-game/src/matchRunner.ts.
- Mock data and fixtures are committed at tests/fixtures/security/rate-limit-scenarios.json and include normal-30hz, jitter-burst, sustained-60hz, and room-create-flood cases.
- System integration coverage is present in packages/server-api/src/routes/rooms.rateLimit.integration.test.ts and packages/server-realtime/src/gateway.rateLimit.test.ts, and the tests run without Azure, CDN, or external Redis dependencies.
- File inspection confirms packages/server-api/src/middleware/rateLimit.ts does not key limits by raw nickname or raw room token, and structured logs include operation names POST /api/v1/rooms, POST /api/v1/rooms/{code}/join, and client.input without logging token values.

**Depends on:** WO-018, WO-019, WO-020, WO-013

### [P0] Return safe API and WebSocket errors

Implement safe error middleware in server-api and server-realtime so users receive structured failures and WebSocket close codes without stack traces, secrets, raw tokens, or internal object ids. The implementation belongs in packages/server-api/src/middleware/errorHandler.ts and packages/server-realtime/src/errorHandling.ts, with shared error definitions exported from packages/shared-errors/src/errorCatalog.ts. The target state is that expected player errors such as invalid room, expired token, full room, in-progress room, malformed message, and rate-limit violation produce stable codes and actionable messages. This protects closed-beta trust because players can recover from room and connection problems while operators still receive masked telemetry for debugging. When complete, POST /api/v1/rooms and POST /api/v1/rooms/{code}/join use the same error envelope shape, and WebSocket clients receive safe error events or close codes for malformed, unauthorized, and abusive traffic. Unexpected exceptions must log a correlation id and masked context while returning HTTP 500 or realtime close semantics that do not expose implementation details. This story does not add new validation rules, implement rate limiting policies, change gameplay simulation, or create frontend error screens. It depends on REST room routing, realtime gateway handling, and the shared error catalog capability being available. The implementation should make error handling observable by emitting non-sensitive security and reliability events for match-breaking failures and rejected connections.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:security-hardening, safe-errors, observability, api, websocket, complexity:medium |

**Acceptance Criteria**
- File inspection confirms packages/shared-errors/src/errorCatalog.ts defines stable error codes for validation_failed, room_not_found, room_full, room_in_progress, token_invalid, token_expired, rate_limited, malformed_message, and internal_error.
- Running npm test -- --run packages/server-api verifies packages/server-api/src/middleware/errorHandler.test.ts maps validation_failed to HTTP 400, token_invalid to HTTP 401, forbidden role errors to HTTP 403, room_not_found to HTTP 404, rate_limited to HTTP 429, and unexpected exceptions to HTTP 500.
- Running npm test -- --run packages/server-api verifies packages/server-api/src/routes/rooms.error.integration.test.ts responses from POST /api/v1/rooms and POST /api/v1/rooms/{code}/join contain error.code, error.message, and correlationId and do not contain stack, trace, token, signingKey, or connectionString fields.
- Running npm test -- --run packages/server-realtime verifies packages/server-realtime/src/errorHandling.test.ts maps malformed_message, token_invalid, token_expired, and rate_limited to documented WebSocket close codes or safe server.error messages.
- Running npm test -- --run packages/server-realtime verifies packages/server-realtime/src/gateway.error.integration.test.ts malformed WebSocket JSON is handled without process crash and without calling submitInput.
- Mock data and fixtures are committed at tests/fixtures/security/error-payloads.json and tests/fixtures/security/redaction-cases.json, and tests assert stack traces and secret-like strings are redacted.
- System integration coverage is present for both HTTP and WebSocket boundaries in packages/server-api/src/routes/rooms.error.integration.test.ts and packages/server-realtime/src/gateway.error.integration.test.ts.

**Depends on:** WO-007, WO-018, WO-020

### [P0] Enforce API and CDN headers

Configure server-api and Azure CDN security headers for CSP, HSTS, CORS allow-listing, no-sniff, and frame-ancestor restrictions so the browser game is protected from common web delivery attacks during closed beta. The implementation belongs in the serverApi module at packages/server-api/src/middleware/securityHeaders.ts and the Azure edge configuration at infra/azure/cdn.bicep. The API must only allow configured beta client origins to call room bootstrap endpoints, while the CDN must serve static client assets with browser protections that do not break Three.js rendering or WebSocket connectivity. This reduces the risk of clickjacking, MIME sniffing, cross-origin misuse, and accidental exposure from permissive development headers. When complete, HTTP responses from GET /healthz, POST /api/v1/rooms, and POST /api/v1/rooms/{code}/join include the expected headers, and Azure CDN rules define equivalent edge headers for static assets. CSP must be restrictive enough to deny arbitrary script execution while explicitly allowing the application’s own scripts, WebSocket endpoint, asset CDN, and telemetry endpoint if configured. This story does not implement WAF managed rules, TLS certificate provisioning, application validation schemas, or secret management. It depends on the client build, API base URL, CDN hostname, and environment configuration conventions being available. The implementation must keep local development usable through explicit dev-origin configuration rather than wildcard CORS.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:security-hardening, security-headers, azure-cdn, cors, infrastructure, complexity:medium |

**Acceptance Criteria**
- File inspection confirms packages/server-api/src/middleware/securityHeaders.ts sets Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, and frame-ancestors directives without using wildcard frame ancestors.
- Running npm test -- --run packages/server-api verifies packages/server-api/src/middleware/securityHeaders.test.ts asserts GET /healthz includes X-Content-Type-Options: nosniff and Strict-Transport-Security with max-age at least 31536000 outside local development.
- Running npm test -- --run packages/server-api verifies packages/server-api/src/routes/rooms.cors.test.ts rejects an Origin not present in the configured CORS allow list for POST /api/v1/rooms and allows the beta client origin from tests/fixtures/security/allowed-origins.json.
- File inspection confirms infra/azure/cdn.bicep defines CDN response header rules for Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, and frame-ancestors for static asset delivery.
- Running npm run infra:validate -- infra/azure/main.bicep completes Bicep validation for the CDN security header configuration without requiring live Azure secrets.
- System integration coverage is present in packages/server-api/src/middleware/securityHeaders.integration.test.ts and verifies headers on GET /healthz and POST /api/v1/rooms.
- Mock data and fixtures are committed at tests/fixtures/security/allowed-origins.json and tests/fixtures/security/header-expectations.json, and tests import both fixture files.

**Depends on:** WO-003, WO-005, WO-024

---

## Closed-beta quality gates, multiplayer validation, and operational smoke tests

### [P0] Add staging deploy smoke workflow

Add .github/workflows/deploy-staging-smoke.yml to verify /healthz, POST /api/v1/rooms, WebSocket client.hello, and static asset loading after staging deployment so broken releases are stopped before beta testers see them. The work belongs in .github/workflows/deploy-staging-smoke.yml and the smoke helper at scripts/smoke/staging-smoke.ts, with endpoint behavior supplied by packages/server-api/src/routes/health.ts, packages/server-api/src/routes/rooms.ts, and packages/server-realtime/src/WebSocketGateway.ts. This matters because the closed-beta architecture relies on a single-region server and CDN assets, so a deployment can be technically successful while still breaking the exact paths users need to create and join matches. Today the architecture calls for GitHub Actions, health checks, smoke tests, and supply-chain gates, but the indexed repository has no workflow file for staging smoke validation. When complete, workflow_dispatch and post-deploy invocations can run smoke checks against a configured staging base URL, create a temporary room, perform a WebSocket hello with the issued token, fetch the client asset entry point, and fail on non-2xx or malformed responses. The workflow must use GitHub environment secrets without committing real URLs, tokens, Azure credentials, or connection strings. This story does not include provisioning Azure infrastructure, changing production approval policy, adding load tests, or deploying to multiple regions. It depends on the health endpoint, room creation endpoint, static asset hosting, and WebSocket handshake already being implemented. The implementation should produce runbook-grade logs that identify failing operations while masking sensitive response values.

| Field | Value |
|---|---|
| Story Points | 3 |
| Hours | 30h |
| Priority | P0 |
| Labels | epic:closed-beta-quality-gates, area:github-actions, area:deployment, area:smoke-test, complexity:medium |

**Acceptance Criteria**
- File inspection verifies .github/workflows/deploy-staging-smoke.yml exists and defines workflow_dispatch plus a staging environment that reads STAGING_BASE_URL from GitHub secrets or environment variables without hardcoded secret values.
- Running npm run smoke:staging -- --baseUrl=http://localhost:3000 executes scripts/smoke/staging-smoke.ts and verifies GET /healthz returns status 200 with a JSON body containing status=ok.
- scripts/smoke/staging-smoke.ts sends POST /api/v1/rooms with a deterministic smoke nickname and verifies the response status is 201 and includes roomCode, playerId, roomToken, and websocketUrl fields before masking roomToken in logs.
- scripts/smoke/staging-smoke.ts opens the websocketUrl from POST /api/v1/rooms, sends a client.hello message with the issued token, and verifies a server hello or lobby snapshot message is received within 5000 milliseconds.
- scripts/smoke/staging-smoke.ts fetches the configured static asset URL or root HTML page and verifies status 200 plus a content-type containing text/html or application/javascript.
- Unit tests written and passing: npm run test:unit --workspace packages/server-api executes packages/server-api/src/routes/health.test.ts and packages/server-api/src/routes/rooms.test.ts for /healthz and POST /api/v1/rooms response contracts.
- System integration tests written and passing: npm run test:integration --workspace packages/server-realtime executes a WebSocket client.hello smoke test against packages/server-realtime/src/WebSocketGateway.ts.
- Mock data and fixtures generated and committed: scripts/smoke/fixtures/stagingSmokeRoom.json contains a deterministic nickname payload and expected response-field list without real tokens or secrets.

**Depends on:** WO-010, WO-018, WO-020, WO-024

### [P0] Automate browser lobby E2E flows

Add Playwright browser end-to-end coverage for create room, join room, lobby roster, ready state, and start match flows so closed-beta builds cannot ship with a broken guest onboarding path. The work belongs in the client-web test surface at packages/client-web/playwright.config.ts and packages/client-web/tests/e2e/lobby-flow.spec.ts, with the tests driving the REST room bootstrap endpoint and the WebSocket lobby updates exposed by the server. This matters because the primary beta promise is that friends can open Donkey Trump Race, create a room, invite others, and start a short multiplayer match without account setup or moderator help. Today the architecture defines those flows, but the repository has no indexed browser E2E suite proving Chromium and Firefox can execute them from the actual UI. When complete, a developer can run one command and see browser automation create a host room, join four additional players, verify distinct roster colors and names, toggle readiness, and start the match. The tests must assert observable UI text, ARIA roles where available, room code presence, lobby roster count, and match transition state rather than relying only on screenshots. This story does not include adding new lobby product behavior, changing the maximum room size, implementing matchmaking, or testing native mobile browsers. It depends on the create-room and join-room APIs, structured lobby UI, guest token handling, ready-state WebSocket messages, and match-start server authority already being implemented. The implementation should favor deterministic local test fixtures and controlled browser contexts so the suite is useful in CI as an operational quality gate.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:closed-beta-quality-gates, area:client-web, area:e2e, area:multiplayer-lobby, complexity:medium |

**Acceptance Criteria**
- Running npm run test:e2e --workspace packages/client-web -- --project=chromium executes packages/client-web/tests/e2e/lobby-flow.spec.ts and verifies POST /api/v1/rooms returns status 201 before the host room code is shown in packages/client-web/src/pages/LandingRoomEntry.tsx.
- Running npm run test:e2e --workspace packages/client-web -- --project=firefox executes packages/client-web/tests/e2e/lobby-flow.spec.ts and asserts packages/client-web/src/pages/MultiplayerLobby.tsx renders exactly 5 roster entries after four joiners use POST /api/v1/rooms/{code}/join.
- The Playwright assertion in packages/client-web/tests/e2e/lobby-flow.spec.ts verifies each roster row exposes a unique player color label and nickname, and the test fails if the lobby renders more than five players.
- The Playwright assertion in packages/client-web/tests/e2e/lobby-flow.spec.ts toggles ready state for all non-host players, observes the WebSocket lobby update in the UI, clicks the host start control, and verifies packages/client-web/src/components/RaceHUD.tsx is visible after POST /api/v1/rooms/{code}/start returns status 200.
- Unit tests written and passing: npm run test:unit --workspace packages/client-web executes packages/client-web/src/pages/MultiplayerLobby.test.tsx and validates roster count, ready badge text, and disabled start-button behavior for fewer than two players.
- System integration tests written and passing: npm run test:e2e --workspace packages/client-web executes packages/client-web/tests/e2e/lobby-flow.spec.ts against the local server API and WebSocket gateway without external network dependencies.
- Mock data and fixtures generated and committed: packages/client-web/tests/fixtures/lobbyUsers.ts exports five deterministic nickname values including a Unicode-safe Løkke case and is imported by packages/client-web/tests/e2e/lobby-flow.spec.ts.

**Depends on:** WO-018, WO-019, WO-023, WO-024, WO-031

### [P1] Add multiplayer soak validation harness

Add an automated multiplayer soak harness that simulates 20 rooms with five players per room, sends WebSocket input at 30 Hz, and validates snapshot fanout at 20 Hz so closed-beta capacity assumptions are measured before invited tester sessions. The work belongs in the server-side operational test surface at packages/server-realtime/tests/soak/multiplayer-soak.ts and packages/server-realtime/src/WebSocketGateway.ts, with metrics emitted through packages/server-telemetry/src/events.ts. This matters because the architecture explicitly sizes the MVP for about 100 concurrent players and roughly 3,000 input messages per second, and stakeholders need evidence that the single-region deployment can carry that load. Today there is no indexed soak harness or load profile proving the raw WebSocket path, room manager, match runner, and telemetry exporter behave under the beta concurrency envelope. When complete, a developer can run a local soak command and observe room creation, client.hello, 30 Hz client.input delivery, 20 Hz server.snapshot receipt, disconnect cleanup, and summary metrics for all simulated rooms. The harness should report p50, p95, and max snapshot interval per room, input rejection counts, WebSocket close codes, and match-breaking error totals. This story does not include public-scale load testing, multi-region testing, autoscaling implementation, or binary protocol optimization. It depends on room creation, token issuance, the WebSocket handshake, authoritative input processing, snapshot broadcasting, and telemetry event recording already being available. The implementation should be deterministic enough for CI smoke use while still allowing a longer manual soak run for SRE-style release validation.

| Field | Value |
|---|---|
| Story Points | 8 |
| Hours | 80h |
| Priority | P1 |
| Labels | epic:closed-beta-quality-gates, area:server-realtime, area:load-testing, area:observability, complexity:high |

**Acceptance Criteria**
- Running npm run soak:multiplayer --workspace packages/server-realtime -- --rooms=20 --playersPerRoom=5 --durationSeconds=120 executes packages/server-realtime/tests/soak/multiplayer-soak.ts and exits with code 0 when at least 20 rooms receive server.snapshot messages at an average rate of 20 Hz.
- The soak summary generated at packages/server-realtime/tests/artifacts/soak-summary.json contains roomsCreated=20, playersConnected=100, inputHzTarget=30, snapshotHzTarget=20, and matchBreakingErrors=0 fields.
- packages/server-realtime/tests/soak/multiplayer-soak.ts records every WebSocket client.hello response and fails the run if any connection receives a close code other than 1000 or the documented rate-limit close code from packages/server-realtime/src/WebSocketGateway.ts.
- packages/server-telemetry/src/events.ts receives non-sensitive room_started, snapshot_fanout_summary, disconnect, and match_breaking_error events during the soak run, and the committed assertion verifies no raw nickname or room token is present in packages/server-realtime/tests/artifacts/soak-summary.json.
- Unit tests written and passing: npm run test:unit --workspace packages/server-realtime executes packages/server-realtime/src/soak/metrics.test.ts and verifies p50, p95, max interval, and dropped snapshot calculations using deterministic timestamp fixtures.
- System integration tests written and passing: npm run test:integration --workspace packages/server-realtime executes packages/server-realtime/tests/integration/websocket-soak-boundary.test.ts with two rooms and validates POST /api/v1/rooms, client.hello, client.input, and server.snapshot boundaries.
- Mock data and fixtures generated and committed: packages/server-realtime/tests/fixtures/soakInputs.ts contains deterministic 30 Hz input sequences for movement, jump, climb, and idle cases without external dependencies.

**Depends on:** WO-028, WO-038, WO-041

### [P1] Validate reconciliation desync telemetry

Add integration tests between client-netcode and server-game for reconciliation thresholds and desync_correction telemetry so fairness regressions are caught before closed-beta sessions. The work belongs in packages/client-netcode/src/Reconciler.ts, packages/server-game/src/MatchRunner.ts, and packages/server-telemetry/src/events.ts, with cross-package tests in packages/client-netcode/tests/integration/reconciliation-desync.test.ts. This matters because players will only trust the rescue race if client prediction corrections are bounded, observable, and reported without exposing personal data. Today the architecture calls for prediction, server-authoritative snapshots, and desync correction metrics, but the indexed repository has no test proving the client and server agree on correction thresholds or telemetry shape. When complete, deterministic integration tests will feed predicted local states, authoritative server snapshots, and controlled drift values through the actual reconciliation path. The tests must assert that corrections below threshold do not emit desync_correction telemetry, corrections above threshold do emit it with room hash and player slot only, and severe drift can be classified for beta reporting. This story does not include rewriting movement physics, changing snapshot frequency, adding binary protocol support, or implementing dashboards. It depends on shared protocol schemas, deterministic server simulation, client prediction, authoritative snapshot delivery, and telemetry validation already being implemented. The implementation should keep correction calculations pure and separately testable so operations can correlate field telemetry with reproducible integration cases.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:closed-beta-quality-gates, area:client-netcode, area:server-game, area:telemetry, complexity:medium |

**Acceptance Criteria**
- Running npm run test:integration --workspace packages/client-netcode executes packages/client-netcode/tests/integration/reconciliation-desync.test.ts and verifies Reconciler.applyServerSnapshot does not emit desync_correction when correctionDistance is below the threshold exported by packages/client-netcode/src/Reconciler.ts.
- packages/client-netcode/tests/integration/reconciliation-desync.test.ts asserts Reconciler.applyServerSnapshot emits a desync_correction event through packages/server-telemetry/src/events.ts when the authoritative position from packages/server-game/src/MatchRunner.ts exceeds the configured threshold.
- The desync_correction assertion in packages/client-netcode/tests/integration/reconciliation-desync.test.ts verifies the telemetry payload contains roomHash, playerSlot, correctionDistance, tick, and severity fields, and does not contain nickname, roomCode, or roomToken fields.
- Running npm run test:unit --workspace packages/client-netcode executes packages/client-netcode/src/Reconciler.test.ts and validates exact threshold boundary behavior for correctionDistance equal to, one unit below, and one unit above the exported threshold.
- Unit tests written and passing: packages/server-telemetry/src/events.test.ts validates desync_correction event schema rejection for negative correctionDistance and missing tick values.
- System integration tests written and passing: packages/client-netcode/tests/integration/reconciliation-desync.test.ts drives client prediction against server authoritative snapshots across the package boundary without using browser rendering.
- Mock data and fixtures generated and committed: packages/client-netcode/tests/fixtures/reconciliationSnapshots.ts contains predicted-state and authoritative-snapshot fixtures for below-threshold, threshold-boundary, above-threshold, and severe-drift cases.

**Depends on:** WO-040, WO-041

### [P1] Handle match interruption recovery

Implement the client-netcode match interruption recovery message and server-telemetry match_breaking_error validation so the accepted in-memory crash-loss risk is visible to players and measurable by operators. The work belongs in packages/client-netcode/src/GameSocketClient.ts, packages/client-web/src/components/StructuredError.tsx, packages/server-telemetry/src/events.ts, and packages/server-game/src/MatchRunner.ts. This matters because the closed-beta architecture explicitly accepts that active matches can be lost on server crash, but testers must receive a clear recovery path and the operations team must count those incidents against the match-breaking error guardrail. Today the architecture describes crash-loss risk and match-breaking telemetry, but the indexed repository has no recovery message contract or telemetry validation ensuring the incident is captured safely. When complete, a dropped or reset match connection can produce a typed match.interrupted client state, the UI can show a recovery message with return-to-lobby or create-new-room action, and the server can emit a validated match_breaking_error event. The telemetry validator must require non-sensitive fields such as roomHash, matchId, reason, tick, and recoverable while rejecting raw room codes, tokens, nicknames, and stack traces. This story does not include persistent match restoration, Redis-backed room recovery, multi-replica room sharding, or guaranteed reconnection after a process crash. It depends on WebSocket connection lifecycle handling, shared protocol messages, structured client errors, match lifecycle telemetry, and the closed-beta sign-off metrics already existing. The implementation should turn a known reliability trade-off into an observable, debuggable, and user-comprehensible failure mode.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:closed-beta-quality-gates, area:client-netcode, area:server-telemetry, area:reliability, complexity:medium |

**Acceptance Criteria**
- Running npm run test:unit --workspace packages/client-netcode executes packages/client-netcode/src/GameSocketClient.test.ts and verifies an abnormal WebSocket close during an active match emits a match.interrupted state with reason=connection_lost and recoverable=false.
- packages/client-web/src/components/StructuredError.test.ts verifies the match interruption state renders a user-facing message containing return to lobby and create new room actions without exposing stack traces, roomToken, or raw roomCode.
- Running npm run test:unit --workspace packages/server-telemetry executes packages/server-telemetry/src/events.test.ts and verifies validateTelemetryEvent accepts match_breaking_error payloads with roomHash, matchId, reason, tick, recoverable, and timestamp.
- packages/server-telemetry/src/events.test.ts verifies validateTelemetryEvent rejects match_breaking_error payloads containing nickname, roomCode, roomToken, stack, or secret fields.
- packages/server-game/src/MatchRunner.test.ts verifies a simulated unrecoverable match interruption emits one match_breaking_error telemetry event and marks the match outcome as interrupted rather than completed.
- Unit tests written and passing: npm run test:unit --workspace packages/client-netcode, npm run test:unit --workspace packages/client-web, npm run test:unit --workspace packages/server-game, and npm run test:unit --workspace packages/server-telemetry cover the new interruption and telemetry paths.
- System integration tests written and passing: npm run test:integration --workspace packages/server-realtime executes packages/server-realtime/tests/integration/match-interruption.test.ts and verifies a closed WebSocket gateway path results in client match.interrupted state plus server match_breaking_error telemetry.
- Mock data and fixtures generated and committed: packages/server-telemetry/tests/fixtures/matchBreakingErrors.ts and packages/client-netcode/tests/fixtures/interruptionFrames.ts contain safe interruption scenarios without external services.

**Depends on:** WO-032, WO-040, WO-041

### [P1] Automate beta sign-off reporting

Add closed-beta sign-off report tests for match completion, repeat-match, valid join within 10 seconds, match-breaking error rate, and legal/IP gate fields so release decisions are based on repeatable evidence rather than ad hoc review. The work belongs in packages/server-telemetry/src/BetaSignoffReport.ts, packages/server-telemetry/src/events.ts, and packages/server-telemetry/tests/beta-signoff-report.test.ts. This matters because the product can only move beyond invited testing when stakeholders can verify reliability, replay value, onboarding speed, error guardrails, accessibility evidence, privacy posture, and legal/IP readiness. Today the architecture identifies these metrics and gates, but the indexed repository has no automated report validator or fixture set proving the calculations. When complete, a developer can run a telemetry test command and see deterministic report output with pass/fail fields for match completion rate, repeat-match rate, valid joins under 10 seconds, match-breaking error rate below the target, and legal/IP review status fields. The tests must use privacy-minimal fixture events and must reject reports missing public-release legal/IP gate fields even if gameplay metrics are green. This story does not include building a BI dashboard, provisioning Azure Blob lifecycle policies, collecting real tester survey data, or making the sponsor go/no-go decision. It depends on telemetry events for room joins, match starts, match ends, repeat matches, match-breaking errors, privacy/compliance evidence, and legal/IP gate metadata already being defined. The implementation should make the report artifact suitable for CI and operations review while keeping personally identifiable data out of summaries.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P1 |
| Labels | epic:closed-beta-quality-gates, area:server-telemetry, area:reporting, area:release-gate, complexity:medium |

**Acceptance Criteria**
- Running npm run test:unit --workspace packages/server-telemetry executes packages/server-telemetry/tests/beta-signoff-report.test.ts and verifies calculateBetaSignoffReport in packages/server-telemetry/src/BetaSignoffReport.ts computes matchCompletionRate from match_started and match_ended events.
- packages/server-telemetry/tests/beta-signoff-report.test.ts verifies calculateBetaSignoffReport marks validJoinWithin10Seconds as true only when join_completed timestamps are within 10000 milliseconds of join_attempt for POST /api/v1/rooms/{code}/join.
- packages/server-telemetry/tests/beta-signoff-report.test.ts verifies matchBreakingErrorRate is below 0.02 when match_breaking_error events divided by match_started events is less than the guardrail and false when it is equal to or above 0.02.
- packages/server-telemetry/tests/beta-signoff-report.test.ts asserts the generated report object contains legalIpReviewStatus, approvedPublicNames, approvedPublicLikenesses, privacyGateStatus, accessibilityGateStatus, and releaseCandidateId fields.
- Unit tests written and passing: packages/server-telemetry/tests/beta-signoff-report.test.ts covers green, join-SLO-failing, match-breaking-error-failing, and missing-legal-gate scenarios using deterministic event fixtures.
- System integration tests written and passing: npm run test:integration --workspace packages/server-telemetry executes packages/server-telemetry/tests/integration/beta-report-from-jsonl.test.ts and validates JSONL telemetry input from packages/server-telemetry/tests/fixtures/betaTelemetry.jsonl.
- Mock data and fixtures generated and committed: packages/server-telemetry/tests/fixtures/betaTelemetry.jsonl and packages/server-telemetry/tests/fixtures/legalGateStates.json contain non-sensitive sample events and gate states without nicknames, room tokens, or room codes.

**Depends on:** WO-050, WO-051

### [P0] Automate accessibility regression coverage

Add automated axe and keyboard-navigation accessibility tests for LandingRoomEntry, MultiplayerLobby, structured errors, RaceHUD, and MatchResults so closed-beta testers can use the core flow without mouse-only blockers or silent screen-reader failures. The work belongs in packages/client-web/tests/accessibility/core-screens.a11y.spec.ts and the component files packages/client-web/src/pages/LandingRoomEntry.tsx, packages/client-web/src/pages/MultiplayerLobby.tsx, packages/client-web/src/components/StructuredError.tsx, packages/client-web/src/components/RaceHUD.tsx, and packages/client-web/src/components/MatchResults.tsx. This matters because accessibility coverage for landing, lobby, errors, HUD, and results is a stated beta sign-off gate, and failing it would block broader release even if gameplay is fun. Today the architecture requires WCAG 2.1 AA-aligned menus and status messages, but the indexed project has no axe automation or keyboard traversal checks. When complete, a developer can run the accessibility suite and verify that the main interactive path has no serious axe violations, visible focus moves through controls in a predictable order, and structured errors are announced. The tests must include non-color-only player identification, status region semantics, keyboard activation of ready/start controls, and result-screen navigation. This story does not include manual accessibility audits, localization, gamepad navigation, or redesign of the 3D scene controls. It depends on the core UI screens, structured error components, and HUD/results components already existing. The implementation should treat accessibility automation as an operational release gate, not as optional UI polish.

| Field | Value |
|---|---|
| Story Points | 5 |
| Hours | 50h |
| Priority | P0 |
| Labels | epic:closed-beta-quality-gates, area:client-web, area:accessibility, area:quality-gate, complexity:medium |

**Acceptance Criteria**
- Running npm run test:a11y --workspace packages/client-web executes packages/client-web/tests/accessibility/core-screens.a11y.spec.ts and reports zero axe violations with impact serious or critical for packages/client-web/src/pages/LandingRoomEntry.tsx.
- packages/client-web/tests/accessibility/core-screens.a11y.spec.ts verifies keyboard Tab order can reach nickname input, create-room button, room-code input, join-room button, ready button, and start-match button in packages/client-web/src/pages/MultiplayerLobby.tsx without using mouse events.
- The accessibility test for packages/client-web/src/components/StructuredError.tsx asserts invalid room-code and full-room messages are exposed through role=alert or aria-live status text and include a recovery action label.
- The accessibility test for packages/client-web/src/components/RaceHUD.tsx asserts player identity is represented by a non-color text label or aria-label in addition to color, and the test fixture includes at least five player slots.
- The accessibility test for packages/client-web/src/components/MatchResults.tsx asserts the result heading is focusable after navigation and a repeat-match or return-to-lobby control is keyboard activatable with Enter.
- Unit tests written and passing: npm run test:unit --workspace packages/client-web executes component tests for StructuredError, RaceHUD, and MatchResults that assert role, aria-label, and focus-management props.
- System integration tests written and passing: npm run test:a11y --workspace packages/client-web uses Playwright plus axe against rendered pages and validates browser-level keyboard navigation.
- Mock data and fixtures generated and committed: packages/client-web/tests/fixtures/accessibilityStates.ts contains landing, lobby, error, HUD, and match-results states including five distinct player identifiers.

**Depends on:** WO-062, WO-060