# Implementation Plan: Major Incident Boss Encounters

**Branch**: `004-major-incidents` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-major-incidents/spec.md`

## Summary

Add three authored Major Incidents — Route Leak (level 7), Core Switch Failure (12), Ransomware
Outbreak (18) — that arrive off-screen with an entry dash, show a HUD health bar and edge pointer,
run one signature behaviour each, stay until resolved (and may overlap), halve ordinary spawning while
active, and drop one large glowing telemetry reward when resolved. An incident is an ordinary enemy
entry with extra state, so existing targeting, damage, collision, and rendering paths handle it; a new
pure module `engine/incidents.js` adds arrival, behaviours, and resolution. All numbers are data
(`data/game.json`, `data/audio.json`), tuned with a seeded balance simulation. Decisions:
[research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3 — as features 001–003

**Primary Dependencies**: None (browser built-ins only)

**Storage**: N/A (incident records live in the run; no persistence)

**Testing**: Existing harness (`tests/run.mjs`, `tests/index.html`); new terminal balance simulation
(`tests/balance/incidents.mjs`); scripted headless Chrome checks (`tests/browser/drive.py`, including
feature 003's DevTools-driven phone checks)

**Target Platform**: Desktop and mobile web browsers (constitution v2.0.0)

**Project Type**: Static single-page browser game on GitHub Pages

**Performance Goals**: No regression of feature 001 SC-005 / 003 SC-004 with an incident and 300
enemies on screen; infection and leak checks use the existing spatial grid

**Constraints**: Engine pure and deterministic (`run.rng` only); 20-minute run unchanged; incidents
fixed-strength (no difficulty multipliers); reward pickups exempt from the pickup cap

**Scale/Scope**: 3 incidents, 3 behaviour kinds, ~8 new engine events, 2 new sound effects + 1 music
layer; one new engine module, changes in 7 engine modules and 5 UI/audio modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun survivors-like, networking theme, original | Every enemy/ability themed on a real concept; original | Each incident names a real incident type (BGP route leak, single point of failure in the core, lateral malware spread) shown in its banner; behaviours mirror the concept; original names and art | ✅ | ✅ |
| C5 · Deterministic, self-contained | Seeded randomness; same seed + inputs → same outcome | All choices via `run.rng`; `hashRun` extended; replay test U6 | ✅ | ✅ |
| C6 · Content and logic reviewable separately | Content and difficulty in validated data; displayed numbers match rules | Incidents, behaviour parameters, spawn factor, rewards, sounds all in data and validated (U1, U7); HUD shows only the rule-computed health | ✅ | ✅ |
| C7 · Done is demonstrated | Evidence; unrun checks visible | U1–U7, S1–S2, B1–B7, H1–H2 recorded in README with pass / fail / not run | ✅ | ✅ |
| First Release Scope | One core mechanic; 20 data-driven levels; new enemy types every few levels; desktop + mobile web | Incidents are authored enemies at fixed levels; run length and win condition unchanged; no persistence | ✅ | ✅ |

**Gate result: PASS.** No amendment needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-major-incidents/
├── plan.md              # This file
├── research.md          # R1–R10
├── data-model.md        # incident data, run state, records, events
├── quickstart.md        # U1–U7, S1–S2, B1–B7, H1–H2
├── contracts/
│   ├── game-data.md     # incidents in data/game.json (starting values)
│   ├── engine-api.md    # engine/incidents.js + changes to existing modules
│   └── ui-audio.md      # HUD, pointers, banners, reward visuals, end summary, sounds
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
data/game.json           incidents[], incidentSpawnFactor
data/audio.json          incidentAlarm, incidentResolved, incident music layer

engine/
  incidents.js           NEW — arrival, entry dash, leak / link-down / infect, resolution, records
  run.js                 records; call arrive/update
  spawner.js             spawn factor while active; cap ignores incidents
  behaviors.js           incident movement (dash, then chase)
  weapons.js             offline tools do not fire
  combat.js              incident defeat → resolve; reward pickup exempt from cap
  content.js             validate incidents
  hash.js                hash incident state

audio/
  content.js             12 effects; layer `trigger: "incident"`
  director.js            incident events → sounds; incident-active flag
  synth.js               incident layer gating at bar boundaries

ui/
  render.js              incident look, infected ring, reward glow/pulse, edge pointers
  hud.js                 incident panel, OFFLINE tools, link warning
  screens.js             incident banners order; end-screen Incidents row
index.html, style.css    #hud-incidents, styles
main.js                  wire events → banners/announcements/HUD

tests/
  incidents.test.js      NEW — U2–U6
  content.test.js        U1 additions
  audio-content.test.js, audio-director.test.js   U7 updates (10 → 12 effects)
  determinism.test.js    hash includes incidents
  balance/incidents.mjs  NEW — S1–S2
  browser/smoke-incidents.html (+ drive.py entries)  NEW — B1–B5; B6 via touch_checks.py
README.md                incidents section, verification rows
```

**Structure Decision**: Engine logic in one new pure module plus small hooks in existing modules; all
presentation in existing UI/audio modules.

## Hardest behavior and first evidence

**Hardest behavior to get right**: balance — incident health and rewards that hit the 30–60 s resolve
window and ~1 level-up reward for a typical build, while lingering/overlap never makes the game
hopeless and the overall difficulty stays moderate.

**First evidence we'll check**: S1 from `tests/balance/incidents.mjs` on 10 seeds right after the
engine slice, before any UI work; tune `health` and `rewardTelemetry` in data until S1 passes, then
S2. If health tuning alone cannot reach the window because the horde shields the incident, apply the
recorded fallback (R8) and note it in the spec.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 1 · Data + engine | Data and validation; `engine/incidents.js`; hooks in run/spawner/behaviors/weapons/combat/hash | U1–U6 |
| 2 · Balance | Simulation script; tune data | S1, S2 |
| 3 · Visuals + HUD | Incident look, health panel, pointers, reward glow, banners, end summary, offline tools | B1–B5 |
| 4 · Sound | Two effects + incident music layer; director/synth | U7; B1/B3 sound counts |
| 5 · Mobile + regression | Phone layout of panel/pointers; performance | B6, B7 |
| 6 · Package | README, 001/002 contract notes | Rows recorded; H rows "not run" until done |

## Scope controls

Out of scope (spec Non-Goals): new ordinary enemies/tools/passives, random or optional incidents,
multi-phase fights, persistence, run-length changes. If time runs short, ship slices 1–3 (incidents
playable with visuals) and record sound polish as not delivered.

## Complexity Tracking

No constitution violations to justify.
