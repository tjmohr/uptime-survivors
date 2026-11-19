---

description: "Task list for feature 006 — Late-Game Upgrades"
---

# Tasks: Late-Game Upgrades

**Input**: Design documents from `specs/006-late-game-upgrades/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan and quickstart require unit tests U1–U8, balance simulation S1–S4, scripted
browser checks B1–B4, and human checks H1–H2 (constitution C7).

**Organization**: US1 Choose a build (P1) · US2 Stronger passives (P1) · US3 Level-ups never go dead (P1)
· US4 The new items fit the game (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Paths are relative to the repository root.

## Global rules for every task

- Engine code stays pure and deterministic (no DOM, timers, or `Math.random` in `engine/`); this feature
  adds **no** `run.rng` calls.
- Every number shown to the player comes from `engine/stats.js` or the data (constitution C6).
- Major Incidents are never slowed (spec clarification Q3); every run still starts with Ping (Q2).
- After each phase run `jsc -m tests/run.mjs` (all 146 existing tests stay green, except tests updated
  on purpose and named in a task) and, from Phase 6 on, `python3 tests/browser/drive.py`.

---

## Phase 1: Setup

- [x] T001 Create `tests/upgrades.test.js` with the harness pattern of `tests/incidents.test.js` and register it in `tests/files.js`; add `'stats'` to `ENGINE_FILES` in the purity scan in `tests/determinism.test.js`
- [x] T002 [P] Create `engine/stats.js` with the exports in [contracts/engine-api.md](./contracts/engine-api.md) (stubs) and `tests/balance/upgrades.mjs` skeleton (argument handling `-- s1|s2|s3|s4 [seed]` copied from `tests/balance/incidents.mjs`)

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: data, validation, bonus maths, and run state that every story needs.

- [x] T003 Add the 3 tools, 4 passives, and `repeatable` to `data/game.json` with the starting values and text in [contracts/game-data.md](./contracts/game-data.md); set `levelUp.fallbackHealPercent` to 15 (data-model.md › Level-up.`levelUp.fallbackHealPercent`)
- [x] T004 Extend validation in `engine/content.js`: `TOOL_KIND_FIELDS` gains `chain`, `aura`, `zone` (data-model.md › Tool Definition.`kind`) with each kind's rank stats validated per data-model.md › Tool Definition — chain: `damage`, `cooldown`, `range`, `hops` (integer), `hopRange`; aura: `damage`, `tickInterval`, `radius`, `slowPercent`; zone: `damage`, `tickInterval`, `cooldown`, `range`, `radius`, `duration`; `PASSIVE_FIELDS` gains the four stats with their caps (data-model.md › Passive Definition.`cooldownReductionPercent`, `.damagePercent`, `.telemetryGainPercent`, `.damageReductionPercent`); validate top-level `repeatable` (data-model.md › Repeatable Upgrade.`id`, `.name`, `.concept`, `.description`, `.damagePercentPerTake`) and add its id to the shared id set; allow `repeatable` in `TOP_FIELDS`
- [x] T005 Add run state in `engine/run.js › createRun`: `engineer.capacityTakes = 0` (data-model.md › Engineer.`capacityTakes`), `zones: []` (data-model.md › Zone), `slowField: null` (data-model.md › Slow Field); give aura tools `tickLeft` when added (data-model.md › Tool.`tickLeft`)
- [x] T006 Implement `bonusTotals`, `effectiveToolStats`, `repeatableBonus` in `engine/stats.js` per data-model.md › Derived values (Link Aggregation + Capacity Planning add for damage; QoS reduces `cooldown` and `hitCooldown` only)
- [x] T007 Extend `passiveTotals` in `engine/progression.js` to sum the four new passive fields (it iterates `PASSIVE_FIELDS`, so confirm and add a test)
- [x] T008 Add `capacityTakes`, zones (`x:y:radius:expiresAt:nextTickAt`), and the slow field to `engine/hash.js › hashRun`
- [x] T009 Write U1 in `tests/upgrades.test.js` (and extend `tests/content.test.js` if that is where broken-copy tests live): shipped data passes; each broken copy listed in quickstart U1 fails naming the item
- [x] T010 Write U2 in `tests/upgrades.test.js`: `effectiveToolStats` with Link Aggregation rank 3 + 2 Capacity takes → damage × 1.28; QoS rank 2 → cooldown and Firewall `hitCooldown` × 0.9; other stats unchanged; no passives → rank values exactly
- [x] T011 Update existing tests that assume today's content: `tests/behaviors.test.js` roster test (now 7 tools, 6 passives), `tests/progression.test.js` heal test (reads data, confirm 15%), and `tests/guide.test.js` loadout counts

**Checkpoint**: `jsc -m tests/run.mjs` green; data validated.

---

## Phase 3: User Story 1 — Choose a build (P1) 🎯 MVP

**Goal**: three new tools that work, are offered from the first level-up, and respect the 4-tool limit.

**Independent test**: U3–U5, U7 (offer part) — seeded runs with each new tool owned resolve problems with
the documented behaviour; offers never include a 5th tool.

### Tests for User Story 1

- [x] T012 [P] [US1] Write U3 (Traceroute) in `tests/upgrades.test.js`: hits nearest in `range`, then ≤ `hops` distinct problems each within `hopRange` of the previous; stops early; waits with nothing in range; one `chain` event whose points match the hits
- [x] T013 [P] [US1] Write U4 (Rate Limiter) in `tests/upgrades.test.js`: damage every `tickInterval` to all problems inside incl. a Major Incident; ordinary enemy inside moves `speed × (1 − slow)` per step, outside full speed; incident never slowed; infected enemy slowed from infected speed; offline → `slowField` null and no damage
- [x] T014 [P] [US1] Write U5 (Null Route) in `tests/upgrades.test.js`: placed on the problem with most neighbours within `radius` (tie → lowest id); damages all inside each tick until `duration`; never more than 8 zones; waits with nothing in range; `zone-placed` event
- [x] T015 [P] [US1] Write U7 (offer part) in `tests/upgrades.test.js`: new tools can be offered at the first level-up; once 4 tools are owned no tool is offered; Ping is always the starting tool

### Implementation for User Story 1

- [x] T016 [US1] Make `engine/weapons.js` read stats through `effectiveToolStats` for every kind (existing kinds unchanged when no bonus)
- [x] T017 [US1] Implement kind `chain` in `engine/weapons.js` per research R2 (nearest within `range`, hops via grid queries, `hit` per target, one `chain` and one `fire` event)
- [x] T018 [US1] Implement kind `aura` in `engine/weapons.js`: publish `run.slowField` each step while online (data-model.md › Slow Field.`x`, `.y`, `.radius`, `.factor`), reset it to `null` at the start of `updateWeapons`; tick damage with `tool.tickLeft` (data-model.md › Tool.`tickLeft`)
- [x] T019 [US1] Apply the slow in `engine/behaviors.js`: ordinary enemies (not `incidentId`) inside `run.slowField` move at step speed × `factor`; stored `speed` unchanged
- [x] T020 [US1] Implement kind `zone` in `engine/weapons.js`: densest-target placement with lowest-id tie-break, zone creation with effective `damage`/`tickInterval` (data-model.md › Zone.`x`, `.y`, `.radius`, `.damage`, `.tickInterval`, `.expiresAt`, `.nextTickAt`), cap 8, per-step zone ticks and expiry, `zone-placed` event
- [x] T021 [US1] Confirm `engine/progression.js › candidates` offers any unowned tool while fewer than `maxTools` (4) are owned (no gate) and that offline handling in `engine/incidents.js` (link-down) works for the new tools; add the test cases to U7

**Checkpoint**: US1 playable in the engine; U3–U5 and U7 (offers) pass.

---

## Phase 4: User Story 2 — Stronger passives (P1)

**Goal**: QoS Policy, Link Aggregation, Observability Stack, Hardened Config change the game by exactly their numbers.

**Independent test**: U6 — measured cooldowns, damage, telemetry, and Uptime loss match the rank percentages.

- [x] T022 [P] [US2] Write U6 in `tests/upgrades.test.js`: Ping cooldown with QoS rank 5 = 0.75 × rank cooldown (measured in fire events); Link Aggregation rank 2 → hit `amount` × 1.12; Observability rank 1 → a 10-value pickup and an incident reward give × 1.08; Hardened Config rank 4 → contact damage × 0.8
- [x] T023 [US2] Apply telemetry gain in `engine/combat.js › updatePickups` (`value × (1 + telemetryGainPercent/100)`) via `passiveTotals`
- [x] T024 [US2] Apply damage reduction in `engine/combat.js › applyContactDamage` (`amount × (1 − damageReductionPercent/100)`) via `passiveTotals`

**Checkpoint**: U6 passes (QoS and Link Aggregation already flow through T006/T016).

---

## Phase 5: User Story 3 — Level-ups never go dead (P1)

**Goal**: an exhausted pool offers exactly Capacity Planning and Failover; Capacity Planning stacks.

**Independent test**: U7 (exhausted part) + S2 — a maxed run's offers are always `[Capacity Planning, Failover]`.

- [x] T025 [P] [US3] Write U7 (exhausted part) in `tests/upgrades.test.js`: with all owned tools and all passives at rank 5 and 4 tools owned, `buildOffer` returns exactly `[repeatable, heal]`; never earlier; choosing it increments `capacityTakes` and raises effective damage by `damagePercentPerTake`; Failover heals 15% capped at max
- [x] T026 [US3] In `engine/progression.js`: `buildOffer` returns `[repeatable, heal]` when `candidates` is empty (data-model.md › Level-up Offer Item.`kind`, `.timesTaken`, `.changes`); `describeChange` for `repeatable` gives `allDamagePercent` from n·p to (n+1)·p; `applyUpgrade` increments `engineer.capacityTakes` (data-model.md › Engineer.`capacityTakes`)
- [x] T027 [US3] Write U8 in `tests/determinism.test.js`: identical seeded runs with all three new tools forced into the loadout give identical hashes; changing `capacityTakes`, a zone, or the slow field changes the hash

**Checkpoint**: engine complete; U1–U8 pass.

---

## Phase 6: User Story 4 — The new items fit the game (P2)

**Goal**: balance within limits; new items drawn, listed, and explained everywhere; Field Guide updated.

**Independent test**: S1–S4 pass; B1–B3 pass.

### Balance (run before UI work — plan "first evidence")

- [x] T028 [US4] Implement S1–S4 in `tests/balance/upgrades.mjs` per quickstart (feature 004 bot movement; S3 picks choices with a separate `createRng(seed + 1000)`; S4 baseline = data with the new tools, passives, and `repeatable` removed and heal 20)
- [x] T029 [US4] Run S1–S4 (parallel per seed like feature 004) and tune rank numbers in `data/game.json` until they pass; record each run's results and any value changes in `specs/006-late-game-upgrades/contracts/game-data.md` (final values) — if a check cannot pass, record it honestly as failing with the evidence

### UI

- [x] T030 [P] [US4] Extend `ui/stattext.js` with the new labels and the `(X with bonuses)` suffix per [contracts/ui.md](./contracts/ui.md) › Stat text (rounding ≤ 2 decimals, display only)
- [x] T031 [US4] Level-up screen in `ui/screens.js`: tool choices show effective values from `effectiveToolStats` for the new rank under current bonuses; Capacity Planning choice ("Taken n×", change line) as [1] and Failover as [2] with "Restore Uptime +15%"; spoken text names both
- [x] T032 [P] [US4] HUD loadout in `ui/hud.js` and end screen in `ui/screens.js`: new items listed with ranks; "Capacity Planning ×n" when n > 0
- [x] T033 [US4] Field Guide: `ui/guide.js` adds the Capacity Planning entry (times taken, total bonus) and effective values on owned tools' stats; `ui/screens.js` renders them; `ui/icons.js` adds icons for `chain`, `aura`, `zone` and the four passives and adds the three tools to `TOOL_COLORS`; update `tests/guide.test.js` G1/G3/G4 for 7 + 6 + 1 entries and the effective-value text
- [x] T034 [US4] Play-field drawing in `ui/render.js` per [contracts/ui.md](./contracts/ui.md) › Play field (Traceroute path from `chain` events, Rate Limiter ring from `run.slowField`, Null Route zones from `run.zones`), honouring reduced motion
- [x] T040 [P] [US4] Map new engine events to existing sounds in `audio/director.js` (`zone-placed` → `pulse`; Traceroute already emits `fire`) and add a test in `tests/audio-director.test.js` that a `zone-placed` event plays `pulse` and a chain step plays `fire`, within the effect cap
- [x] T035 [US4] Create `tests/browser/smoke-upgrades.html` with modes `tools` (B1, including sound counts: Traceroute → `fire`, Null Route → `pulse`, Rate Limiter ticks → `hit`), `levelup` (B2), `guide` (B3) and register them in `tests/browser/drive.py` with `--only upgrades`

**Checkpoint**: all stories complete; S1–S4 and B1–B3 recorded.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T036 Run the full suites (B4): `jsc -m tests/run.mjs`, `python3 tests/browser/drive.py` (incl. 300-enemy performance with all three new tools owned and the phone fit check with the longer level-up text); fix regressions; re-run `jsc -m tests/balance/incidents.mjs -- s1` and `-- s2` with the new content and update README rows I-S1/I-S2 with the new results (pass or fail)
- [x] T037 [P] Update `README.md`: intro tool list, a "Late-game upgrades" section (new tools/passives, Capacity Planning, Failover 15%), controls unchanged, verification rows L-U1–L-U8, L-S1–L-S4, L-B1–L-B4, L-H1–L-H2 with results; project layout line for `specs/006-late-game-upgrades/`
- [x] T038 [P] Add notes to `specs/005-field-guide/spec.md` (now 7 tools, 6 passives, and Capacity Planning) and `specs/001-survivors-first-playable/contracts/game-data.md` (new kinds, passive stats, `repeatable`, heal 15%)
- [x] T039 Update `specs/006-late-game-upgrades/spec.md` Status with the recorded results (constitution C7)

---

## Phase 8: Balance follow-up (added after implementation, user decisions 2026-11-19)

- [x] T041 [US4] Tool floor (spec FR-004a): `levelUp.toolFloor` in `data/game.json` (data-model.md › Level-up.`levelUp.toolFloor`) with validation in `engine/content.js`; `buildOffer` in `engine/progression.js` offers only new tools below the floor and marks items `forced` (data-model.md › Level-up Offer Item.`forced`); remove the interim "one new tool in every offer" rule
- [x] T042 [US4] Level-up note "Your network needs more tools: choose one." (screen and spoken) in `ui/screens.js`, style in `style.css`; browser check in `tests/browser/smoke-upgrades.html` (B2)
- [x] T043 [US4] Unit tests for the floor and its validation in `tests/upgrades.test.js`; passive tests read percentages from the data
- [x] T044 [US4] Front-load the four new passives (spec FR-010a) in `data/game.json`; add `s4random` and `s4first` bots (separate random state per run) to `tests/balance/upgrades.mjs`; re-run S1–S4, the extra bots, and feature 004's I-S1/I-S2; record in `contracts/game-data.md`
- [x] T046 [US4] Standing Major Incident alerts (spec FR-018): `#incident-alerts` in `index.html`; `showIncidentAlert` / `resolveIncidentAlert` / `clearIncidentAlerts` in `ui/screens.js`; wiring in `main.js` (incidents announced after same-step banners; `--hud-bottom` CSS variable so alerts sit below the HUD); pulse, green, reduced-motion, and phone styles in `style.css`; browser checks in `tests/browser/smoke-incidents.html` (B1 persistence, B3 green + removal, B4 two lines, new B7 reduced motion) and `tests/browser/touch_checks.py` (B6 alert inside the safe area at 360 × 640 to 844 × 390); note in `specs/004-major-incidents/contracts/ui-audio.md`
- [x] T045 Update README (late-game section, L- rows, I-S rows, known limits) and re-run the full browser suite

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T011)** → stories.
- **US1 (T012–T021)**, **US2 (T022–T024)**, **US3 (T025–T027)** each need only Foundational; they touch
  different functions but share `engine/weapons.js` (US1) / `engine/combat.js` (US2) /
  `engine/progression.js` (US3), so they can proceed in parallel by file.
- **US4 (T028–T035, T040)** needs US1–US3 (balance needs all content working; UI shows all of it). T028–T029
  come before T030–T035.
- **Polish (T036–T039)** last.

## Parallel examples

- Foundational: T006 (`engine/stats.js`) ∥ T008 (`engine/hash.js`) after T003–T005.
- US1 tests T012 ∥ T013 ∥ T014 ∥ T015 (separate test blocks; write in one pass if editing conflicts).
- US2 and US3 alongside US1 (different engine files).
- US4: T030 (stattext) ∥ T032 (HUD) ∥ T034 (render) ∥ T040 (audio director) once T029 is done.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1 + US3 engine part**: build variety and the never-dead level-up —
   the two problems the user reported. Verify with U1–U5, U7, U8.
2. **+ US2**: passives (U6).
3. **+ US4 balance first** (S1–S4), then UI (B1–B3).
4. **Polish**: full regression (B4), README, notes, status. If time runs short, ship without the
   play-field polish of T034 beyond a basic drawing, and record what was cut.
