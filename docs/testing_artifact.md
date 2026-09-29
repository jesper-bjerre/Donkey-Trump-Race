# Testing

**Selected Categories:** Functional test cases

**Total Test Cases:** 63


---

## Functional test cases (63)

### FUNCTIONAL-001 — Scaffold TypeScript workspace packages

- User Story: WO-001
- Objective: Validate functional behavior for "Scaffold TypeScript workspace packages" against acceptance criteria.
- Expected: Story "Scaffold TypeScript workspace packages" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running pnpm install --frozen-lockfile from the repository root creates node_modules and exits with code 0 using package.json, pnpm-workspace.yaml, and pnpm-lock.yaml.
- Check acceptance criterion 2: File inspection confirms pnpm-workspace.yaml includes packages/* and that package.json defines workspaces-compatible scripts for build, typecheck, test, lint, and format:check.
- Check acceptance criterion 3: File inspection confirms packages/client-web/package.json, packages/client-renderer/package.json, packages/client-netcode/package.json, packages/server-api/package.json, packages/server-realtime/package.json, packages/server-game/package.json, packages/shared-protocol/package.json, packages/shared-simulation/package.json, packages/shared-level/package.json, packages/shared-items/package.json, packages/server-telemetry/package.json, and infra/README.md exist.

### FUNCTIONAL-002 — Configure strict workspace quality gates

- User Story: WO-002
- Objective: Validate functional behavior for "Configure strict workspace quality gates" against acceptance criteria.
- Expected: Story "Configure strict workspace quality gates" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms .nvmrc contains 22 and package.json engines.node requires Node.js 22 compatible versions.
- Check acceptance criterion 2: Running pnpm install --frozen-lockfile exits with code 0 and does not modify pnpm-lock.yaml.
- Check acceptance criterion 3: Running pnpm typecheck exits with code 0 and tsconfig.base.json contains strict: true, noImplicitAny: true, strictNullChecks: true, and noUncheckedIndexedAccess: true.

### FUNCTIONAL-003 — Define Azure Terraform platform modules

- User Story: WO-003
- Objective: Validate functional behavior for "Define Azure Terraform platform modules" against acceptance criteria.
- Expected: Story "Define Azure Terraform platform modules" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms infra/azure/providers.tf pins the azurerm provider and configures Terraform required_version without hardcoded Azure subscription IDs, tenant IDs, client secrets, or storage connection strings.
- Check acceptance criterion 2: Running terraform fmt -check -recursive infra/azure exits with code 0 from a developer environment with Terraform installed.
- Check acceptance criterion 3: Running terraform -chdir=infra/azure init -backend=false exits with code 0 and running terraform -chdir=infra/azure validate exits with code 0 using only checked-in variables and no real Azure credentials.

### FUNCTIONAL-004 — Automate validation workflow

- User Story: WO-004
- Objective: Validate functional behavior for "Automate validation workflow" against acceptance criteria.
- Expected: Story "Automate validation workflow" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms .github/workflows/validate.yml exists and has on.pull_request and on.push triggers for main.
- Check acceptance criterion 2: File inspection confirms .github/workflows/validate.yml uses actions/setup-node with node-version 22 and pnpm/action-setup with a pnpm version compatible with package.json.
- Check acceptance criterion 3: File inspection confirms the install step in .github/workflows/validate.yml runs pnpm install --frozen-lockfile from the repository root.

### FUNCTIONAL-005 — Containerize Node runtime services

- User Story: WO-005
- Objective: Validate functional behavior for "Containerize Node runtime services" against acceptance criteria.
- Expected: Story "Containerize Node runtime services" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running pnpm --filter @donkey-trump-race/server-api test:unit or pnpm test:unit executes packages/server-api/src/health.test.ts and asserts GET /healthz returns status code 200 with body property status equal to ok.
- Check acceptance criterion 2: Running pnpm --filter @donkey-trump-race/server-realtime test:unit or pnpm test:unit executes packages/server-realtime/src/health.test.ts and asserts GET /healthz returns status code 200 with body property status equal to ok.
- Check acceptance criterion 3: Running pnpm --filter @donkey-trump-race/server-api build and pnpm --filter @donkey-trump-race/server-realtime build exits with code 0 and emits compiled JavaScript under each package build output directory.

### FUNCTIONAL-006 — Automate environment deployments

- User Story: WO-010
- Objective: Validate functional behavior for "Automate environment deployments" against acceptance criteria.
- Expected: Story "Automate environment deployments" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms .github/workflows/deploy.yml exists with triggers for push to main and workflow_dispatch with an environment input limited to dev, staging, or production.
- Check acceptance criterion 2: File inspection confirms .github/workflows/deploy.yml defines jobs or steps that run pnpm install --frozen-lockfile, pnpm lint, pnpm format:check, pnpm typecheck, pnpm test:unit, and pnpm build before any deploy job.
- Check acceptance criterion 3: File inspection confirms .github/workflows/deploy.yml builds images using packages/server-api/Dockerfile and packages/server-realtime/Dockerfile and tags them with the GitHub SHA or a similarly immutable revision identifier.

### FUNCTIONAL-007 — Create shared protocol schemas

- User Story: WO-006
- Objective: Validate functional behavior for "Create shared protocol schemas" against acceptance criteria.
- Expected: Story "Create shared protocol schemas" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-protocol executes packages/shared-protocol/test/protocolSchemas.test.ts and asserts validateClientInput rejects a movement axis outside -1..1, validateRoomTokenClaims rejects an expired exp value, and validateServerSnapshot accepts a committed fixture from packages/shared-protocol/test/fixtures/serverSnapshot.v1.json.
- Check acceptance criterion 2: System integration tests: running npm test --workspace packages/shared-protocol -- protocolCompatibility executes packages/shared-protocol/test/protocolCompatibility.test.ts and round-trips client.hello, client.input, server.snapshot, and server.error JSON fixtures through parseWebSocketMessage without changing the message type field or protocolVersion value.
- Check acceptance criterion 3: Mock data/fixtures: file inspection confirms packages/shared-protocol/test/fixtures contains roomTokenClaims.valid.json, clientInput.valid.json, serverSnapshot.v1.json, restErrorEnvelope.invalidNickname.json, and websocketServerError.tokenViolation.json with no raw secrets and no nickname beyond safe sample values.

### FUNCTIONAL-008 — Add shared error catalog

- User Story: WO-007
- Objective: Validate functional behavior for "Add shared error catalog" against acceptance criteria.
- Expected: Story "Add shared error catalog" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-errors executes packages/shared-errors/test/errorCatalog.test.ts and asserts INVALID_NICKNAME maps to statusCode 400, INVALID_ROOM_CODE maps to 404, ROOM_FULL maps to 409, ROOM_EXPIRED maps to 410, ROOM_IN_PROGRESS maps to 409, TOKEN_VIOLATION maps to 401 or 403 by violation type, and RATE_LIMITED maps to 429.
- Check acceptance criterion 2: System integration tests: running npm test --workspace packages/shared-errors -- envelopeCompatibility executes packages/shared-errors/test/envelopeCompatibility.test.ts and asserts createErrorEnvelope('ROOM_FULL') serializes to JSON with fields error.code, error.message, error.recoveryAction, requestId, and statusCode without stack or details.secret fields.
- Check acceptance criterion 3: Mock data/fixtures: file inspection confirms packages/shared-errors/test/fixtures contains invalidNickname.json, invalidRoomCode.json, fullRoom.json, expiredRoom.json, inProgressRoom.json, tokenViolation.json, and rateLimited.json for downstream API and UI tests.

### FUNCTIONAL-009 — Model MVP vertical map metadata

- User Story: WO-008
- Objective: Validate functional behavior for "Model MVP vertical map metadata" against acceptance criteria.
- Expected: Story "Model MVP vertical map metadata" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-level executes packages/shared-level/test/mvpVerticalMap.test.ts and asserts MVP_VERTICAL_MAP.floors.length is at least 3, MVP_VERTICAL_MAP.ladders.length is at least 2, and every ladder connects two valid floorId values.
- Check acceptance criterion 2: System integration tests: running npm test --workspace packages/shared-level -- mapContract executes packages/shared-level/test/mapContract.test.ts and asserts getRescueZone(MVP_VERTICAL_MAP).id equals 'motzfeldt-rescue', getBossSpawn(MVP_VERTICAL_MAP).x is greater than getPlayableBounds(MVP_VERTICAL_MAP).rightFallEdgeX - 2, and getPlayableBounds(MVP_VERTICAL_MAP).leftWallX is less than every floor segment startX.
- Check acceptance criterion 3: Mock data/fixtures: file inspection confirms packages/shared-level/test/fixtures/mvpVerticalMap.json is committed and equals the serialized MVP_VERTICAL_MAP exported from packages/shared-level/src/maps/mvpVerticalMap.ts.

### FUNCTIONAL-010 — Implement deterministic movement helpers

- User Story: WO-014
- Objective: Validate functional behavior for "Implement deterministic movement helpers" against acceptance criteria.
- Expected: Story "Implement deterministic movement helpers" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-simulation executes packages/shared-simulation/test/movement.test.ts and asserts stepPlayerMovement cannot move a grounded player above the next floor using a half-height jump from packages/shared-simulation/test/fixtures/halfHeightJump.json.
- Check acceptance criterion 2: Unit tests: packages/shared-simulation/test/ladderTraversal.test.ts asserts stepPlayerMovement transitions a player upward only when the player position intersects a LadderVolume from packages/shared-level/src/maps/mvpVerticalMap.ts and climbY is positive.
- Check acceptance criterion 3: Unit tests: packages/shared-simulation/test/boundsCollision.test.ts asserts resolveFloorCollision places the player on the expected FloorSegment, blockLeftWall clamps x to getPlayableBounds(MVP_VERTICAL_MAP).leftWallX, and detectRightEdgeFall returns true when x exceeds rightFallEdgeX.

### FUNCTIONAL-011 — Define shared item effect schemas

- User Story: WO-015
- Objective: Validate functional behavior for "Define shared item effect schemas" against acceptance criteria.
- Expected: Story "Define shared item effect schemas" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-items executes packages/shared-items/test/itemSchemas.test.ts and asserts validateItemEffect accepts SELF_SPEED_BOOST and OPPONENT_STUN descriptors while rejecting unknown effectType values.
- Check acceptance criterion 2: Unit tests: packages/shared-items/test/pickupVolumes.test.ts asserts every MVP_ITEM_PICKUP_VOLUMES entry from packages/shared-items/src/pickups.ts has positive width, height, and depth and is inside getPlayableBounds(MVP_VERTICAL_MAP) from packages/shared-level/src/maps/mvpVerticalMap.ts.
- Check acceptance criterion 3: System integration tests: running npm test --workspace packages/shared-items -- protocolSerialization executes packages/shared-items/test/protocolSerialization.test.ts and asserts item pickup and held item fixtures serialize to JSON and validate against the shared protocol item state shape in packages/shared-protocol/src/schemas/snapshot.ts.

### FUNCTIONAL-012 — Add deterministic simulation fixtures

- User Story: WO-021
- Objective: Validate functional behavior for "Add deterministic simulation fixtures" against acceptance criteria.
- Expected: Story "Add deterministic simulation fixtures" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test --workspace packages/shared-simulation executes packages/shared-simulation/test/deterministicFixtures.test.ts and asserts fixtures ladderTraversal.json, halfHeightJump.json, and rightEdgeFall.json replay to the exact expected player states committed in packages/shared-simulation/test/fixtures/expected/*.json.
- Check acceptance criterion 2: Unit tests: packages/shared-simulation/test/itemPickupFixture.test.ts asserts itemPickup.json intersects the configured ItemPickupVolume from packages/shared-items/src/pickups.ts at the expected serverTick and produces the committed held item state in packages/shared-simulation/test/fixtures/expected/itemPickup.expected.json.
- Check acceptance criterion 3: Unit tests: packages/shared-simulation/test/barrelStunFixture.test.ts asserts barrelStun.json produces stunnedUntilMs - hitAtMs === 2000 and rejects movement inputs before stunnedUntilMs while accepting normal movement after stunnedUntilMs.

### FUNCTIONAL-013 — Build in-memory room lifecycle manager

- User Story: WO-012
- Objective: Validate functional behavior for "Build in-memory room lifecycle manager" against acceptance criteria.
- Expected: Story "Build in-memory room lifecycle manager" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts verifies RoomManager.createRoom, RoomManager.joinRoom, RoomManager.startRoom, RoomManager.releaseDisconnectedSlot, and RoomManager.purgeExpiredRooms.
- Check acceptance criterion 2: System integration tests: N/A — this story exposes an in-process server-room service only; cross-boundary HTTP and WebSocket integration is covered by the API and realtime stories that call RoomManager.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-room/src/__tests__/fixtures/roomFixtures.ts exports deterministic nicknames, color palette expectations, fake clock helpers, and sample room codes used by RoomManager.test.ts.

### FUNCTIONAL-014 — Create room API with host token

- User Story: WO-018
- Objective: Validate functional behavior for "Create room API with host token" against acceptance criteria.
- Expected: Story "Create room API with host token" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/roomTokens.test.ts validates room token signing, expiry, roomCode claim, playerSlotId claim, role claim, and rejection of tampered tokens.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.create.int.test.ts sends POST /api/v1/rooms with nickname LarsFan and asserts HTTP 201 plus response fields roomCode, playerId, slotIndex, color, role host, roomToken, and expiresAt.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts provides valid nickname, invalid nickname, deterministic token secret placeholder, and fake clock values for create-room tests.

### FUNCTIONAL-015 — Join room API with capacity checks

- User Story: WO-019
- Objective: Validate functional behavior for "Join room API with capacity checks" against acceptance criteria.
- Expected: Story "Join room API with capacity checks" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.join.mapping.test.ts verifies mapJoinRoomError returns HTTP 400 for INVALID_ROOM_CODE, HTTP 404 for ROOM_NOT_FOUND, HTTP 409 for ROOM_FULL, and HTTP 409 for ROOM_IN_PROGRESS.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.join.int.test.ts creates a room through POST /api/v1/rooms and joins it through POST /api/v1/rooms/{code}/join with HTTP 201.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts includes join request bodies, a full-room fixture, expired-room fixture setup, and invalid room-code examples.

### FUNCTIONAL-016 — Verify WebSocket hello and inputs

- User Story: WO-020
- Objective: Validate functional behavior for "Verify WebSocket hello and inputs" against acceptance criteria.
- Expected: Story "Verify WebSocket hello and inputs" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-realtime/src/__tests__/messageValidation.test.ts verifies parseClientMessage rejects unknown types, invalid client.input bounds, missing sequence numbers, and payloads over the configured byte cap.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-realtime/src/__tests__/clientHello.int.test.ts opens a WebSocket to the test server, sends client.hello with a valid roomToken, and asserts a server.welcome message for the expected roomCode and playerId.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-realtime/src/__tests__/fixtures/realtimeFixtures.ts includes valid hello, invalid token hello, oversize payload, heartbeat, and bounded input command examples.

### FUNCTIONAL-017 — Authorize host match start endpoint

- User Story: WO-023
- Objective: Validate functional behavior for "Authorize host match start endpoint" against acceptance criteria.
- Expected: Story "Authorize host match start endpoint" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.start.auth.test.ts verifies verifyStartAuthorization rejects missing Authorization header with HTTP 401, participant role with HTTP 403, mismatched roomCode claim with HTTP 403, and expired token with HTTP 401.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.start.int.test.ts creates a room, joins a second player, satisfies readiness, calls POST /api/v1/rooms/{code}/start, and asserts HTTP 200 with state in_progress.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-api/src/__tests__/fixtures/apiRoomFixtures.ts includes host token, participant token, expired token, not-ready roster, and one-player room fixtures.

### FUNCTIONAL-018 — Reserve slots during reconnect grace

- User Story: WO-025
- Objective: Validate functional behavior for "Reserve slots during reconnect grace" against acceptance criteria.
- Expected: Story "Reserve slots during reconnect grace" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-realtime/src/__tests__/ReconnectLeaseManager.test.ts verifies createLease, consumeLease, expireLeases, same-player matching, and 60-second expiry using a fake clock.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-realtime/src/__tests__/reconnectLease.int.test.ts authenticates a WebSocket, closes it, reconnects within 60 seconds using client.hello, and asserts server.welcome returns the same playerId, slotIndex, and color.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/server-realtime/src/__tests__/fixtures/reconnectFixtures.ts includes authenticated session claims, reconnect-within-grace timing, expired-lease timing, and wrong-player token examples.

### FUNCTIONAL-019 — Add room and realtime integration tests

- User Story: WO-037
- Objective: Validate functional behavior for "Add room and realtime integration tests" against acceptance criteria.
- Expected: Story "Add room and realtime integration tests" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests written and passing: running npm test -- packages/server-room/src/__tests__/RoomManager.test.ts packages/server-api/src/__tests__/roomTokens.test.ts packages/server-realtime/src/__tests__/messageValidation.test.ts succeeds as the prerequisite unit suite for lifecycle integration.
- Check acceptance criterion 2: System integration tests written and passing: running npm test -- packages/server-api/src/__tests__/rooms.lifecycle.int.test.ts packages/server-realtime/src/__tests__/realtime.lifecycle.int.test.ts validates create room, join room, start match, client.hello, heartbeat, and reconnect lease flows.
- Check acceptance criterion 3: Mock data and fixtures generated and committed: packages/test-fixtures/src/roomLifecycleFixtures.ts or packages/server-api/src/__tests__/fixtures/roomLifecycleFixtures.ts exports deterministic nicknames, invalid room codes, fake token secret placeholder, fake clock schedule, and WebSocket message samples.

### FUNCTIONAL-020 — Run authoritative fixed-tick matches

- User Story: WO-028
- Objective: Validate functional behavior for "Run authoritative fixed-tick matches" against acceptance criteria.
- Expected: Story "Run authoritative fixed-tick matches" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/matchRunner.test.ts exits with code 0 and includes assertions that MatchRunner.advanceTick increments tick at 60 Hz and MatchRunner.snapshotForRoom emits only every third tick for a 20 Hz snapshot cadence.
- Check acceptance criterion 2: System integration tests: running npm test -- --run packages/server-realtime/test/gameSocketGateway.matchRunner.int.test.ts exits with code 0 and verifies client.input messages sent through packages/server-realtime/src/GameSocketGateway.ts are validated, enqueued via MatchRunner.submitInput, and produce server.snapshot messages containing tick and players fields.
- Check acceptance criterion 3: Mock data and fixtures: packages/server-game/test/fixtures/matchRunnerRoom.fixture.ts is committed and exports a deterministic five-player room fixture with playerSlotId, color, and token claims used by packages/server-game/test/matchRunner.test.ts.

### FUNCTIONAL-021 — Simulate authoritative player movement

- User Story: WO-038
- Objective: Validate functional behavior for "Simulate authoritative player movement" against acceptance criteria.
- Expected: Story "Simulate authoritative player movement" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/playerState.movement.test.ts exits with code 0 and asserts PlayerState.applyInput cannot move x below levelMetadata.bounds.leftWallX.
- Check acceptance criterion 2: Unit tests: packages/server-game/test/playerState.jump.test.ts includes an assertion named halfHeightJumpDoesNotReachNextFloor that verifies PlayerState.applyInput plus MatchRunner.advanceTick never raises y to the next floor height from a standing jump.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.playerSpawn.int.test.ts exits with code 0 and verifies MatchRunner.start creates exactly one PlayerState per occupied lobby slot with the expected color in the server.snapshot players array.

### FUNCTIONAL-022 — Spawn boss barrel hazards

- User Story: WO-039
- Objective: Validate functional behavior for "Spawn boss barrel hazards" against acceptance criteria.
- Expected: Story "Spawn boss barrel hazards" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-boss/test/bossAI.test.ts exits with code 0 and verifies BossAI.createInitialState places boss.position.x equal to levelMetadata.bossPlatform.farRightX.
- Check acceptance criterion 2: Unit tests: packages/server-boss/test/bossAI.test.ts includes an assertion named spawnsBarrelAtConfiguredTickInterval that verifies BossAI.advanceTick creates barrel hazards at the configured spawn interval and not on intermediate ticks.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.bossHazards.int.test.ts exits with code 0 and verifies MatchRunner.snapshotForRoom includes hazards with id, type "barrel", position, velocity, radius, and active fields after BossAI spawn ticks.

### FUNCTIONAL-023 — Confirm rescue finish order

- User Story: WO-044
- Objective: Validate functional behavior for "Confirm rescue finish order" against acceptance criteria.
- Expected: Story "Confirm rescue finish order" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/rescueObjective.test.ts exits with code 0 and verifies RescueObjective.checkCompletion records a player only when PlayerState capsule intersects levelMetadata.objectives.rescueZone.
- Check acceptance criterion 2: Unit tests: packages/server-game/test/rescueObjective.test.ts includes an assertion named sameTickArrivalUsesStableSlotOrder that verifies two same-tick finishers are sorted by playerSlotId when finishTick is equal.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.rescue.int.test.ts exits with code 0 and verifies MatchRunner.snapshotForRoom includes finishOrder with rank, playerSlotId, finishTick, and serverTimeMs after a player enters the rescue zone.

### FUNCTIONAL-024 — Resolve side-impact shoves

- User Story: WO-045
- Objective: Validate functional behavior for "Resolve side-impact shoves" against acceptance criteria.
- Expected: Story "Resolve side-impact shoves" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-collision/test/playerShoveSystem.test.ts exits with code 0 and verifies PlayerShoveSystem.resolveSideImpacts changes the impacted player's x velocity or position when a moving player contacts from the side.
- Check acceptance criterion 2: Unit tests: packages/server-collision/test/playerShoveSystem.test.ts includes an assertion named resolvesTenPairsForFivePlayers that verifies exactly ten unique player pairs are evaluated for a five-player fixture.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.playerShove.int.test.ts exits with code 0 and verifies server.snapshot players contains the shoved player's changed position after MatchRunner.advanceTick.

### FUNCTIONAL-025 — Respawn right-edge falls

- User Story: WO-046
- Objective: Validate functional behavior for "Respawn right-edge falls" against acceptance criteria.
- Expected: Story "Respawn right-edge falls" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/fallRespawnSystem.test.ts exits with code 0 and verifies FallRespawnSystem.detectFall returns true when player.position.x exceeds levelMetadata.bounds.rightFallX.
- Check acceptance criterion 2: Unit tests: packages/server-game/test/fallRespawnSystem.test.ts includes an assertion named respawnPointIsInsidePlayableBounds that verifies applyRespawn places the player between leftWallX and rightFallX on a defined floor.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.fallRespawn.int.test.ts exits with code 0 and verifies server.snapshot shows fallPenalty true and movementDisabledUntilMs after a player crosses the right edge during MatchRunner.advanceTick.

### FUNCTIONAL-026 — Apply authoritative item effects

- User Story: WO-047
- Objective: Validate functional behavior for "Apply authoritative item effects" against acceptance criteria.
- Expected: Story "Apply authoritative item effects" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/itemSystem.test.ts exits with code 0 and verifies ItemSystem.resolvePickups awards an item when PlayerState capsule intersects an active pickup volume from packages/shared-items/src/itemDefinitions.ts.
- Check acceptance criterion 2: Unit tests: packages/server-game/test/itemSystem.test.ts includes assertions that ItemSystem.useItem applies a self speedBoost status to the owning PlayerState and applies an opponent slow status to a different PlayerState.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.items.int.test.ts exits with code 0 and verifies a client.input useItem command consumed by MatchRunner changes the relevant PlayerSnapshot status fields in server.snapshot.

### FUNCTIONAL-027 — Apply barrel knockdown stun

- User Story: WO-048
- Objective: Validate functional behavior for "Apply barrel knockdown stun" against acceptance criteria.
- Expected: Story "Apply barrel knockdown stun" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-collision/test/barrelCollisionSystem.test.ts exits with code 0 and verifies BarrelCollisionSystem.resolveHits sets player.status.knockedDown to true and player.status.starEffect to true on capsule-to-barrel intersection.
- Check acceptance criterion 2: Unit tests: packages/server-collision/test/barrelCollisionSystem.test.ts includes an assertion named stunDurationIsExactly2000Ms that verifies movementDisabledUntilMs equals hitServerTimeMs + 2000.
- Check acceptance criterion 3: System integration tests: running npm test -- --run packages/server-game/test/matchRunner.barrelStun.int.test.ts exits with code 0 and verifies MatchRunner ignores movement input for a hit player until the first tick at or after movementDisabledUntilMs.

### FUNCTIONAL-028 — Cover deterministic match systems

- User Story: WO-058
- Objective: Validate functional behavior for "Cover deterministic match systems" against acceptance criteria.
- Expected: Story "Cover deterministic match systems" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- --run packages/server-game/test/deterministicMatchScenarios.test.ts exits with code 0 and includes assertions for rescue finish ordering, barrel stun duration, side shove displacement, fall respawn penalty, and item effect application.
- Check acceptance criterion 2: System integration tests: packages/server-game/test/deterministicMatchScenarios.test.ts drives packages/server-game/src/MatchRunner.ts through public start, submitInput, advanceTick, and snapshotForRoom methods rather than calling private internals directly.
- Check acceptance criterion 3: Mock data and fixtures: packages/server-game/test/fixtures/deterministicMatchScenarios.fixture.ts is committed and exports deterministic room roster, level metadata references, barrel hazard setup, shove setup, fall setup, rescue setup, and item setup data.

### FUNCTIONAL-029 — Build guest room entry screen

- User Story: WO-024
- Objective: Validate functional behavior for "Build guest room entry screen" against acceptance criteria.
- Expected: Story "Build guest room entry screen" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes an assertion in client-web/src/screens/__tests__/LandingRoomEntry.test.tsx that getByRole("heading", { name: "Donkey Trump Race" }) is present in client-web/src/screens/LandingRoomEntry.tsx.
- Check acceptance criterion 2: Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes assertions that client-web/src/screens/LandingRoomEntry.tsx renders form controls with accessible names "Nickname", "Room code", "Create room", and "Join room".
- Check acceptance criterion 3: Running npm test --workspace client-web -- LandingRoomEntry.test.tsx includes an assertion that the nickname fixture value "Jumpman Løkke" from client-web/src/test/fixtures/roomEntryFixtures.ts is displayed unchanged after typing into the nickname input.

### FUNCTIONAL-030 — Build multiplayer lobby screen

- User Story: WO-031
- Objective: Validate functional behavior for "Build multiplayer lobby screen" against acceptance criteria.
- Expected: Story "Build multiplayer lobby screen" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- MultiplayerLobby.test.tsx includes an assertion that client-web/src/screens/MultiplayerLobby.tsx renders the room code fixture "A7K2Q" from client-web/src/test/fixtures/lobbyFixtures.ts in an element with accessible name "Room code".
- Check acceptance criterion 2: Running npm test --workspace client-web -- LobbyRoster.test.tsx verifies client-web/src/components/lobby/LobbyRoster.tsx renders exactly 5 slot rows when lobbyFixtures.maxCapacity is 5, including occupied and empty slot states.
- Check acceptance criterion 3: Running npm test --workspace client-web -- LobbyRoster.test.tsx includes assertions that each occupied player row renders both player.colorLabel and player.slotLabel from client-web/src/test/fixtures/lobbyFixtures.ts rather than relying only on CSS color.

### FUNCTIONAL-031 — Implement entry error recovery

- User Story: WO-032
- Objective: Validate functional behavior for "Implement entry error recovery" against acceptance criteria.
- Expected: Story "Implement entry error recovery" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps HTTP 400 with error.code "INVALID_NICKNAME" to focusTarget "nickname" and action "edit-nickname".
- Check acceptance criterion 2: Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps HTTP 404 with error.code "INVALID_ROOM_CODE" to focusTarget "roomCode" and action "retry-room-code".
- Check acceptance criterion 3: Running npm test --workspace client-web -- roomEntryErrorMapper.test.ts verifies client-web/src/errors/roomEntryErrorMapper.ts maps error.code "ROOM_EXPIRED", "ROOM_FULL", and "ROOM_IN_PROGRESS" to recovery actions "create-new-room", "retry-later", and "return-to-entry" respectively.

### FUNCTIONAL-032 — Add help and privacy modal

- User Story: WO-033
- Objective: Validate functional behavior for "Add help and privacy modal" against acceptance criteria.
- Expected: Story "Add help and privacy modal" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies client-web/src/components/help/HelpPrivacyModal.tsx renders text containing "keyboard", "guest", "nickname", "room code", and "telemetry".
- Check acceptance criterion 2: Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies the privacy notice link in client-web/src/components/help/HelpPrivacyModal.tsx has href="/privacy" and accessible name "Privacy notice".
- Check acceptance criterion 3: Running npm test --workspace client-web -- HelpPrivacyModal.test.tsx verifies pressing Escape calls onClose exactly once for the open modal in client-web/src/components/help/HelpPrivacyModal.tsx.

### FUNCTIONAL-033 — Build match results screen

- User Story: WO-056
- Objective: Validate functional behavior for "Build match results screen" against acceptance criteria.
- Expected: Story "Build match results screen" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- MatchResults.test.tsx verifies client-web/src/screens/MatchResults.tsx renders rescueOrder from client-web/src/test/fixtures/matchResultsFixtures.ts in the same order as the fixture array.
- Check acceptance criterion 2: Running npm test --workspace client-web -- RaceHighlights.test.tsx verifies client-web/src/components/results/RaceHighlights.tsx renders fixture highlight counts for barrelHits, falls, itemUses, and disconnects.
- Check acceptance criterion 3: Running npm test --workspace client-web -- MatchResults.test.tsx verifies the replay button in client-web/src/screens/MatchResults.tsx is disabled when resultActions.canReplay is false and enabled when resultActions.canReplay is true.

### FUNCTIONAL-034 — Harden UI accessibility coverage

- User Story: WO-062
- Objective: Validate functional behavior for "Harden UI accessibility coverage" against acceptance criteria.
- Expected: Story "Harden UI accessibility coverage" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm test --workspace client-web -- accessibilityTokens.test.ts verifies client-web/src/styles/accessibilityTokens.css exports focus, surface, text, warning, success, and player identifier tokens referenced by client-web/src/accessibility/accessibilityTokens.ts.
- Check acceptance criterion 2: Running npm test --workspace client-web -- screenReaderLabels.test.tsx verifies client-web/src/screens/LandingRoomEntry.tsx, client-web/src/screens/MultiplayerLobby.tsx, client-web/src/components/recovery/RoomEntryRecovery.tsx, and client-web/src/screens/MatchResults.tsx expose named landmarks or regions for their primary content.
- Check acceptance criterion 3: Running npm test --workspace client-web -- nonColorPlayerIdentifiers.test.tsx verifies client-web/src/components/lobby/LobbyRoster.tsx and client-web/src/components/results/RescueOrderList.tsx render each player with a slot label such as "Player 1" in addition to any color label.

### FUNCTIONAL-035 — Bootstrap MVP Three.js race scene

- User Story: WO-034
- Objective: Validate functional behavior for "Bootstrap MVP Three.js race scene" against acceptance criteria.
- Expected: Story "Bootstrap MVP Three.js race scene" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-renderer/src/ThreeScene.ts exports createThreeScene and the returned scene contains object names mvp.floor.*, mvp.ladder.*, mvp.leftWall, mvp.rightFallEdge, mvp.rescuePoint, and mvp.title.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-renderer -- ThreeScene.test.ts exits with code 0 and includes assertions that packages/client-renderer/src/__tests__/ThreeScene.test.ts finds at least three floor meshes and at least two ladder meshes.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/shared-level -- mvpLevel.test.ts exits with code 0 and packages/shared-level/src/__tests__/mvpLevel.test.ts asserts the left wall x boundary is less than the start position and the right fall edge x boundary is greater than the start position.

### FUNCTIONAL-036 — Implement predictive WebSocket client

- User Story: WO-040
- Objective: Validate functional behavior for "Implement predictive WebSocket client" against acceptance criteria.
- Expected: Story "Implement predictive WebSocket client" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-netcode/src/WebSocketGameClient.ts exports WebSocketGameClient with connect, disconnect, sendInput, subscribeToSnapshots, and getConnectionMetrics methods.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-netcode -- prediction.test.ts exits with code 0 and packages/client-netcode/src/__tests__/prediction.test.ts asserts local input replay produces deterministic position and velocity values for committed fixtures.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-netcode -- reconciliation.test.ts exits with code 0 and asserts corrections below the configured threshold do not snap local state while corrections above the threshold update predicted state and record correctionDistance.

### FUNCTIONAL-037 — Render colored Jumpman placeholders

- User Story: WO-043
- Objective: Validate functional behavior for "Render colored Jumpman placeholders" against acceptance criteria.
- Expected: Story "Render colored Jumpman placeholders" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-renderer/src/JumpmanLokkeMesh.ts exports createJumpmanLokkeMesh and updateJumpmanLokkeMesh, and each returned root group name begins with player.jumpman.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-renderer -- JumpmanLokkeMesh.test.ts exits with code 0 and asserts five created meshes have five distinct material color values.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-renderer -- JumpmanLokkeMesh.test.ts exits with code 0 and asserts each mesh includes a non-color label child named player.label with the provided displayName or slot label.

### FUNCTIONAL-038 — Interpolate remote player snapshots

- User Story: WO-049
- Objective: Validate functional behavior for "Interpolate remote player snapshots" against acceptance criteria.
- Expected: Story "Interpolate remote player snapshots" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-netcode/src/interpolation.ts exports createRemotePlayerInterpolator with addSnapshot, sampleRemotePlayers, pruneBeforeTick, and getInterpolationMetrics methods.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-netcode -- interpolation.test.ts exits with code 0 and packages/client-netcode/src/__tests__/interpolation.test.ts asserts position interpolation between two snapshot.playerStates samples within numeric tolerances.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-netcode -- interpolation.test.ts exits with code 0 and asserts localPlayerId is excluded from remote interpolation output.

### FUNCTIONAL-039 — Add third-person follow camera

- User Story: WO-055
- Objective: Validate functional behavior for "Add third-person follow camera" against acceptance criteria.
- Expected: Story "Add third-person follow camera" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-renderer/src/MarioKartCamera.ts exports createMarioKartCameraController with updateCameraFollow and resetCameraFollow methods.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-renderer -- MarioKartCamera.test.ts exits with code 0 and asserts updateCameraFollow places the camera behind and above a local player transform within configured numeric tolerances.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-renderer -- MarioKartCamera.test.ts exits with code 0 and asserts a large authoritative correction is smoothed over multiple updates rather than applying the full delta in one frame.

### FUNCTIONAL-040 — Display item pickups and power HUD

- User Story: WO-057
- Objective: Validate functional behavior for "Display item pickups and power HUD" against acceptance criteria.
- Expected: Story "Display item pickups and power HUD" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-renderer/src/ItemPickupEffects.ts exports createItemPickupEffects and updateItemPickupEffects, and packages/client-web/src/components/PowerUpHUD.tsx exports PowerUpHUD.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/shared-items -- itemDefinitions.test.ts exits with code 0 and packages/shared-items/src/__tests__/itemDefinitions.test.ts asserts at least one self-benefit item and at least one opponent-affecting item are defined.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-renderer -- ItemPickupEffects.test.ts exits with code 0 and asserts item pickup fixtures create named scene objects item.pickup.* with visible, collected, and cooldown states.

### FUNCTIONAL-041 — Render boss barrel stun feedback

- User Story: WO-059
- Objective: Validate functional behavior for "Render boss barrel stun feedback" against acceptance criteria.
- Expected: Story "Render boss barrel stun feedback" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-renderer/src/BossBarrelStunEffects.ts exports createBossBarrelStunEffects and updateBossBarrelStunEffects functions.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-renderer -- BossBarrelStunEffects.test.ts exits with code 0 and asserts the boss group named boss.trumpPlaceholder is positioned at the far-right platform anchor from packages/shared-level/src/mvpLevel.ts.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-renderer -- BossBarrelStunEffects.test.ts exits with code 0 and asserts stunned player fixture states create star effect objects named effect.stars.* and set a knockdown visual state on the matching player group.

### FUNCTIONAL-042 — Build accessible in-match RaceHUD

- User Story: WO-060
- Objective: Validate functional behavior for "Build accessible in-match RaceHUD" against acceptance criteria.
- Expected: Story "Build accessible in-match RaceHUD" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection shows packages/client-web/src/components/RaceHUD.tsx exports RaceHUD and accepts props for connectionMetrics, localPlayerState, matchState, itemState, shoveFeedback, and controlHints.
- Check acceptance criterion 2: Running npm run test --workspace @dtr/client-web -- RaceHUD.test.tsx exits with code 0 and asserts latencyMs, snapshotAgeMs, rescue progress text, current power-up text, penalty timer text, shove feedback text, and keyboard hints are rendered from fixtures.
- Check acceptance criterion 3: Running npm run test --workspace @dtr/client-web -- RaceHUD.a11y.test.tsx exits with code 0 and asserts the HUD contains labeled status regions with aria-label values for connection, objective, power-up, penalty, shove feedback, and controls.

### FUNCTIONAL-043 — Define telemetry event taxonomy

- User Story: WO-009
- Objective: Validate functional behavior for "Define telemetry event taxonomy" against acceptance criteria.
- Expected: Story "Define telemetry event taxonomy" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-telemetry/test/eventTaxonomy.test.ts validates buildTelemetryEvent rejects payloads containing nickname or roomCode fields in packages/server-telemetry/src/eventTaxonomy.ts.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/shared-protocol/test/telemetrySchema.test.ts asserts TelemetryEventName in packages/shared-protocol/src/telemetry.ts includes room_create, join_failure, match_start, match_end, disconnect, barrel_hit, fall, item_use, rescue_complete, desync_correction, and match_breaking_error.
- Check acceptance criterion 3: System integration tests: running npm run test:integration -- packages/server-telemetry/test/telemetryContract.integration.test.ts validates every fixture in packages/server-telemetry/test/fixtures/telemetry-events.json is accepted by validateTelemetryEvent.

### FUNCTIONAL-044 — Export telemetry JSONL batches

- User Story: WO-016
- Objective: Validate functional behavior for "Export telemetry JSONL batches" against acceptance criteria.
- Expected: Story "Export telemetry JSONL batches" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-telemetry/test/nicknameMasker.test.ts verifies maskNickname in packages/server-telemetry/src/nicknameMasker.ts converts LarsFan to a deterministic masked value and preserves no raw nickname substring.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/server-telemetry/test/blobPathBuilder.test.ts verifies buildTelemetryBlobPath in packages/server-telemetry/src/blobPathBuilder.ts returns telemetry/year=2026/month=12/day=09/roomHash=abc123/matchEvents.jsonl for a fixed timestamp and roomHash.
- Check acceptance criterion 3: System integration tests: running npm run test:integration -- packages/server-telemetry/test/blobBatchExporter.integration.test.ts flushes packages/server-telemetry/test/fixtures/telemetry-events.json through InMemoryBlobClient and asserts the blob body contains newline-delimited JSON records.

### FUNCTIONAL-045 — Record GDPR privacy requests

- User Story: WO-022
- Objective: Validate functional behavior for "Record GDPR privacy requests" against acceptance criteria.
- Expected: Story "Record GDPR privacy requests" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-telemetry/test/privacyRequestService.test.ts verifies createPrivacyRequest in packages/server-telemetry/src/privacyRequestService.ts writes blob path privacy/requests/req_123.json for requestId req_123.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/server-telemetry/test/privacyRequestValidation.test.ts verifies packages/server-telemetry/src/privacyRequestSchema.ts rejects requestType values outside export and deletion with validation error code invalid_request_type.
- Check acceptance criterion 3: System integration tests: running npm run test:integration -- packages/server-api/test/privacyRoutes.integration.test.ts posts to POST /api/v1/privacy/requests in packages/server-api/src/privacyRoutes.ts and asserts HTTP 202 plus response body requestId and requestStatus received.

### FUNCTIONAL-046 — Configure Blob lifecycle purges

- User Story: WO-029
- Objective: Validate functional behavior for "Configure Blob lifecycle purges" against acceptance criteria.
- Expected: Story "Configure Blob lifecycle purges" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- infra/azure/tests/blob-lifecycle.test.ts asserts infra/azure/blob-lifecycle.bicep contains lifecycle rules for telemetry/, audit/, privacy/requests/, and beta-reports/ prefixes.
- Check acceptance criterion 2: System integration tests: running npm run infra:what-if -- infra/azure/storage.bicep validates the storage account deployment plan includes a Microsoft.Storage/storageAccounts/managementPolicies resource named default.
- Check acceptance criterion 3: Mock data / fixtures: infra/azure/tests/fixtures/blob-prefixes.json contains telemetry/year=2026/month=12/day=09/roomHash=abc/matchEvents.jsonl, audit/year=2026/month=12/day=09/audit.jsonl, privacy/requests/req_123.json, and beta-reports/rc-001/summary.json.

### FUNCTIONAL-047 — Write immutable audit records

- User Story: WO-030
- Objective: Validate functional behavior for "Write immutable audit records" against acceptance criteria.
- Expected: Story "Write immutable audit records" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-telemetry/test/auditWriter.test.ts verifies appendAuditRecord in packages/server-telemetry/src/auditWriter.ts writes JSONL records with action, decision, actorHash, resourceHash, occurredAt, and correlationId.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/server-api/test/tokenAudit.test.ts asserts packages/server-api/src/RoomManager.ts emits token_issued for successful room token issuance and token_rejected for invalid join or token rejection paths.
- Check acceptance criterion 3: Unit tests: running npm test -- packages/server-api/test/startMatchAudit.test.ts asserts packages/server-api/src/matchStartRoutes.ts emits start_match_authorized for a valid host token and start_match_denied for a participant token.

### FUNCTIONAL-048 — Emit server telemetry events

- User Story: WO-041
- Objective: Validate functional behavior for "Emit server telemetry events" against acceptance criteria.
- Expected: Story "Emit server telemetry events" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-api/test/RoomManager.telemetry.test.ts asserts RoomManager.createRoom in packages/server-api/src/RoomManager.ts emits room_create with roomHash and host playerSlot.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/server-api/test/RoomManager.joinFailureTelemetry.test.ts asserts RoomManager.joinRoom in packages/server-api/src/RoomManager.ts emits join_failure for invalid_code, room_full, expired_room, and in_progress cases.
- Check acceptance criterion 3: Unit tests: running npm test -- packages/server-game/test/MatchRunner.telemetry.test.ts asserts MatchRunner in packages/server-game/src/MatchRunner.ts emits match_start, barrel_hit, fall, item_use, rescue_complete, desync_correction, match_end, and match_breaking_error in deterministic fixture scenarios.

### FUNCTIONAL-049 — Create telemetry dashboards and alerts

- User Story: WO-050
- Objective: Validate functional behavior for "Create telemetry dashboards and alerts" against acceptance criteria.
- Expected: Story "Create telemetry dashboards and alerts" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- infra/azure/tests/app-insights-queries.test.ts asserts infra/azure/queries/join-success-rate.kql references room_create and join_failure customEvents names.
- Check acceptance criterion 2: Unit tests: running npm test -- infra/azure/tests/app-insights-queries.test.ts asserts infra/azure/queries/match-completion-rate.kql references match_start and match_end customEvents names.
- Check acceptance criterion 3: System integration tests: running npm run infra:what-if -- infra/azure/app-insights-alerts.bicep validates scheduled query alert resources for join-success-rate, match-completion-rate, desync-correction-rate, match-breaking-errors, and websocket-disconnects.

### FUNCTIONAL-050 — Generate beta evidence summaries

- User Story: WO-051
- Objective: Validate functional behavior for "Generate beta evidence summaries" against acceptance criteria.
- Expected: Story "Generate beta evidence summaries" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Unit tests: running npm test -- packages/server-telemetry/test/betaReportGenerator.test.ts verifies generateBetaSummary in packages/server-telemetry/src/betaReportGenerator.ts calculates joinSuccessRate from room_create and join_failure fixture events.
- Check acceptance criterion 2: Unit tests: running npm test -- packages/server-telemetry/test/betaKpiRollups.test.ts verifies packages/server-telemetry/src/betaKpiRollups.ts calculates matchCompletionRate from match_start and match_end and matchBreakingErrorRate from match_breaking_error fixtures.
- Check acceptance criterion 3: System integration tests: running npm run test:integration -- packages/server-telemetry/test/betaReportGenerator.integration.test.ts writes beta-reports/rc-001/summary.json through InMemoryBlobClient and asserts releaseCandidateId equals rc-001.

### FUNCTIONAL-051 — Automate supply-chain security checks

- User Story: WO-011
- Objective: Validate functional behavior for "Automate supply-chain security checks" against acceptance criteria.
- Expected: Story "Automate supply-chain security checks" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms .github/workflows/security.yml exists and defines jobs named dependency-review, secret-scan, container-scan, sbom, and artifact-integrity.
- Check acceptance criterion 2: File inspection confirms .github/workflows/security.yml triggers on pull_request and push to main and declares permissions with least privilege, including contents: read and security-events: write only where required.
- Check acceptance criterion 3: Running npm run workflow:lint -- .github/workflows/security.yml validates the workflow syntax and rejects unpinned actions according to the repository workflow lint rules.

### FUNCTIONAL-052 — Validate API and realtime inputs

- User Story: WO-013
- Objective: Validate functional behavior for "Validate API and realtime inputs" against acceptance criteria.
- Expected: Story "Validate API and realtime inputs" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms packages/shared-protocol/src/validation.ts exports Zod schemas named nicknameSchema, roomCodeSchema, roomTokenSchema, clientInputMessageSchema, and itemUseCommandSchema, and each schema uses allow-listed characters or explicit numeric bounds rather than permissive z.any.
- Check acceptance criterion 2: Running npm test -- --run packages/shared-protocol verifies unit tests in packages/shared-protocol/src/validation.test.ts reject nickname input containing <script>, reject room code abc123, reject client.input axis values outside -1 to 1, and accept the nickname Løkke.
- Check acceptance criterion 3: Running npm test -- --run packages/server-api verifies integration tests in packages/server-api/src/routes/rooms.validation.test.ts return HTTP 400 from POST /api/v1/rooms for an invalid nickname and HTTP 400 from POST /api/v1/rooms/{code}/join for an invalid room code before room manager lookup is invoked.

### FUNCTIONAL-053 — Secure Azure secrets and OIDC

- User Story: WO-017
- Objective: Validate functional behavior for "Secure Azure secrets and OIDC" against acceptance criteria.
- Expected: Story "Secure Azure secrets and OIDC" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms infra/azure/key-vault.bicep defines an Azure Key Vault resource and secret names room-token-signing-key, blob-writer-credential, and deployment-credential without embedding real secret values.
- Check acceptance criterion 2: File inspection confirms infra/azure/github-oidc.bicep defines federated credential configuration for GitHub Actions using repository donkey-trump-race and environment-specific subject filters rather than a broad wildcard subject.
- Check acceptance criterion 3: Running npm run infra:validate -- infra/azure/main.bicep validates Key Vault, managed identity, and GitHub OIDC modules without requiring real secret values.

### FUNCTIONAL-054 — Throttle room and gameplay requests

- User Story: WO-026
- Objective: Validate functional behavior for "Throttle room and gameplay requests" against acceptance criteria.
- Expected: Story "Throttle room and gameplay requests" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms packages/server-api/src/middleware/rateLimit.ts defines rate-limit policies for POST /api/v1/rooms and POST /api/v1/rooms/{code}/join and returns HTTP 429 with a Retry-After header when the limit is exceeded.
- Check acceptance criterion 2: Running npm test -- --run packages/server-api verifies integration tests in packages/server-api/src/middleware/rateLimit.test.ts receive HTTP 429 from POST /api/v1/rooms after the configured create-room limit and HTTP 429 from POST /api/v1/rooms/{code}/join after the configured join limit.
- Check acceptance criterion 3: Running npm test -- --run packages/server-realtime verifies unit tests in packages/server-realtime/src/inputRateLimiter.test.ts accept 30 client.input messages in one simulated second plus the configured jitter burst and reject a sustained 60 Hz stream.

### FUNCTIONAL-055 — Return safe API and WebSocket errors

- User Story: WO-027
- Objective: Validate functional behavior for "Return safe API and WebSocket errors" against acceptance criteria.
- Expected: Story "Return safe API and WebSocket errors" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms packages/shared-errors/src/errorCatalog.ts defines stable error codes for validation_failed, room_not_found, room_full, room_in_progress, token_invalid, token_expired, rate_limited, malformed_message, and internal_error.
- Check acceptance criterion 2: Running npm test -- --run packages/server-api verifies packages/server-api/src/middleware/errorHandler.test.ts maps validation_failed to HTTP 400, token_invalid to HTTP 401, forbidden role errors to HTTP 403, room_not_found to HTTP 404, rate_limited to HTTP 429, and unexpected exceptions to HTTP 500.
- Check acceptance criterion 3: Running npm test -- --run packages/server-api verifies packages/server-api/src/routes/rooms.error.integration.test.ts responses from POST /api/v1/rooms and POST /api/v1/rooms/{code}/join contain error.code, error.message, and correlationId and do not contain stack, trace, token, signingKey, or connectionString fields.

### FUNCTIONAL-056 — Enforce API and CDN headers

- User Story: WO-035
- Objective: Validate functional behavior for "Enforce API and CDN headers" against acceptance criteria.
- Expected: Story "Enforce API and CDN headers" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection confirms packages/server-api/src/middleware/securityHeaders.ts sets Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, and frame-ancestors directives without using wildcard frame ancestors.
- Check acceptance criterion 2: Running npm test -- --run packages/server-api verifies packages/server-api/src/middleware/securityHeaders.test.ts asserts GET /healthz includes X-Content-Type-Options: nosniff and Strict-Transport-Security with max-age at least 31536000 outside local development.
- Check acceptance criterion 3: Running npm test -- --run packages/server-api verifies packages/server-api/src/routes/rooms.cors.test.ts rejects an Origin not present in the configured CORS allow list for POST /api/v1/rooms and allows the beta client origin from tests/fixtures/security/allowed-origins.json.

### FUNCTIONAL-057 — Add staging deploy smoke workflow

- User Story: WO-036
- Objective: Validate functional behavior for "Add staging deploy smoke workflow" against acceptance criteria.
- Expected: Story "Add staging deploy smoke workflow" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: File inspection verifies .github/workflows/deploy-staging-smoke.yml exists and defines workflow_dispatch plus a staging environment that reads STAGING_BASE_URL from GitHub secrets or environment variables without hardcoded secret values.
- Check acceptance criterion 2: Running npm run smoke:staging -- --baseUrl=http://localhost:3000 executes scripts/smoke/staging-smoke.ts and verifies GET /healthz returns status 200 with a JSON body containing status=ok.
- Check acceptance criterion 3: scripts/smoke/staging-smoke.ts sends POST /api/v1/rooms with a deterministic smoke nickname and verifies the response status is 201 and includes roomCode, playerId, roomToken, and websocketUrl fields before masking roomToken in logs.

### FUNCTIONAL-058 — Automate browser lobby E2E flows

- User Story: WO-042
- Objective: Validate functional behavior for "Automate browser lobby E2E flows" against acceptance criteria.
- Expected: Story "Automate browser lobby E2E flows" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run test:e2e --workspace packages/client-web -- --project=chromium executes packages/client-web/tests/e2e/lobby-flow.spec.ts and verifies POST /api/v1/rooms returns status 201 before the host room code is shown in packages/client-web/src/pages/LandingRoomEntry.tsx.
- Check acceptance criterion 2: Running npm run test:e2e --workspace packages/client-web -- --project=firefox executes packages/client-web/tests/e2e/lobby-flow.spec.ts and asserts packages/client-web/src/pages/MultiplayerLobby.tsx renders exactly 5 roster entries after four joiners use POST /api/v1/rooms/{code}/join.
- Check acceptance criterion 3: The Playwright assertion in packages/client-web/tests/e2e/lobby-flow.spec.ts verifies each roster row exposes a unique player color label and nickname, and the test fails if the lobby renders more than five players.

### FUNCTIONAL-059 — Add multiplayer soak validation harness

- User Story: WO-052
- Objective: Validate functional behavior for "Add multiplayer soak validation harness" against acceptance criteria.
- Expected: Story "Add multiplayer soak validation harness" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run soak:multiplayer --workspace packages/server-realtime -- --rooms=20 --playersPerRoom=5 --durationSeconds=120 executes packages/server-realtime/tests/soak/multiplayer-soak.ts and exits with code 0 when at least 20 rooms receive server.snapshot messages at an average rate of 20 Hz.
- Check acceptance criterion 2: The soak summary generated at packages/server-realtime/tests/artifacts/soak-summary.json contains roomsCreated=20, playersConnected=100, inputHzTarget=30, snapshotHzTarget=20, and matchBreakingErrors=0 fields.
- Check acceptance criterion 3: packages/server-realtime/tests/soak/multiplayer-soak.ts records every WebSocket client.hello response and fails the run if any connection receives a close code other than 1000 or the documented rate-limit close code from packages/server-realtime/src/WebSocketGateway.ts.

### FUNCTIONAL-060 — Validate reconciliation desync telemetry

- User Story: WO-053
- Objective: Validate functional behavior for "Validate reconciliation desync telemetry" against acceptance criteria.
- Expected: Story "Validate reconciliation desync telemetry" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run test:integration --workspace packages/client-netcode executes packages/client-netcode/tests/integration/reconciliation-desync.test.ts and verifies Reconciler.applyServerSnapshot does not emit desync_correction when correctionDistance is below the threshold exported by packages/client-netcode/src/Reconciler.ts.
- Check acceptance criterion 2: packages/client-netcode/tests/integration/reconciliation-desync.test.ts asserts Reconciler.applyServerSnapshot emits a desync_correction event through packages/server-telemetry/src/events.ts when the authoritative position from packages/server-game/src/MatchRunner.ts exceeds the configured threshold.
- Check acceptance criterion 3: The desync_correction assertion in packages/client-netcode/tests/integration/reconciliation-desync.test.ts verifies the telemetry payload contains roomHash, playerSlot, correctionDistance, tick, and severity fields, and does not contain nickname, roomCode, or roomToken fields.

### FUNCTIONAL-061 — Handle match interruption recovery

- User Story: WO-054
- Objective: Validate functional behavior for "Handle match interruption recovery" against acceptance criteria.
- Expected: Story "Handle match interruption recovery" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run test:unit --workspace packages/client-netcode executes packages/client-netcode/src/GameSocketClient.test.ts and verifies an abnormal WebSocket close during an active match emits a match.interrupted state with reason=connection_lost and recoverable=false.
- Check acceptance criterion 2: packages/client-web/src/components/StructuredError.test.ts verifies the match interruption state renders a user-facing message containing return to lobby and create new room actions without exposing stack traces, roomToken, or raw roomCode.
- Check acceptance criterion 3: Running npm run test:unit --workspace packages/server-telemetry executes packages/server-telemetry/src/events.test.ts and verifies validateTelemetryEvent accepts match_breaking_error payloads with roomHash, matchId, reason, tick, recoverable, and timestamp.

### FUNCTIONAL-062 — Automate beta sign-off reporting

- User Story: WO-061
- Objective: Validate functional behavior for "Automate beta sign-off reporting" against acceptance criteria.
- Expected: Story "Automate beta sign-off reporting" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run test:unit --workspace packages/server-telemetry executes packages/server-telemetry/tests/beta-signoff-report.test.ts and verifies calculateBetaSignoffReport in packages/server-telemetry/src/BetaSignoffReport.ts computes matchCompletionRate from match_started and match_ended events.
- Check acceptance criterion 2: packages/server-telemetry/tests/beta-signoff-report.test.ts verifies calculateBetaSignoffReport marks validJoinWithin10Seconds as true only when join_completed timestamps are within 10000 milliseconds of join_attempt for POST /api/v1/rooms/{code}/join.
- Check acceptance criterion 3: packages/server-telemetry/tests/beta-signoff-report.test.ts verifies matchBreakingErrorRate is below 0.02 when match_breaking_error events divided by match_started events is less than the guardrail and false when it is equal to or above 0.02.

### FUNCTIONAL-063 — Automate accessibility regression coverage

- User Story: WO-063
- Objective: Validate functional behavior for "Automate accessibility regression coverage" against acceptance criteria.
- Expected: Story "Automate accessibility regression coverage" satisfies expected functional validation outcomes without critical issues.

**Steps**
- Check acceptance criterion 1: Running npm run test:a11y --workspace packages/client-web executes packages/client-web/tests/accessibility/core-screens.a11y.spec.ts and reports zero axe violations with impact serious or critical for packages/client-web/src/pages/LandingRoomEntry.tsx.
- Check acceptance criterion 2: packages/client-web/tests/accessibility/core-screens.a11y.spec.ts verifies keyboard Tab order can reach nickname input, create-room button, room-code input, join-room button, ready button, and start-match button in packages/client-web/src/pages/MultiplayerLobby.tsx without using mouse events.
- Check acceptance criterion 3: The accessibility test for packages/client-web/src/components/StructuredError.tsx asserts invalid room-code and full-room messages are exposed through role=alert or aria-live status text and include a recovery action label.