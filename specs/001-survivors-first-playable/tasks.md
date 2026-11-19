---

description: "Task list for Uptime Survivors — First Playable"
---

# Tasks: Uptime Survivors — First Playable

**Input**: Design documents from `specs/001-survivors-first-playable/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The plan defines a test suite (plan.md › Project Structure › `tests/`), the
spec requires automated evidence (SC-006, SC-009), and constitution C7 requires recorded
verification. Write each story's tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. Stories US1–US4 use only the core roster and
together form the **core-loop milestone** (FR-029). A milestone gate follows; the remaining roster
(FR-030) and US5 come after it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5 from spec.md)
- Paths are relative to the repository root (single static project, see plan.md)
- Field citations such as `data-model.md › Enemy Type.shape` point to the canonical rule; tasks
  do not restate those rules

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Page shell, styling base, test harness, README skeleton

- [x] T001 Create folders `engine/`, `ui/`, `data/`, `tests/` and the page shell in index.html: full-window `<canvas>`, an overlay container for screens, an ARIA live region, and `<script type="module" src="main.js">` (plan.md › Source Code)
- [x] T002 [P] Create style.css: dark terminal-style colour tokens, monospace HUD font stack, overlay/button/focus styles, and a `prefers-reduced-motion: reduce` block (contracts/ui-controls.md › Accessibility)
- [x] T003 [P] Create tests/harness.js exporting `test(name, fn)`, `assertEqual` (deep), `assertApprox`, `assertThrows`, and `runAll()` returning `{passed, failed, failedNames}`; zero registered tests MUST count as failure (research.md R8)
- [x] T004 [P] Create tests/run.mjs: imports every `tests/*.test.js`, calls `runAll()`, prints totals and failed names, exits 0 only if all pass and at least one test ran
- [x] T005 [P] Create tests/index.html: imports the same test files and harness, shows totals and failed test names on the page
- [x] T006 [P] Replace the workshop template contents of README.md (remove the "Copy this file…" note and every `[BRACKETED PLACEHOLDER]` such as `[TARGET PLAYER]` and `[ROLE]`) with: a one-paragraph description of Uptime Survivors as specified in spec.md › Overview, how to run (`python3 -m http.server 8000 --bind 127.0.0.1`), how to test (browser `/tests/` and `node tests/run.mjs`), controls (contracts/ui-controls.md › Keyboard), current status ("in development — core-loop milestone not yet verified"), and a verification table listing M1–M9 and F1–F11 from quickstart.md, all marked "not run"; no bracketed placeholders may remain

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Seeded randomness, validated core-roster data, difficulty lookups, collision grid,
loader and screen manager. Every story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T007 [P] Write tests/rng.test.js: same seed → same 1,000-value sequence; different seeds differ; `next()` in [0,1); `int(n)` in [0,n); `pick` returns list items (contracts/engine-api.md › engine/rng.js)
- [x] T008 [P] Write tests/content.test.js: the shipped data/game.json passes; each broken copy fails with an error naming the item `id` and `path` — missing field, duplicate id (enemy, and tool vs passive), unknown field, reused shape, reused colour, unknown `behavior.kind`, rank count ≠ 5, `levelUp.choices` ≠ 3, unknown `startingTool`, difficulty row count ≠ 20, non-monotonic row, enemy in `mix` before its debut, level 20 missing an enemy (contracts/game-data.md › Validation output)
- [x] T009 [P] Write tests/difficulty.test.js: `levelAt` returns 1 at 0 s, 2 at 60 s, 20 at 1,199 s; `runLength` = 1,200 s; with `levelSeconds=2` → 40 s and level 20 at 38 s; debut lookup returns the right enemy IDs per level (contracts/engine-api.md › engine/difficulty.js)

### Implementation for Foundational

- [x] T010 [P] Implement engine/rng.js `createRng(seed)` (mulberry32) with `next`, `int`, `pick`, `state` (research.md R3)
- [x] T011 [P] Create data/game.json with the core roster only — enemies `dropped-packet`, `latency-spike`; tools `ping`, `firewall-rule`; passive `bandwidth-upgrade`; settings and a 20-row difficulty table using only those two enemies — using values from data-model.md › Initial tuning and the shapes in contracts/game-data.md (contracts/game-data.md › Milestone note)
- [x] T012 Implement settings validation in engine/content.js `validateGameData(raw)` returning `{ok, data}` or `{ok:false, errors}` and collecting every error (never throwing), covering data-model.md › Settings.schemaVersion, Settings.player.maxUptime, Settings.player.moveSpeed, Settings.player.pickupRadius, Settings.player.invulnerableSeconds, Settings.player.startingTool, Settings.player.maxTools, Settings.caps.enemies, Settings.caps.pickups, Settings.caps.projectiles, Settings.progression.base, Settings.progression.perLevel, Settings.levelUp.choices, Settings.levelUp.fallbackHealPercent; reject unknown fields
- [x] T013 Add enemy validation to engine/content.js covering data-model.md › Enemy Type.id, Enemy Type.name, Enemy Type.concept, Enemy Type.description, Enemy Type.shape, Enemy Type.color, Enemy Type.radius, Enemy Type.health, Enemy Type.speed, Enemy Type.contactDamagePerSecond, Enemy Type.telemetry, Enemy Type.behavior (including the per-kind fields `count`, `scale`, `maxGenerations`, `intervalSeconds`, `distance` from the Behavior kinds table), Enemy Type.debutLevel
- [x] T014 Add tool and passive validation to engine/content.js covering data-model.md › Tool.id, Tool.name, Tool.concept, Tool.description, Tool.kind, Tool.ranks (per-kind rank fields table), Passive.id, Passive.name, Passive.concept, Passive.description, Passive.ranks; IDs unique across tools and passives
- [x] T015 Add difficulty validation to engine/content.js covering data-model.md › Difficulty Level.level, Difficulty Level.durationSeconds, Difficulty Level.spawnPerSecond, Difficulty Level.healthMultiplier, Difficulty Level.damageMultiplier, Difficulty Level.speedMultiplier, Difficulty Level.mix, plus the data-model.md › Difficulty Level cross-row rules; T008 passes
- [x] T016 [P] Implement engine/difficulty.js `levelAt`, `runLength`, `debutsAt(level)` honouring an optional `levelSeconds` override; T009 passes
- [x] T017 [P] Implement engine/grid.js uniform spatial grid (cell 64) with `clear`, `insert(entity)`, `queryCircle(x, y, r)` (research.md R5)
- [x] T018 [P] Implement engine/hash.js `hashRun(run)` — stable string hash over tick, rng state, engineer, enemies, projectiles, pickups, phase (contracts/engine-api.md › engine/hash.js)
- [x] T019 [P] Implement ui/params.js reading `?seed` and `?levelSeconds` from the URL; non-numbers or ≤ 0 are ignored and flagged (contracts/ui-controls.md › URL parameters)
- [x] T020 Implement ui/screens.js screen manager with Loading, Error (lists every error's id, path, message; no Start), and Title (name, Start button, controls reminder) overlays; moves focus to the first button and announces screen changes via the live region (contracts/ui-controls.md › Screens)
- [x] T021 Implement main.js: show Loading, `fetch('data/game.json')` with a relative URL, run `validateGameData`, then show Error or Title; set up the fixed-step loop (1/60 s, accumulator, max 5 steps per frame) that will call `step()` (research.md R2, R9)

**Checkpoint**: `node tests/run.mjs` passes T007–T009; the page shows Title, or the Error screen for a broken data file

---

## Phase 3: User Story 1 - Survive a run (Priority: P1) 🎯 MVP

**Goal**: Start a run, move, Ping auto-fires at Dropped Packets/Latency Spikes, contact drains
Uptime, and reaching 0% shows the loss screen.

**Independent Test**: Start a run, move with the keyboard, watch Ping defeat enemies, then stand
still until Uptime hits 0%; the loss screen shows time, difficulty, enemies defeated, and seed
(quickstart.md M2–M4, M6).

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail before implementation

- [x] T022 [P] [US1] Write tests/run.test.js (US1 cases): `createRun` puts the engineer at (0,0) with full Uptime, the starting tool, phase `playing`; `step` changes nothing when phase is not `playing`; Uptime ≤ 0 → phase `ended`, outcome `loss`, `run-ended` event (contracts/engine-api.md › engine/run.js)
- [x] T023 [P] [US1] Write tests/combat.test.js: diagonal input moves no faster than straight; opposite keys cancel; contact damage per second × difficulty `damageMultiplier`; no damage during invulnerability; enemy at 0 health is removed and leaves a pickup worth its telemetry; enemy cap skips extra spawns; Ping fires at the nearest enemy only when in range and off cooldown

### Implementation for User Story 1

- [x] T024 [US1] Implement engine/run.js `createRun(data, {seed, levelSeconds})` and `step(run, input)` skeleton holding the fields in data-model.md › Run.seed, Run.rng, Run.phase, Run.tick, Run.elapsed, Run.outcome, Run.stats, and the Engineer fields in data-model.md › Run state › Engineer; `step` appends to `run.events`
- [x] T025 [US1] Implement engine/spawner.js: spawn at the current level's `spawnPerSecond` with an rng-chosen angle just outside the visible radius, pick type by `mix` weights with `run.rng`, apply health/damage/speed multipliers, and enforce data-model.md › Settings.caps.enemies (skip, never queue)
- [x] T026 [P] [US1] Implement the `chase` behavior in engine/behaviors.js (moves toward the engineer at the enemy's speed)
- [x] T027 [US1] Implement the `projectile-nearest` kind (Ping) in engine/weapons.js using the rank fields for `projectile-nearest` in data-model.md › Tool.ranks; projectiles respect `pierce`, `range`, and data-model.md › Settings.caps.projectiles
- [x] T028 [US1] Implement engine/combat.js: engineer movement (normalised, data-model.md › Settings.player.moveSpeed), contact damage with data-model.md › Settings.player.invulnerableSeconds, projectile hits via engine/grid.js, defeats creating a pickup worth data-model.md › Enemy Type.telemetry, `hit`/`player-hit`/`enemy-defeated` events, and the loss transition; wire into `step`; T022–T023 pass
- [x] T029 [P] [US1] Implement ui/input.js: WASD/arrow key state → `{dx, dy}` with opposite keys cancelling; Esc/P and 1/2/3 key callbacks (contracts/ui-controls.md › Keyboard)
- [x] T030 [P] [US1] Implement ui/render.js: dark grid background scrolling with a camera centred on the engineer, the engineer as a glowing cursor node, enemies drawn by data-model.md › Enemy Type.shape and Enemy Type.color, projectiles, pickups; handles window resize without affecting the run (FR-025a, FR-025b)
- [x] T031 [P] [US1] Implement ui/hud.js showing Uptime percentage and bar and total run time (FR-028, first part)
- [x] T032 [US1] Add the End screen to ui/screens.js: outcome, time survived, difficulty reached, enemies defeated, engineer level, tools/passives with ranks, seed, and a New Run button (FR-003)
- [x] T033 [US1] Wire main.js: Start creates a run (seed from ui/params.js or a fresh random seed chosen in the UI layer), the loop feeds ui/input.js into `step`, renders, updates HUD, clears events, shows a brief hit flash on `player-hit`, and opens the End screen on `run-ended`

**Checkpoint**: A run can be started, played, and lost; tests pass

---

## Phase 4: User Story 2 - Level up and build a loadout (Priority: P1)

**Goal**: Telemetry fills a bar; each level-up pauses and offers 3 distinct choices with exact
numbers; Firewall Rule and Bandwidth Upgrade are available.

**Independent Test**: Play until the bar fills; three distinct choices with descriptions and
exact changes appear; the chosen effect is active after resuming (quickstart.md M5).

### Tests for User Story 2 ⚠️

- [x] T034 [P] [US2] Write tests/progression.test.js: `telemetryToNext` strictly increases; offers have 3 distinct items when 3 or more candidates exist, and exactly the remaining candidates (no duplicates) when only 1–2 exist; no new tools offered once `maxTools` are owned; max-rank items never offered; fallback heal when no candidates; `describeChange` values equal the stats applied after `chooseUpgrade`; one pickup worth several levels queues several level-ups resolved one at a time; `chooseUpgrade` with a bad index or outside `levelup` returns `{ok:false}` and changes nothing
- [x] T035 [P] [US2] Add to tests/combat.test.js: pickups inside the pickup radius move to and are collected by the engineer; exceeding the pickup cap merges the oldest two with no telemetry lost; Firewall Rule barriers damage each touched enemy at most once per `hitCooldown`

### Implementation for User Story 2

- [x] T036 [US2] Implement engine/progression.js: `telemetryToNext` from data-model.md › Settings.progression.base and Settings.progression.perLevel; passive stat totals from data-model.md › Passive.ranks applied to engineer move speed and pickup radius; `buildOffer` per data-model.md › Level-up offer using data-model.md › Settings.levelUp.choices, Settings.player.maxTools, and Settings.levelUp.fallbackHealPercent with `run.rng`; `describeChange` from the rank tables
- [x] T037 [US2] Add pickup attraction/collection (data-model.md › Settings.player.pickupRadius) and cap merging (data-model.md › Settings.caps.pickups) to engine/combat.js; collection adds telemetry and raises `level-up` events
- [x] T038 [US2] Add the `levelup` phase to engine/run.js: `pendingLevelUps`, `offer`, and `chooseUpgrade(run, index)` that adds a new tool or raises a rank, then returns to `playing` or opens the next pending offer (data-model.md › State transitions)
- [x] T039 [P] [US2] Implement the `orbit` kind (Firewall Rule) in engine/weapons.js using the rank fields for `orbit` in data-model.md › Tool.ranks; T034–T035 pass
- [x] T040 [US2] Add the Level-up overlay to ui/screens.js: up to 3 choices showing name, "New" or "Rank a → b", description, and every `describeChange` line; select with 1/2/3, click, or Tab+Enter; focus first choice; announce via live region (FR-015)
- [x] T041 [US2] Extend ui/hud.js with the telemetry bar, engineer level, and owned tools/passives with ranks (FR-028); draw Firewall Rule barriers in ui/render.js

**Checkpoint**: Level-ups work end to end with 3 real choices; tests pass

---

## Phase 5: User Story 3 - Escalating difficulty to a win (Priority: P1)

**Goal**: Difficulty climbs 1→20 on the data-defined timer, new enemy types are announced, and
surviving level 20 wins.

**Independent Test**: Open `?seed=12345&levelSeconds=2`; the difficulty indicator advances every
2 s, Latency Spike is announced at level 4, and the win screen appears after 40 s (quickstart.md M7).

### Tests for User Story 3 ⚠️

- [x] T042 [P] [US3] Add to tests/run.test.js: a `difficulty-up` event at each level boundary with `debuts` listing that level's new enemies; outcome `win` when elapsed reaches `runLength` with Uptime > 0; Uptime reaching 0 on that same step gives `loss` (spec Edge Cases); `levelSeconds` override shortens the run

### Implementation for User Story 3

- [x] T043 [US3] Add difficulty progression to engine/run.js: track `difficultyLevel` via engine/difficulty.js, emit `difficulty-up` with debuts, apply damage before the win check, end with `win` at `runLength`; record `highestDifficulty` in stats; T042 passes
- [x] T044 [P] [US3] Extend ui/hud.js with "Difficulty N / 20", seconds left in the level, and a small test-setting label when a URL parameter is active (research.md R7)
- [x] T045 [US3] Add banners to ui/screens.js — "Difficulty N" on each level and "New threat: <name> — <concept>" on debuts, announced via the live region — and the Win variant of the End screen
- [x] T046 [US3] Pass ui/params.js `seed` and `levelSeconds` into `createRun` in main.js and route `difficulty-up` events to the banners

**Checkpoint**: A shortened run can be won; full timing matches 20 × 60 s

---

## Phase 6: User Story 4 - Restart, pause, and replay (Priority: P2)

**Goal**: Pause/resume, auto-pause on focus loss, New Run, Replay Seed, Quit to Title.

**Independent Test**: Pause mid-run and confirm nothing moves; switch tabs and return paused;
from the end screen, Replay Seed reproduces the opening spawns (quickstart.md M8).

### Tests for User Story 4 ⚠️

- [x] T047 [P] [US4] Write tests/determinism.test.js: same seed + a recorded 3,600-step input sequence (with scripted level-up choices) → identical `hashRun` on two runs; stepping in `paused` or `levelup` leaves the hash unchanged; in Node, scan every file in `engine/` and fail if it contains `Math.random`, `document`, `window`, or `fetch` (skipped with a visible note in the browser runner) (research.md R4)

### Implementation for User Story 4

- [x] T048 [US4] Implement `pause(run)` and `resume(run)` in engine/run.js (ignored outside `playing`/`paused`); T047 passes
- [x] T049 [P] [US4] Add `visibilitychange` and window `blur` handling to ui/input.js that requests a pause (FR-004)
- [x] T050 [US4] Add the Pause overlay (Resume, Quit to Title) and the Replay Seed button on the End screen to ui/screens.js
- [x] T051 [US4] Wire main.js: Esc/P toggles pause; New Run uses a fresh seed; Replay Seed reuses the last seed; Quit to Title discards the run

**Checkpoint**: All of US1–US4 work with the core roster

---

## Phase 7: Core-Loop Milestone Gate (FR-029, SC-012)

**Purpose**: Prove the core loop before building the remaining roster (constitution C7)

**⚠️ STOP**: Do not start Phase 8 until every row below is recorded as pass, or a failure is fixed

- [x] T052 Run `node tests/run.mjs` and http://127.0.0.1:8000/tests/; record M1 (pass/fail, date, browser, totals) in README.md
- [x] T053 Perform quickstart.md M2–M9 in a browser and record each as pass / fail / not run with date, browser, and notes in README.md
- [x] T054 Record the fresh-start milestone playthrough (level-up with 3 choices, a loss, a win via `?levelSeconds=2`) as SC-012 evidence in README.md

**Checkpoint**: Milestone recorded; the core loop is demonstrably done

---

## Phase 8: Full Roster (FR-030) — serves US2 and US3

**Goal**: Add Broadcast Storm, Route Flap, DDoS Botnet, Ansible Playbook, Load Balancer, and
Redundant Power Supply.

**Independent Test**: In a fast seeded run, new-threat banners appear at levels 8, 12, 16;
Broadcast Storm splits, Route Flap blinks, DDoS Botnet is large and slow; all 4 tools and 2
passives can be offered (quickstart.md F1–F3).

### Tests for Full Roster ⚠️

- [x] T055 [P] [US3] Write tests/behaviors.test.js (enemies): `split` spawns `count` copies at `scale` size/health and last-generation copies do not split; `blink` jumps `distance` toward the engineer every `intervalSeconds`
- [x] T056 [P] [US2] Add to tests/behaviors.test.js (tools): `pulse` damages every enemy within `radius` and none outside; `spread` fires `projectiles` evenly spaced projectiles; Redundant Power Supply raises max Uptime and regenerates per second

### Implementation for Full Roster

- [x] T057 [US3] Implement `split` and `blink` in engine/behaviors.js using the per-kind fields in data-model.md › Enemy Type.behavior; split copies respect data-model.md › Settings.caps.enemies; T055 passes
- [x] T058 [P] [US2] Implement `pulse` and `spread` kinds in engine/weapons.js using the per-kind rank fields in data-model.md › Tool.ranks
- [x] T059 [US2] Apply data-model.md › Passive.ranks `maxUptimeBonus` and `regenPerSecond` in engine/progression.js and engine/combat.js; T056 passes
- [x] T060 [US3] Add `broadcast-storm`, `route-flap`, `ddos-botnet` to data/game.json from data-model.md › Initial tuning, and update the difficulty `mix` so they debut at levels 8, 12, 16 and level 20 contains all five
- [x] T061 [US2] Add `ansible-playbook`, `load-balancer`, `redundant-power-supply` to data/game.json from data-model.md › Initial tuning
- [x] T062 [US3] Draw the new shapes (hexagon, diamond, octagon) and the Ansible pulse ring and Load Balancer projectiles in ui/render.js
- [x] T063 Update tests/content.test.js and tests/difficulty.test.js expectations for the full roster (debuts 1/4/8/12/16); `node tests/run.mjs` passes

**Checkpoint**: Full roster playable; F1–F3 can be checked

---

## Phase 9: User Story 5 - Understand the networking theme (Priority: P3)

**Goal**: Every enemy, tool, and passive clearly names the real networking concept it represents.

**Independent Test**: A reviewer reads every in-game description and names the real concept for
each (quickstart.md F8, SC-007).

- [x] T064 [P] [US5] Review and finalise `name`, `concept`, and `description` (one line, ≤ 120 characters — a task-specific narrowing of data-model.md › Enemy Type.description, Tool.description, Passive.description) for all 11 items in data/game.json for technical accuracy (constitution C7: fix inaccurate networking descriptions first)
- [x] T065 [US5] Add a check to tests/content.test.js that every description is ≤ 120 characters and every item has a non-empty `concept`
- [x] T066 [US5] Confirm the End screen lists owned tools/passives with ranks and banners show the concept; record F8 (reviewer result) in README.md

**Checkpoint**: All user stories complete

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Performance, accessibility, balance, and recorded verification

- [x] T067 [P] Pre-render each glowing shape once to an off-screen canvas and draw the cached images in ui/render.js; no `shadowBlur` in the per-frame loop (research.md R6)
- [x] T068 [P] Add particle bursts on `enemy-defeated` and a small screen shake on `player-hit` in ui/render.js, all disabled under `prefers-reduced-motion: reduce` (contracts/ui-controls.md › Accessibility)
- [x] T069 Check performance with ~300 enemies on screen (late difficulty, fixed seed); record F5 with device in README.md; if it stutters, profile and fix before continuing
- [x] T070 Tune data/game.json against SC-002 (first level-up within 60 s) and SC-011 (moderate difficulty); keep data/game.json valid and tests passing
- [x] T071 Perform quickstart.md F1–F7, F9 and record pass / fail / not run in README.md
- [x] T072 Run the 5-player playtest (F10) for SC-010 and SC-011, or record it as "not run" in README.md
- [x] T075 Perform the originality review (constitution C1 Evidence, FR-025): confirm every enemy, tool, and passive name and description in data/game.json, all drawn shapes in ui/render.js, and all UI text in ui/screens.js are original and contain no third-party game names, characters, or assets; confirm the repository contains no image, audio, or font files from other games; record the result as F11 (pass / fail, date, reviewer) in README.md
- [x] T073 [P] Finalise README.md: accurate description of the shipped game, controls, run/test commands, known issues, and the completed verification table including F11 from T075 (constitution C7)
- [ ] T074 (Not done: publishing is outward-facing and was not requested; local subpath check passed — see README) Optional: publish to GitHub Pages and confirm data and modules load under the repository subpath; record the result in README.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup; blocks every story
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on US1 (needs enemies, combat, pickups from defeats)
- **US3 (Phase 5)**: depends on US1 (needs spawning and the loss path); independent of US2
- **US4 (Phase 6)**: depends on US1; the determinism test's scripted level-up choices need US2
- **Milestone Gate (Phase 7)**: depends on US1–US4
- **Full Roster (Phase 8)**: depends on the Milestone Gate
- **US5 (Phase 9)**: depends on Phase 8 (all 11 items exist)
- **Polish (Phase 10)**: depends on Phase 9; T067–T068 may start any time after US1
- T075 runs after T064 (final descriptions) and before T073 (README finalisation)

### Within Each Phase

- Tests are written first and must fail before implementation
- `engine/` before `ui/` before `main.js` wiring
- engine/content.js tasks T012 → T013 → T014 → T015 run in order (same file)
- Tasks editing the same file (engine/run.js, ui/screens.js, ui/hud.js, main.js) run in order

### Parallel Opportunities

- Setup: T002–T006 together after T001
- Foundational: tests T007–T009 together; T010, T011, T016–T019 together
- US1: T022–T023 together; T026, T029, T030, T031 together
- US2: T034–T035 together; T039 alongside T036–T038
- US3 can run in parallel with US2 after US1 (different engine areas; coordinate on engine/run.js)
- Phase 8: T055–T056 together; T058 alongside T057
- Polish: T067, T068, T073 together

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Write tests/run.test.js (US1 cases)"
Task: "Write tests/combat.test.js"

# Then independent modules, together:
Task: "Implement chase behavior in engine/behaviors.js"
Task: "Implement ui/input.js"
Task: "Implement ui/render.js"
Task: "Implement ui/hud.js (Uptime and time)"
```

## Parallel Example: Full Roster

```bash
Task: "Write tests/behaviors.test.js (enemies)"
Task: "Add tool tests to tests/behaviors.test.js"
Task: "Implement pulse and spread in engine/weapons.js"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 → **stop and validate**: start, move, auto-fire, lose

### Core-Loop Milestone (required before the full roster)

1. Add US2 (level-ups), US3 (20 levels + win), US4 (pause/replay)
2. Phase 7: record M1–M9 and the milestone playthrough in README.md

### Full First Playable

1. Phase 8 full roster → Phase 9 theme review → Phase 10 polish and recorded verification
2. If time runs short after the milestone: propose the smallest coherent scope cut, update
   spec.md and this file, and record it (constitution C7) — never mark unrun checks as passed

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- A checked box is not evidence on its own; README.md records pass / fail / not run (C7)
- Commit after each task or logical group
- No tasks for out-of-scope items (persistence, audio, multiplayer, editor, multiple maps, touch)
