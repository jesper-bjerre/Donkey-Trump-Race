# Intent profile

**Status:** complete

**Artifact:** `c94a7fdb-ac2a-4a83-84c7-67666912bbe2`

## Vision

Build a modern 3D browser-based multiplayer arcade game, “Donkey Trump Race,” combining classic Donkey Kong-style vertical platforming with Mario Kart-style camera, competition, collisions, and power-up mechanics, where up to 5 players race as colored versions of “Jumpman Løkke” to rescue “Motzfeldt” while avoiding computer-controlled barrels from an angry Trump-like boss.

## Target personas

- Casual multiplayer players: friends who want a humorous, fast, competitive browser game they can join quickly and play together in short sessions.
- Game host or lobby creator: a player who starts a room, waits for up to 5 participants, and begins the race when everyone is ready.
- Spectator-friendly party-game audience: players attracted by recognizable political caricature humor, slapstick collisions, and easy-to-understand arcade rules.

## Core features

- **3D Web Game Core** (priority 1)
  - Description: Create a modern 3D game for the web titled “Donkey Trump Race,” strongly inspired by classic Donkey Kong-style platform levels and Mario Kart-style multiplayer racing. The game should run in the browser and present the player view with a Mario Kart-like perspective rather than a purely flat 2D view.
  - Acceptance: The game is playable in a modern web browser.
  - Acceptance: The game title is displayed as “Donkey Trump Race.”
  - Acceptance: The game uses a modern 3D visual style.
  - Acceptance: The player camera/view is inspired by Mario Kart-style gameplay.
  - Acceptance: The core game loop combines vertical/platform level progression with competitive multiplayer racing.
- **Playable Jumpman Løkke Characters** (priority 2)
  - Description: The playable hero is “Jumpman Løkke,” a drawn/cartoon-like character resembling Danish foreign minister Lars Løkke Rasmussen. In multiplayer, each player controls their own Jumpman character in a distinct color.
  - Acceptance: The main playable character is named “Jumpman Løkke” in the game.
  - Acceptance: Jumpman Løkke is rendered as a drawn/cartoon-style caricature.
  - Acceptance: Up to 5 players can each control a separate Jumpman character.
  - Acceptance: Each player character has a distinct color so players can tell themselves apart.
  - Acceptance: The game supports up to 5 player characters visible side by side.
- **Rescue Objective** (priority 3)
  - Description: Each level has a rescue goal where “Motzfeldt” stands at the top of the level. Players race or compete to reach the top and rescue Motzfeldt.
  - Acceptance: Motzfeldt appears at the top of each level.
  - Acceptance: The main objective of each level is to reach and rescue Motzfeldt.
  - Acceptance: The level completion condition is tied to reaching the top rescue point.
- **Computer-Controlled Donkey Trump Boss** (priority 4)
  - Description: The Donkey Kong-like boss should look like an angry, drawn/cartoon Donald Trump-inspired character and be controlled by the computer. The boss stands all the way to the right on the platform/floor and attacks players by sending barrels or similar hazards.
  - Acceptance: The boss is computer-controlled, not controlled by a human player.
  - Acceptance: The boss visually resembles an angry drawn/cartoon Trump-inspired character.
  - Acceptance: The boss stands completely to the right side of the floor/platform.
  - Acceptance: The boss launches or causes barrel hazards that can hit players.
- **Level Layout and Movement Rules** (priority 5)
  - Description: Levels should preserve the Donkey Kong-like vertical platform structure with floors and ladders, but Jumpman Løkke must only be able to jump half as high as expected so he cannot jump directly from one floor to another. Players must use ladders to move between floors.
  - Acceptance: Levels contain multiple floors/platforms connected by ladders.
  - Acceptance: Jumpman Løkke can jump, but only half-height relative to a normal floor-to-floor jump.
  - Acceptance: Players cannot jump directly from one floor to another.
  - Acceptance: Players must use ladders to travel between floors.
  - Acceptance: From the starting perspective, the left side has a wall.
  - Acceptance: From the starting perspective, players can fall off the edge on the right side.
- **Multiplayer Lobby for Up to 5 Players** (priority 6)
  - Description: The game should support multiplayer with a lobby where up to 5 players can join before the match starts. Each joined player becomes a differently colored Jumpman character.
  - Acceptance: Players can join a multiplayer lobby before the game starts.
  - Acceptance: The lobby allows a maximum of 5 players.
  - Acceptance: The match cannot exceed 5 human players.
  - Acceptance: Each joined player receives a separate player character.
  - Acceptance: Each joined player character has a unique or clearly distinguishable color.
- **Mario Kart-Style Items and Power-Ups** (priority 7)
  - Description: Players can collect different items during the race/platform level and use them either on themselves or against opponents, similar to Mario Kart. Item effects should support competitive interactions and comeback opportunities.
  - Acceptance: Players can collect item pickups during gameplay.
  - Acceptance: Collected items can be used by the player who picked them up.
  - Acceptance: At least some items can be used against other players.
  - Acceptance: At least some items can benefit the player directly.
  - Acceptance: Item effects are applied consistently in multiplayer.
