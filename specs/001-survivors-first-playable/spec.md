# Feature Specification: Uptime Survivors — First Playable

**Feature Branch**: `001-survivors-first-playable`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Read [the workshop starter spec, since removed]. Specify this game's first playable version,
preserving the non-goals, and acceptance criteria. This should be a survivors-like game,
not a quiz game like originally mentioned in some of the example info copied from the workshop."

## Overview

Uptime Survivors is a browser survivors-like (auto-attacking horde survival) with a network
engineering theme. The player is the network engineer defending their network. Network problems —
packet loss, latency spikes, broadcast storms, route flaps, DDoS botnets — swarm in as enemies.
The player only steers; their tools (ping, firewall rules, automation playbooks) fire
automatically. Defeated problems drop telemetry, which levels the engineer up and offers a choice
of new or improved tools. Difficulty climbs through 20 levels; surviving difficulty level 20 wins
the run. All names, art, and descriptions are original to this project.

## Clarifications

### Session 2026-11-18

- Q: How much of the enemy and tool roster must the first playable version include? → A: The
  full roster is required: 5 enemy types, 4 tools, 2 passives (none are stretch goals).
- Q: How long should each of the 20 difficulty levels last? → A: 60 seconds per level, for a
  20-minute winning run.
- Q: What should the game look like on screen? → A: Network-diagram look: dark grid background,
  glowing shapes styled as packets, nodes, and links, and a terminal-style HUD; no sprite art.
- Q: How hard should a run be for a first-time player? → A: Moderate: most first runs end
  around difficulty 8–14; an attentive player wins within 3 runs.
- Q: Who does the player control: the network engineer, or the network itself? → A: The network
  engineer, drawn as a glowing terminal/cursor node; health is the network's Uptime.
- Q: What must the core-loop milestone include before the rest of the enemies and tools are
  built? → A: Movement, Uptime and losing, Ping, Firewall Rule, Bandwidth Upgrade, Dropped Packet,
  Latency Spike, telemetry and level-ups with 3 real choices, all 20 difficulty levels, the win
  screen via the test timer, and seeded replay.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Survive a run (Priority: P1)

A player opens the game, starts a run, and steers the engineer around an open map while their
starting tool fires automatically at nearby network problems. Enemies approach from all sides and
damage the network's **Uptime** (health) on contact. The run ends in a loss when Uptime reaches
0%, and an end screen shows how long they survived and the difficulty level reached.

**Why this priority**: This is the core loop of the genre. Without moving, auto-attacking, and
being able to lose, there is no game.

**Independent Test**: Start a run, move with the keyboard, watch the starting tool defeat
enemies, then stop moving and let enemies reduce Uptime to 0%; the loss screen appears with
survival time and difficulty level.

**Acceptance Scenarios**:

1. **Given** the title screen, **When** the player presses Start, **Then** a run begins with the
   engineer in the center of the map, Uptime at 100%, and the starting tool equipped.
2. **Given** a run in progress, **When** the player holds a direction key, **Then** the engineer
   moves in that direction (including diagonals) and the view follows the engineer.
3. **Given** an enemy within range of the starting tool, **When** the tool's cooldown elapses,
   **Then** the tool fires without player input and damages the enemy.
4. **Given** an enemy touching the engineer, **When** contact continues, **Then** Uptime
   decreases by the enemy's listed damage rate, with a brief visible hit indication.
5. **Given** Uptime reaches 0%, **When** the run ends, **Then** gameplay stops and the loss screen
   shows time survived, difficulty level reached, enemies defeated, and the run's seed.

---

### User Story 2 - Level up and build a loadout (Priority: P1)

Defeated enemies drop **telemetry** pickups. Collecting enough telemetry levels up the engineer.
On each level-up the game pauses and offers three choices drawn from new tools and upgrades to
tools already owned. The player picks one, and play resumes with the stronger loadout.

**Why this priority**: Choosing upgrades is what makes survivors-likes replayable and what turns
"gets better at troubleshooting and automation" into gameplay.

**Independent Test**: Play until the telemetry bar fills; confirm the game pauses, three distinct
choices are shown with networking descriptions and exact effect values, and the chosen effect is
active after resuming.

