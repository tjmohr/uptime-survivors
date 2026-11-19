---

description: "Task list for feature 004 — Major Incident Boss Encounters"
---

# Tasks: Major Incident Boss Encounters

**Input**: Design documents from `specs/004-major-incidents/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included — the plan and quickstart require unit tests U1–U7, balance simulation S1–S2,
scripted browser checks B1–B7, and human checks H1–H2 (constitution C7).

**Organization**: US1 Face a Major Incident (P1) · US2 Three different incidents (P1) · US3 The run
still flows (P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Paths are relative to the repository root.

## Global rules for every task

- Engine code stays pure and deterministic: randomness only from `run.rng`; no DOM, timers, or
  `Math.random` in `engine/` (the existing purity scan covers `engine/incidents.js` once registered).
- Incident stats are absolute; difficulty multipliers never apply to incidents (spec FR-006).
- After each phase run `jsc -m tests/run.mjs` (all existing 113 tests stay green) and the existing
  browser checks (`python3 tests/browser/drive.py`).

---

## Phase 1: Setup

- [x] T001 Create `engine/incidents.js` (empty exports per [contracts/engine-api.md](./contracts/engine-api.md)) and add `'incidents'` to `ENGINE_FILES` in the purity scan in `tests/determinism.test.js`
- [x] T002 [P] Create `tests/incidents.test.js` with the harness pattern and register it in `tests/files.js`; create folder `tests/balance/`

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Incident data, validation, records, hashing, and the reward-pickup rule that all stories use.

### Tests first

- [x] T003 [P] Write U1 in `tests/content.test.js`: shipped data passes; broken copies fail naming the id and path for — missing `incidents`, not exactly 3 incidents, duplicate `arrivalLevel`, incident id equal to an enemy/tool/passive id, unknown `behavior.kind`, missing behaviour field, extra behaviour field, unknown `minionType`, `cooldownSeconds` ≤ `warningSeconds` + `offlineSeconds`, `radius` not larger than every enemy radius, `entrySpeed` < `speed`, `incidentSpawnFactor` 0 or > 1, incident contact damage not above the strongest ordinary enemy at its arrival level, unknown field
- [x] T004 [P] Write the reward-pickup cap test in `tests/incidents.test.js`: with the pickup cap reached, adding ordinary pickups merges the two oldest **non-reward** pickups and never merges or removes a `reward` pickup

### Implementation

- [x] T005 Add `incidentSpawnFactor` and the three `incidents` to `data/game.json` exactly as the starting values in [contracts/game-data.md](./contracts/game-data.md) (tuned later in T031)
- [x] T006 Validate incidents in `engine/content.js` (export `INCIDENT_FIELDS`, `INCIDENT_BEHAVIOR_FIELDS`) per data-model.md top-level `incidents` and `incidentSpawnFactor`; data-model.md `IncidentDefinition.id`, `IncidentDefinition.name`, `IncidentDefinition.concept`, `IncidentDefinition.description`, `IncidentDefinition.arrivalLevel`, `IncidentDefinition.shape`, `IncidentDefinition.color`, `IncidentDefinition.radius`, `IncidentDefinition.health`, `IncidentDefinition.speed`, `IncidentDefinition.entrySpeed`, `IncidentDefinition.entryDistance`, `IncidentDefinition.contactDamagePerSecond`, `IncidentDefinition.rewardTelemetry`, `IncidentDefinition.behavior`; and data-model.md `IncidentBehavior.intervalSeconds`, `IncidentBehavior.burst`, `IncidentBehavior.maxAlive`, `IncidentBehavior.minionType`, `IncidentBehavior.cooldownSeconds`, `IncidentBehavior.warningSeconds`, `IncidentBehavior.offlineSeconds`, `IncidentBehavior.radius`, `IncidentBehavior.healthMultiplier`, `IncidentBehavior.speedMultiplier` (fields required per kind, extras rejected); errors use the existing `{path, id, message}` shape and the incident id; plus a cross-file check: each incident's `contactDamagePerSecond` must be greater than the highest ordinary enemy `contactDamagePerSecond × damageMultiplier` in the difficulty row for its `arrivalLevel` (error at `incidents[i].contactDamagePerSecond`, spec FR-007)
- [x] T007 Implement `createIncidentRecords(data)` and `activeIncidentCount(run)` in `engine/incidents.js` per data-model.md `IncidentRecord.id`, `IncidentRecord.state`, `IncidentRecord.arrivedAt`, `IncidentRecord.resolvedAt`; add `run.incidents = createIncidentRecords(data)` and `defs.incident` (Map by id) to `createRun` in `engine/run.js`
- [x] T008 Exempt reward pickups from the cap in `addPickup` in `engine/combat.js` per data-model.md `Pickup.reward`: when over the cap, merge the two oldest non-reward pickups; reward pickups are never merged or removed
- [x] T009 Extend `hashRun` in `engine/hash.js` with incident records (`id:state`), incident entities' `incidentId`, `phase`, `timer`, `linkState`, `pendingTool`, enemies' `infected`, tools' `offlineUntil`, and pickups' `reward`
- [x] T010 [P] Add the incident events and the `step` input/run additions to `specs/001-survivors-first-playable/contracts/engine-api.md` (events table: `incident-arrived`, `incident-resolved`, `link-warning`, `link-down`, `link-restored`, `infected`, `infection-cleared`, `leak`), referencing [contracts/engine-api.md](./contracts/engine-api.md)

**Checkpoint**: U1 and the cap test pass; all existing tests pass; the game plays unchanged (no
incident arrives yet).

---

## Phase 3: User Story 1 — Face a Major Incident (Priority: P1) 🎯 MVP

**Goal**: An incident arrives at its level with banner, alarm, HUD bar and pointer; it can be fought
and resolved; resolution shows a banner, plays a sound, and drops the glowing reward.

**Independent Test**: `?levelSeconds=4`: at level 7 Route Leak arrives (banner, alarm, bar, on screen
within 2 s, pointer while off-screen); damage it to zero → RESOLVED banner, sound, big pulsing reward;
collecting it gives about one level-up (B1, B3; U2, U4).

### Tests for User Story 1

- [x] T011 [P] [US1] Write U2 in `tests/incidents.test.js`: incidents arrive on the step their level begins (7, 12, 18; also with `levelSeconds` test overrides), 720 u from the engineer, within 330 u by 2.0 s of game time; record becomes `active` with `arrivedAt`; exactly one `incident-arrived` event each; arrival direction comes from `run.rng` (two seeds differ, same seed identical)
- [x] T012 [P] [US1] Write U4 in `tests/incidents.test.js`: health 0 → one `incident-resolved` event, record `resolved` with `resolvedAt`, no ordinary telemetry drop, exactly one reward pickup with `value = rewardTelemetry` and `reward: true` at the incident's position; collecting it adds that telemetry; contact with an incident drains Uptime at its own `contactDamagePerSecond`

### Implementation for User Story 1

- [x] T013 [US1] Implement `arriveIncidents(run)` in `engine/incidents.js` and call it from `step` in `engine/run.js` right after `difficulty-up` events are pushed: spawn an enemy entry with data-model.md `ActiveIncident.incidentId` and `ActiveIncident.phase` = `entering`, absolute stats from the definition (no row multipliers), radius from the definition, at `SPAWN_DISTANCE` in a `run.rng` direction; set the record active; push `incident-arrived`
- [x] T014 [US1] Implement incident movement in `engine/behaviors.js` (or `updateIncidents` in `engine/incidents.js`, called from `step` after `updateSpawner`): `entering` moves at `entrySpeed` until within `entryDistance`, then `active` at `speed`; incidents chase the engineer and are excluded from other enemies' special behaviours; contact damage uses the incident's own rate in `engine/combat.js`
- [x] T015 [US1] Implement `resolveIncident(run, enemy)` in `engine/incidents.js` and route dead incidents to it from `resolveDefeats` in `engine/combat.js` (skip the ordinary telemetry drop and `enemy-defeated`'s pickup); push `incident-resolved`; drop one reward pickup per data-model.md `Pickup.reward`; record `resolved`
- [x] T016 [P] [US1] Draw incidents in `ui/render.js`: own shape/colour at their radius, thicker outline, slow glow (steady under reduced motion); draw reward pickups 2.5× size with a 1.2 s pulsing glow (steady glow under reduced motion); draw screen-space edge pointers for off-screen incidents, and telemetry-style edge pointers for uncollected reward pickups, shown together with incident pointers, inset by the safe area and clear of `#touch-pause`/`#touch-sound`
- [x] T017 [P] [US1] Add `#hud-incidents` to `index.html` and render one name + health bar per active incident from `ui/hud.js` (stacked; hidden when none); style in `style.css` (threat colour, compact on narrow screens, inside the safe area)
- [x] T018 [US1] Wire banners in `main.js` / `ui/screens.js`: `incident-arrived` → threat banner "MAJOR INCIDENT — {name} — {concept}" queued **before** any "New threat" banner from the same step; `incident-resolved` → "RESOLVED — {name}"; both announced in the live region per [contracts/ui-audio.md](./contracts/ui-audio.md)
- [x] T019 [P] [US1] Add sound per [contracts/ui-audio.md](./contracts/ui-audio.md): effects `incidentAlarm` and `incidentResolved` in `data/audio.json` (data-model.md `effects.incidentAlarm`, `effects.incidentResolved`: ≤ 3000 ms like win/loss) and a music layer with data-model.md `MusicLayer.trigger` = `"incident"`; in `audio/content.js` grow `EFFECT_NAMES` to 12, allow long durations for the two new effects, and validate `trigger` xor `joinLevel` with exactly one incident layer; in `audio/director.js` map `incident-arrived`/`incident-resolved` (always accepted like `win`/`loss`: exempt from `minIntervalMs` and the concurrency cap) and report `incidentActive` from the events; in `audio/synth.js` play the incident layer only while incident-active (switching at bar boundaries); in `main.js` pass the active count each frame
- [x] T020 [US1] Update feature 002 tests for the new sounds in `tests/audio-content.test.js` and `tests/audio-director.test.js` (12 effect names; incident layer rules; director mapping and incident-active flag; with 8 effects already sounding, `incident-arrived` still yields `incidentAlarm` and `incident-resolved` still yields `incidentResolved`) — U7
- [x] T021 [US1] Create `tests/browser/smoke-incidents.html` (pattern of `smoke-audio.html`) with modes `arrival` (B1: `?levelSeconds=4&seed=7`, banner text, `incidentAlarm` counted, `#hud-incidents` shows Route Leak, incident within view within 2 s of the banner, pointer drawn while off-screen via a debug stat) and `resolve` (B3: set the incident's health to 1 via the debug handle, RESOLVED banner, `incidentResolved` counted, reward pickup present and drawn large, collecting it raises telemetry by `rewardTelemetry`); register both in `tests/browser/drive.py` with the autoplay flag
- [x] T022 [US1] Run U2, U4, U7, B1, B3 and the existing suites; fix failures

**Checkpoint**: One incident is fully playable end to end.

---

## Phase 4: User Story 2 — Three different incidents (Priority: P1)

**Goal**: Route Leak bursts, Core Switch Failure warns then takes a tool offline, Ransomware infects —
each undone on resolution.

**Independent Test**: Reach each incident with `?levelSeconds=4` and observe its behaviour twice;
resolve it and see the effect undone (B2; U3).

### Tests for User Story 2

- [x] T023 [P] [US2] Write U3 in `tests/incidents.test.js`: **leak** — a burst of `burst` minions every `intervalSeconds`, never more than `maxAlive` of its minions alive, burst cut at the enemy cap, minions of `minionType` at the current level's row; **link-down** — `link-warning` names a tool ≈ 1.5 s before `link-down`, the tool does not fire for `offlineSeconds`, cycles ≥ `cooldownSeconds` apart, never takes the last online tool (with one tool owned nothing happens), tool choice comes from `run.rng`, resolution restores it at once (`link-restored`); **infect** — enemies within `radius` infected once (health and max health × `healthMultiplier`, speed × `speedMultiplier`), incidents and already-infected enemies unaffected, resolution clears all (`infection-cleared`, speed restored, health capped to the pre-infection max)

### Implementation for User Story 2

- [x] T024 [US2] Implement the `leak` behaviour in `updateIncidents` in `engine/incidents.js` using data-model.md `ActiveIncident.timer` and `OrdinaryEnemy.leakedBy` (spawn via `spawnEnemy` from `engine/spawner.js` in a ring at the incident's radius + 20; push `leak`)
- [x] T025 [US2] Implement the `link-down` behaviour in `engine/incidents.js` using data-model.md `ActiveIncident.linkState`, `ActiveIncident.pendingTool`, and `Tool.offlineUntil` (push `link-warning`, `link-down`); skip offline tools in `updateWeapons` in `engine/weapons.js` (an offline orbit tool's barriers do no damage and are not drawn); restore in `resolveIncident` (push `link-restored`)
- [x] T026 [US2] Implement the `infect` behaviour in `engine/incidents.js` using the spatial grid and data-model.md `OrdinaryEnemy.infected`, `OrdinaryEnemy.baseSpeed`, `OrdinaryEnemy.baseMaxHealth` (push `infected` with the count when > 0); clear in `resolveIncident` (push `infection-cleared`)
- [x] T027 [P] [US2] Show behaviours in the UI: infected enemies get a magenta ring in `ui/render.js`; offline tools show "OFFLINE" (dimmed) in the loadout and a warning line "Link down in 1.5 s: {tool}" in `ui/hud.js`/`style.css`; `link-down` announced as "{tool} offline" in the live region from `main.js`
- [x] T028 [US2] Add mode `behaviors` to `tests/browser/smoke-incidents.html` (B2): with `?levelSeconds=4`, test-only invincibility, observe ≥ 2 leak bursts at level 7, a warning then an OFFLINE tool in the HUD at level 12 (force a second tool via the debug handle if needed), and ≥ 1 infected enemy marked at level 18; register in `tests/browser/drive.py`
- [x] T029 [US2] Run U3, B2 and the existing suites; fix failures

**Checkpoint**: All three incidents behave distinctly and recover cleanly.

---

## Phase 5: User Story 3 — The run still flows (Priority: P1)

**Goal**: Lingering and overlap work, spawning halves while active, the run length and determinism
are unchanged, pause/level-up freeze incidents, the end screen reports outcomes, balance is tuned,
and phones and performance hold.

**Independent Test**: Same seed twice through level 20 → identical outcome with incidents; an
unresolved incident lingers into the next and both are active; end screen lists outcomes; balance
simulation meets S1–S2 (U5, U6, S1, S2, B4–B7).

### Tests for User Story 3

- [x] T030 [P] [US3] Write U5 and U6 in `tests/incidents.test.js`: an incident made unkillable lingers through levels 8–20 at its arrival stats (health, speed, damage unchanged by later rows); at level 12 two incidents are active and both behaviours run; ordinary spawn rate is × `incidentSpawnFactor` while ≥ 1 is active (not compounded) and back to normal after; run length still `runLength`; same seed + recorded inputs → identical `hashRun` across a full 20-level run with incidents (use short `levelSeconds`); `step` in `paused`/`levelup` changes no incident state

### Implementation for User Story 3

- [ ] T031 *(Partly done 2026-11-19: S1 **passes** (focused-play bot; data tuned and, at the user's request, softened). S2 **fails** — traced to the bot's close-range tactics rather than incident strength; softening, a wider orbit, and incident-first aiming (reverted) did not change it. Left to the human playtest (T039); see README I-S2.)* [US3] Write `tests/balance/incidents.mjs` (runs in jsc/Node, prints a table): 10 seeds, `levelSeconds` 60, scripted circling player with test-only invincibility taking the first offered upgrade — report per incident the seconds from arrival to resolution and reward ÷ telemetry needed for the next level at that moment (S1); second mode without invincibility reports the difficulty level each run ends at (S2). Tune data-model.md `IncidentDefinition.health` and `IncidentDefinition.rewardTelemetry` (and, if needed, behaviour parameters) in `data/game.json` until S1 is met (30–60 s in ≥ 7/10 seeds; reward 0.8–1.5 level-ups) and S2 passes (≥ 7 of 10 bot runs end between levels 7 and 14, and the median is at most 1 level below the baseline — record the baseline by running the S2 mode on a data copy with `incidents` removed, before tuning); if health tuning alone cannot meet S1 because the horde shields the incident, apply research R8's fallback (projectile tools prefer an in-range incident), record it in `spec.md` › Assumptions, and re-run all tests
- [x] T032 [US3] Halve ordinary spawning in `updateSpawner` in `engine/spawner.js` while an incident is active during its own arrival level (× `incidentSpawnFactor`, once; revised from "while any is active" on 2026-11-19), and make the enemy-cap check ignore incident entities
- [x] T033 [P] [US3] Add the **Incidents** row to the end screen in `ui/screens.js` `showEnd` (resolved ✓ / unresolved ✗ / not reached —, using `run.incidents`; an `active` record at run end reads "unresolved")
- [x] T034 [US3] Add modes `overlap` (B4: make Route Leak unkillable via the debug handle; at level 12 two HUD bars and two pointers; both behaviours running) and `summary` (B5: end a `?levelSeconds=4` run after resolving incident 1 only and verify the Incidents row) to `tests/browser/smoke-incidents.html`; register in `tests/browser/drive.py`
- [x] T035 [US3] Add CDP check B6 to `tests/browser/touch_checks.py` (`check_incident_mobile`): 390×844 and 844×390 phone emulation with safe-area insets; during an incident the `#hud-incidents` panel and pointer positions stay inside the safe area and do not overlap `#touch-pause`/`#touch-sound`; with an incident plus 300 enemies, frame pacing meets feature 001 F5 thresholds (and 003 T9 under 4× throttle)
- [x] T036 [US3] Run U5, U6, S1, S2, B4–B6 and the full suite (B7 regression: all feature 001–003 checks); fix failures

**Checkpoint**: Incidents are balanced, deterministic, and work on desktop and phones.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T037 [P] Update `README.md`: a "Major Incidents" section (levels, concepts, behaviours, reward, lingering), controls/HUD notes, project layout (`engine/incidents.js`, `tests/balance/`), and verification rows U1–U7, S1–S2 (with the simulation numbers), B1–B7, H1–H2 (not run until done)
- [x] T038 [P] Record feature 004's sound additions in feature 002's documents: a note in `specs/002-procedural-audio/spec.md` FR-001 ("extended by feature 004 with `incidentAlarm` and `incidentResolved`"), in `specs/002-procedural-audio/data-model.md` › Sound Effect Definition (12 keys; the two incident effects follow the ≤ 3000 ms rule) and › Music Layer (optional `trigger: "incident"`, mutually exclusive with `joinLevel`), and in `specs/002-procedural-audio/contracts/audio-data.md`
- [ ] T039 *(Not run — needs people; README rows I-H1, I-H2.)* Human checks H1 (concept recognition from banners) and H2 (playtest) — record in `README.md` (requires people; "not run" until done)
- [ ] T040 *(Blocked on T031's S2 and T039.)* Walk through [quickstart.md](./quickstart.md) end to end; tick tasks only with evidence recorded

---

## Dependencies & Execution Order

- **Setup → Foundational → US1 → US2 → US3 → Polish.**
- **US1** needs T005–T009 (data, validation, records, reward cap, hash).
- **US2** needs US1's arrival, movement, and `resolveIncident` (T013–T015); its UI task T027 needs T017.
- **US3** needs US1 and US2 engine work (balance must include all behaviours); T035 needs T016–T017.
- Same-file sequences: `engine/incidents.js` (T007 → T013 → T014 → T015 → T024 → T025 → T026);
  `engine/combat.js` (T008 → T014 → T015); `engine/run.js` (T007 → T013 → T014);
  `tests/incidents.test.js` (T002 → T004 → T011 → T012 → T023 → T030);
  `ui/render.js` (T016 → T027); `ui/hud.js` (T017 → T027); `main.js` (T018 → T019 → T027);
  `tests/browser/smoke-incidents.html` (T021 → T028 → T034); `tests/browser/drive.py` (T021 → T028 → T034);
  `data/game.json` (T005 → T031).

### Story completion order

```text
Setup ─▶ Foundational ─▶ US1 (one incident end to end) ─▶ US2 (three behaviours) ─▶ US3 (flow, balance, mobile) ─▶ Polish
```

---

## Parallel Examples

```text
Phase 2:  T003 content tests  ∥  T004 cap test  ∥  T010 001 contract note
US1:      T011 + T012 tests  ∥  T016 render  ∥  T017 HUD panel  ∥  T019 sound
US2:      T023 tests  ∥  T027 behaviour UI (after T017)
US3:      T030 tests  ∥  T033 end screen
Polish:   T037 README  ∥  T038 002 contract note
```

---

## Implementation Strategy

### MVP first

1. Phases 1–2: data and validation proven by U1.
2. Phase 3 (US1): one incident fully playable — **stop and validate** B1/B3.
3. Phase 4 (US2): the other two behaviours.
4. Phase 5 (US3): balance (S1/S2) is the gate before calling the feature done.

### Incremental delivery (plan slices)

| Plan slice | Tasks | Evidence |
|------------|-------|----------|
| 1 · Data + engine | T001–T015, T023–T026, T032 | U1–U6 |
| 2 · Balance | T031 | S1, S2 |
| 3 · Visuals + HUD | T016–T018, T027, T033 | B1–B5 |
| 4 · Sound | T019–T020 | U7 |
| 5 · Mobile + regression | T035–T036 | B6, B7 |
| 6 · Package | T037–T040 | README rows |

### Fallback

If time runs short, ship slices 1–3 (incidents playable with visuals) and record sound polish as not
delivered ([plan.md](./plan.md) › Scope controls).