- **Player Collision and Shove Mechanics** (priority 8)
  - Description: When one player runs into the side of another player, the collision should push or shove the opponent. This supports Mario Kart-like physical competition between players.
  - Acceptance: Player characters have collision detection against each other.
  - Acceptance: When a player hits another player from the side, the impacted opponent is pushed.
  - Acceptance: The shove effect changes the opponent’s movement or position in a visible way.
  - Acceptance: Collision behavior works with up to 5 players in the same play area.
- **Barrel Hit Stun** (priority 9)
  - Description: If a player is hit by a barrel from the computer-controlled boss, the player is knocked down, sees stars, and cannot run again for 2 seconds.
  - Acceptance: Barrels can collide with player characters.
  - Acceptance: When a barrel hits a player, the player is knocked down.
  - Acceptance: A star visual effect appears when the player is knocked down.
  - Acceptance: The player cannot run or move normally for 2 seconds after being hit.
  - Acceptance: After the 2-second stun period ends, the player can run again.
- **Fall-Off-Edge Penalty and Respawn** (priority 10)
  - Description: If a player falls off the right edge of the level, they return to the game but receive a delay penalty similar to being hit by a barrel.
  - Acceptance: Players can fall off the right edge from the starting perspective.
  - Acceptance: When a player falls off the edge, they are returned to the playable area.
  - Acceptance: Falling off the edge applies a delay penalty before the player can continue.
  - Acceptance: The fall penalty is comparable in behavior to the barrel-hit delay/stun rule.

## In Scope

- Greenfield browser-based 3D game titled “Donkey Trump Race”
- Mario Kart-style third-person player view
- Donkey Kong-inspired vertical level structure with floors and ladders
- Jumpman Løkke playable characters in multiple colors
- Motzfeldt rescue objective at the top of each level
- Computer-controlled angry Trump-like boss positioned on the right side of the floor
- Real-time multiplayer lobby for up to 5 players
- Player collision and shove mechanics
- Collectible items and power-ups usable on self or opponents
- Barrel hazards with knockdown, stars, and 2-second delay
- Right-edge fall-off behavior with respawn and delay penalty
- Left-side wall boundary from the starting perspective

## Out of Scope

- More than 5 simultaneous human players
- Native mobile app versions unless later requested
- Single-player campaign beyond any required testing mode unless later requested
- Use of exact copyrighted Nintendo assets, characters, levels, music, or branding without legal clearance
- Use of real-person likenesses or names in a public release without legal/IP review
- Complex realistic vehicle simulation unless later requested

## Technical constraints

- The game must be a browser-based web game.
- The game must use 3D rendering suitable for modern web browsers.
- The game must support real-time multiplayer for up to 5 human players.
- The boss character must be computer-controlled.
- A room/lobby flow is required before gameplay so players can join.
- Competitive multiplayer state such as positions, item pickups, collisions, barrel hits, fall penalties, and finish/rescue state should be authoritative and synchronized consistently.
- A practical implementation stack would be Three.js or Babylon.js for WebGL rendering, TypeScript for shared client/server logic, and Node.js with WebSockets or Socket.IO for real-time networking.
- For fairness, clients should send player inputs rather than authoritative final positions, with the server validating and broadcasting game state.
- The game concept references well-known games and public figures; final art, names, and branding may require legal/IP review before public release, especially if using names or likenesses directly.

## Confidence

Overall: **84%**

> The input provides a strong greenfield game concept with concrete gameplay mechanics and multiplayer requirements, though some production details such as art direction, exact controls, level count, and monetization are not specified.

| Section | Score | Why | How to Improve |
| --- | --- | --- | --- |
| Vision | 90% | The product concept, title, genre blend, characters, and multiplayer direction are clearly described. | Add 2-3 measurable success criteria, such as target match length, intended humor tone, and whether the goal is a prototype, MVP, or public release. |
| Target personas | 72% | The likely player personas can be inferred from the party-style multiplayer game concept, though no detailed demographic or platform audience was explicitly provided. | Define the intended audience more precisely, such as age range, casual versus competitive players, Danish political satire fans, or party-game groups. |
| Core features | 90% | The gameplay rules, character roles, multiplayer limit, movement constraints, hazards, items, collisions, and penalties are described with enough specificity to define a feature set. | Specify exact controls, item types, number of levels, win condition, scoring/ranking rules, and whether races are timed or placement-based. |
| Technical constraints | 82% | The web, 3D, multiplayer, lobby, and real-time gameplay constraints are clear, with additional feasible architecture guidance available from the research context. | Confirm the preferred rendering engine, networking approach, deployment target, browser/device support, and whether the game requires accounts or anonymous room codes. |