**Acceptance Scenarios**:

1. **Given** a defeated enemy, **When** it is removed, **Then** it leaves a telemetry pickup worth
   that enemy type's listed value.
2. **Given** a telemetry pickup within the engineer's pickup radius, **When** the engineer comes
   near, **Then** the pickup moves to the engineer, is collected, and fills the telemetry bar.
3. **Given** the telemetry bar is full, **When** the level-up triggers, **Then** gameplay pauses
   and three different choices are shown (or every remaining choice, if fewer than three remain),
   each with name, rank (e.g., "Rank 2 → 3"), a one-line
   networking description, and the exact numeric change it applies.
4. **Given** the level-up choices, **When** the player selects one by mouse or by pressing 1, 2,
   or 3, **Then** the choice is applied, gameplay resumes, and the next level requires more
   telemetry than the last.
5. **Given** a tool at its maximum rank, **When** choices are generated, **Then** that tool is not
   offered again.
6. **Given** the player already owns the maximum number of tools, **When** choices are generated,
   **Then** only upgrades to owned tools and passive upgrades are offered.

---

### User Story 3 - Escalating difficulty to a win (Priority: P1)

As the run progresses, the difficulty level rises from 1 to 20 on a fixed timer. Each difficulty
level brings more and tougher enemies, and new enemy types debut every few levels. If the player
survives until the end of difficulty level 20, they win the run.

**Why this priority**: The agreed scope is a run of up to 20 difficulty levels that ends in a
win; without this there is no goal or sense of progress.

**Independent Test**: Using a shortened-timer test setting or a fixed seed, observe the
difficulty indicator advance, confirm enemy count and stats increase each level, confirm a new
enemy type appears at its debut level, and confirm the win screen appears after level 20 ends.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** the difficulty timer for the current level elapses,
   **Then** the difficulty level increases by 1 and the on-screen indicator shows "Difficulty N /
   20".
2. **Given** difficulty level N+1, **When** compared with level N, **Then** the spawn rate and/or
   enemy health is higher, as listed in the difficulty data.
3. **Given** a difficulty level that debuts a new enemy type, **When** that level begins, **Then**
   a short banner names the new threat and its networking concept (e.g., "New threat: Broadcast
   Storm"), and that enemy type begins spawning.
4. **Given** the player is still above 0% Uptime, **When** difficulty level 20's timer ends,
   **Then** the run ends in a win and the win screen shows the same statistics as the loss screen.

---

### User Story 4 - Restart, pause, and replay (Priority: P2)

From the end screen the player can start a new run or replay the same seed. During a run the
player can pause and resume.

**Why this priority**: Fast retries are part of the genre's appeal, and replaying a seed lets
anyone reproduce a run (constitution C5). The game is playable without it, so it is P2.

**Independent Test**: Finish a run, choose "Replay seed," and confirm the opening spawns match the
previous run; pause mid-run and confirm nothing moves until resumed.

**Acceptance Scenarios**:

1. **Given** the end screen, **When** the player chooses New Run, **Then** a fresh run starts with
   a new seed and all stats reset.
2. **Given** the end screen, **When** the player chooses Replay Seed, **Then** a fresh run starts
   with the same seed; with identical inputs, spawns, drops, and level-up offers are identical.
3. **Given** a run in progress, **When** the player presses Escape or P, **Then** the game pauses,
   shows a pause overlay with Resume and Quit to Title, and no timers or enemies advance.
4. **Given** the browser tab loses focus during a run, **When** the player returns, **Then** the
   game is paused rather than having advanced unattended.

---

### User Story 5 - Understand the networking theme (Priority: P3)

The player can tell what real networking problem each enemy represents and what real tool or
practice each ability represents, through short in-game descriptions.

**Why this priority**: The theme is what makes this game distinct (constitution C1), but the game
is still playable with placeholder text, so it is P3 for build order.

**Independent Test**: A reviewer reads every enemy and tool description in-game and names the
real networking concept each one is based on.

**Acceptance Scenarios**:

1. **Given** the level-up screen, **When** a tool is offered, **Then** its description names the
   real practice it represents (e.g., "Firewall Rule — ACLs drop traffic that matches a deny
   entry").
2. **Given** a new enemy type debuts, **When** its banner appears, **Then** it names the real
   network problem it represents.
3. **Given** the end screen, **When** shown, **Then** it lists the tools owned at the end of the
   run and their ranks.

---

### Edge Cases

- **Level-up during a level-up**: if one pickup grants enough telemetry for several levels, the
  choices are presented one level at a time until all pending level-ups are resolved.
- **No valid choices remain**: if every tool and passive is at maximum rank, the level-up grants a
  fixed fallback (restores 20% Uptime) instead of an empty choice screen.
- **Fewer than three choices remain**: late in a run, if only one or two upgrades are still
  available, the level-up screen shows just those; it never repeats a choice to fill three slots.
- **Win and loss on the same moment**: if Uptime reaches 0% in the same instant level 20 ends, the
  run counts as a loss.
- **Too many enemies**: the number of simultaneously active enemies is capped (see FR-020); spawns
  beyond the cap are skipped, not queued forever.
- **Too many pickups**: when uncollected telemetry exceeds the pickup cap, the oldest pickups merge
  into one pickup with their combined value; no telemetry is lost.
- **Invalid game data**: if content data is missing, malformed, or contains duplicate IDs, the
  game shows an error naming the offending item and does not start a run.
- **Window resize**: resizing the window during a run keeps the engineer centered and does not
  reset or advance the run.
- **Holding opposite keys**: pressing left and right together results in no horizontal movement.

## Requirements *(mandatory)*

### Functional Requirements

**Run flow**

- **FR-001**: The game MUST show a title screen with a Start control and a short controls
  reminder, and MUST start a run within two player inputs of the page loading.
- **FR-002**: A run MUST end in a **loss** when Uptime reaches 0%, or a **win** when the timer for
  difficulty level 20 ends with Uptime above 0%.
- **FR-003**: The end screen MUST show outcome (win/loss), time survived, difficulty level
  reached, enemies defeated, engineer level, tools owned with ranks, and the run's seed, and MUST
  offer New Run and Replay Seed.
- **FR-004**: The player MUST be able to pause and resume with Escape or P; the game MUST pause
  automatically when the page loses focus.

**Movement and combat**

- **FR-005**: The player MUST move the engineer in eight directions with WASD or arrow keys at a
  constant speed (diagonal movement no faster than straight movement).
- **FR-006**: The map MUST be an open field with no walls; the view MUST stay centered on the
  engineer.
- **FR-007**: Tools MUST fire automatically on their own cooldowns; the player MUST NOT need any
  input to attack.
- **FR-008**: Enemies MUST move toward the engineer and MUST damage Uptime while touching the
  engineer, at their listed damage rate.
- **FR-009**: After taking damage, the engineer MUST have a brief invulnerability window (default
  0.5 seconds) so overlapping enemies cannot drain Uptime instantly.
- **FR-010**: Enemies MUST be defeated when their health reaches zero and MUST drop telemetry
  equal to their listed value.

**Progression**

- **FR-011**: Telemetry within the pickup radius MUST be drawn to and collected by the engineer.
- **FR-012**: Each engineer level MUST require more telemetry than the previous one, according to
  the progression data.
- **FR-013**: Each level-up MUST pause gameplay and offer three distinct choices drawn from: new
  tools (if the engineer has fewer than the maximum of 4 tools), upgrades to owned tools below max
  rank, and passive upgrades below max rank. If fewer than three candidates remain, all remaining
  candidates MUST be offered; if none remain, the fallback in Edge Cases applies.
- **FR-014**: Each tool MUST have 5 ranks; each passive MUST have 5 ranks.
- **FR-015**: Each choice MUST show its name, current → next rank, a networking description, and
  the exact numeric effect; the effect applied MUST match the displayed values.

**Difficulty**

- **FR-016**: The run MUST progress through difficulty levels 1–20, each lasting a fixed duration
  defined in game data (60 seconds, for a full run of 20 minutes).
- **FR-017**: Each difficulty level MUST define spawn rate, enemy-type mix, and enemy stat
  multipliers; each level MUST be harder than the previous by at least one of these measures.
- **FR-018**: New enemy types MUST debut at defined difficulty levels (default: levels 1, 4, 8,
  12, and 16), each announced by an on-screen banner.
- **FR-019**: Difficulty level 20 MUST include every enemy type at its highest listed stats.
- **FR-020**: The game MUST cap active enemies (default 300) and uncollected pickups (default
  200), handling overflow as described in Edge Cases.

**Content (minimum roster for first playable)**

- **FR-021**: The game MUST include all 5 of these enemy types in the first playable version
  (none are stretch goals), each tied to a real network problem:

  | Enemy | Real concept | Behavior |
  |-------|--------------|----------|
  | Dropped Packet | Packet loss | Slow, weak, appears in large numbers |
  | Latency Spike | Latency/jitter | Fast, fragile |
  | Broadcast Storm | L2 broadcast storm / switching loop | Splits into smaller copies when defeated |
  | Route Flap | BGP route flapping | Periodically blinks a short distance toward the engineer |
  | DDoS Botnet | Distributed denial of service | Large, slow, high health |

- **FR-022**: The game MUST include all 4 of these tools and both passives in the first playable
  version (none are stretch goals), each tied to a real networking practice:

  | Tool / Passive | Real concept | Effect |
  |----------------|--------------|--------|
  | Ping (starting tool) | ICMP echo | Fires a projectile at the nearest enemy |
  | Firewall Rule | ACLs | Rotating barriers around the engineer that damage enemies they touch |
  | Ansible Playbook | Configuration automation | Periodic pulse damaging all enemies in a radius |
  | Load Balancer | Traffic distribution | Fires several projectiles spread across directions |
  | Redundant Power Supply (passive) | Hardware redundancy | Increases max Uptime and slowly regenerates it |
  | Bandwidth Upgrade (passive) | Link capacity | Increases move speed and pickup radius |

- **FR-023**: All enemy, tool, passive, difficulty, and progression values and descriptions MUST
  be stored as editable game data, separate from game rules (constitution C6).
- **FR-024**: Game data MUST be validated before a run starts; invalid data MUST produce an error
  that names the offending item ID, and no run starts.
- **FR-025**: All names, art, and descriptions MUST be original; no third-party game assets,
  characters, or names (constitution C1).
- **FR-025a**: The visual style MUST be a network diagram: a dark grid background, the engineer
  and enemies drawn as glowing geometric shapes styled as packets, nodes, and links, and a
  terminal-style HUD. No sprite artwork is required.
- **FR-025b**: Each of the 5 enemy types MUST have a distinct shape and colour combination, so
  types can be told apart without reading labels.

**Determinism and self-containment**

- **FR-026**: Every run MUST have a seed; all gameplay randomness (spawn positions, enemy-type
  selection, drops, level-up offers) MUST derive from that seed, so the same seed and the same
  inputs produce the same outcome (constitution C5).
- **FR-027**: The game MUST be playable with only the project's static files: no account, server,
  network connection to other sites, AI model, or API key.

**HUD**

- **FR-028**: During a run the screen MUST show: Uptime (percentage and bar), telemetry bar with
  engineer level, difficulty level ("N / 20") with time remaining in the current level, total run
  time, and owned tools with ranks.

**Build milestones**

- **FR-029**: The game MUST reach a playable **core-loop milestone** before the remaining roster
  is built. The milestone is complete only when all of the following work and are verified:
  8-direction movement; Uptime and the loss screen; tools Ping and Firewall Rule; passive
  Bandwidth Upgrade; enemies Dropped Packet and Latency Spike; telemetry pickups and level-ups
  offering 3 distinct choices; all 20 difficulty levels driven by game data; the win screen
  (reachable via the shortened-timer test setting); and seeded replay.
- **FR-030**: After the core-loop milestone passes, the remaining roster (Broadcast Storm, Route
  Flap, DDoS Botnet, Ansible Playbook, Load Balancer, Redundant Power Supply) MUST be added to
  complete the first playable version; per FR-021 and FR-022 these are required, not optional.

### Non-Goals (v1)

Preserved from the starter kit's scope controls and the constitution; anything here requires a
scope amendment:

- No persistence: no saved runs, high scores, unlocks, or settings between page loads.
- No meta-progression between runs (no permanent upgrades, currencies, or unlockable characters).
- No multiplayer.
- No runtime AI, accounts, backend, or live network/device connections.
- No level or content editor.
- No audio (music or sound effects). *Lifted by feature 002 — sound effects and music are specified in
  [`specs/002-procedural-audio/`](../002-procedural-audio/spec.md); all other non-goals still apply.*
- No multiple maps or hand-built stages; one open map, with difficulty driven by data.
- No mobile/touch controls or gamepad support.
- No quiz, question, or grading mechanics; leftover quiz material in the starter kit does not
  apply.

### Key Entities

- **Run**: one play session from Start to win/loss; has a seed, elapsed time, current difficulty
  level, outcome, and statistics.
- **Engineer (player)**: the network engineer, drawn as a glowing terminal/cursor node; position, Uptime (current/max), move speed, pickup radius, engineer
  level, telemetry, and owned tools/passives with ranks.
- **Enemy Type**: ID, name, real networking concept, description, health, speed, contact damage,
  telemetry value, special behavior, and debut difficulty level.
- **Tool**: ID, name, real networking concept, description, and per-rank stats (damage, cooldown,
  area, projectile count, as applicable).
- **Passive**: ID, name, real networking concept, description, and per-rank stat bonuses.
- **Difficulty Level**: number (1–20), duration, spawn rate, enemy-type mix, stat multipliers,
  and any enemy-type debuts.
- **Progression Table**: telemetry required for each engineer level.
- **Telemetry Pickup**: position and value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player starts a run within 10 seconds and two inputs of the page
  loading, without instructions beyond the title screen.
- **SC-002**: A first-time player reaches their first level-up within the first 60 seconds of a
  run in at least 9 of 10 test runs.
- **SC-003**: A full winning run lasts 20 minutes ± 5 seconds (20 difficulty levels × 60
  seconds).
- **SC-004**: Enemy count on screen and/or enemy toughness visibly increases at each of the 20
  difficulty levels, verified against the difficulty data.
- **SC-005**: Gameplay stays visually smooth (no visible stutter or input lag) with 300 enemies
  on screen on a typical workshop laptop.
- **SC-006**: Replaying the same seed with the same inputs produces identical spawns, drops,
  level-up offers, and final statistics in 100% of repeated test runs.
- **SC-007**: A reviewer can name the real networking concept behind 100% of enemies, tools, and
  passives from their in-game names and descriptions alone.
- **SC-008**: The game plays a full run from a fresh browser session with network access to other
  sites blocked.
- **SC-009**: 100% of deliberately broken data files in testing (missing field, duplicate ID,
  out-of-range value) are rejected with an error naming the offending item.
- **SC-010**: At least 3 of 5 workshop playtesters say they would play another run immediately
  after their first.
- **SC-011**: Difficulty is moderate: in playtesting, at least 3 of 5 first-time players' first
  runs end between difficulty levels 8 and 14, and at least 3 of 5 win within their first 3 runs.
- **SC-012**: The core-loop milestone (FR-029) is demonstrated with a recorded fresh-start
  playthrough — reaching a level-up with 3 distinct choices, a loss, and a win via the test
  timer — before work on the remaining roster begins.

## Assumptions

- The starter kit's SPEC.md contained no explicit non-goals or acceptance criteria; non-goals are
  taken from the starter kit plan's scope controls and the constitution, minus quiz-specific items.
- Target platform is a desktop browser with a keyboard; mouse is optional (level-up choices also
  accept 1/2/3).
- Run length is 20 minutes (60 seconds per difficulty level); durations live in data and can be
  tuned.
- Because a full run takes 20 minutes, verification needs a shortened-timer test setting so
  difficulty progression and the win screen can be checked quickly; it is not a player-facing
  feature.
- Visual polish (glow, particles) comes after the core loop works (constitution C7).
- Numeric defaults (caps, ranks, invulnerability time, debut levels) are starting values to tune
  during playtesting and live in game data.
