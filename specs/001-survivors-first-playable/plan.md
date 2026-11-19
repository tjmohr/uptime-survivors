# Implementation Plan: Uptime Survivors — First Playable

**Branch**: `001-survivors-first-playable` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-survivors-first-playable/spec.md`

**Note**: Based on the workshop starter plan (no longer in the repository). Its quiz-specific parts (`evaluate(challenge, answer)`,
submit/retry/hints, briefings, source records, `levels.json` rounds) were workshop-template
leftovers and are replaced by a real-time survivors-like design. Its general rules are kept:
static files, no framework or bundler, content in JSON, pure logic separate from UI, a
dependency-free browser test runner, and recorded verification.

## Summary

Build a browser survivors-like: the player steers a network engineer while tools fire
automatically at swarms of network problems, collects telemetry to level up and choose upgrades,
and survives 20 one-minute difficulty levels to win. The technical approach is a deterministic,
fixed-step simulation in pure JavaScript modules (seeded randomness, no DOM), drawn to a Canvas
2D play field with HTML overlays for menus, all content in one validated `data/game.json`. Work
is split into a **core-loop milestone** (FR-029) that must be demonstrated before the remaining
roster is added (FR-030). Decisions are justified in [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3

**Primary Dependencies**: None. Browser built-ins only (Canvas 2D, `fetch`, `requestAnimationFrame`).

**Storage**: N/A. Content is read from `data/game.json`; run state is in memory only (no persistence).

**Testing**: Dependency-free harness, run by `tests/index.html` (browser) and `tests/run.mjs` (Node 18+)

**Target Platform**: Current desktop browsers (Chrome, Firefox, Edge, Safari) with a keyboard

**Project Type**: Static single-page browser game

**Performance Goals**: Smooth 60 fps with 300 enemies, 200 pickups, 400 projectiles on a typical laptop (SC-005)

**Constraints**: Works offline from static files; relative paths (GitHub Pages subpath safe); deterministic engine; no `Math.random` in `engine/`

**Scale/Scope**: 5 enemy types, 4 tools, 2 passives, 20 difficulty levels, 1 map; about 15 source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun survivors-like, networking theme | Genre loop; every enemy/ability tied to a real concept; original assets | Auto-firing tools, escalating hordes, telemetry → 3-choice level-ups. Every content item has a required `concept` field (validated). Art is code-drawn shapes; no third-party assets. | ✅ | ✅ |
| C5 · Deterministic, self-contained | Static files only; no account/backend/model/API key; seeded randomness | Seeded PRNG (R3), fixed step (R2), source scan bans `Math.random`/DOM in `engine/`, determinism hash test (R4). Only same-origin requests. | ✅ | ✅ |
| C6 · Content and logic reviewable separately | Content in data; rules separate from rendering; validate before play; displayed numbers match rules | All content in `data/game.json`; `engine/` has no DOM; `validateGameData` runs before Start and lists item IDs; upgrade text generated from the same rank tables the engine applies. | ✅ | ✅ |
| C7 · Done is demonstrated | Scope agreed; acceptance criteria pass; status recorded; failed/unrun checks visible | Core-loop milestone gate (M1–M9) before roster expansion; README verification table with pass/fail/not run; [quickstart.md](./quickstart.md) gives reproducible commands. | ✅ | ✅ |
| First Release Scope | One core mechanic, 20-level run ending in a win, browser, 60-min build; difficulty data-driven | One mechanic; 20-row difficulty table in data; no hand-built stages. See risk note below. | ⚠️ | ⚠️ |

**Gate result: PASS with one recorded risk.** The full roster (spec Q1: all 5 enemies, 4 tools,
2 passives required) is large for a 60-minute build. This is not a principle violation — the
group chose it explicitly — and it is managed by building the core-loop milestone first (FR-029).
If time runs out after the milestone, C7 requires an explicit, recorded scope reduction rather
than shipping unverified features.

## Project Structure

### Documentation (this feature)

```text
specs/001-survivors-first-playable/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: entities, validation, state machine, initial tuning
├── quickstart.md        # Phase 1: run + validation scenarios (M1–M9, F1–F10)
├── contracts/
│   ├── game-data.md     # data/game.json shape and validation output
│   ├── engine-api.md    # engine module functions, events, guarantees
│   └── ui-controls.md   # keys, screens, accessibility, URL test parameters
├── checklists/
│   └── requirements.md  # spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html              Page shell: canvas, overlay containers, live region, module entry
style.css               Overlay/HUD styling, terminal look, focus styles, reduced motion
main.js                 Load data → validate → title; owns the frame loop and input → step()

engine/                 Pure game rules — no DOM, canvas, timers, fetch, or Math.random
  rng.js                Seeded generator (mulberry32)
  content.js            validateGameData(); cross-reference and difficulty-curve checks
  run.js                createRun, step, chooseUpgrade, pause/resume; phase transitions
  difficulty.js         levelAt, runLength, debut lookup
  spawner.js            Spawn timing, enemy-type pick by mix weights, off-screen positions
  behaviors.js          chase, split, blink
  weapons.js            projectile-nearest, orbit, pulse, spread
  combat.js             Contact damage, invulnerability, hits, defeats, pickups, caps/merging
  progression.js        Telemetry curve, offers, describeChange, passive stat totals
  grid.js               Spatial grid for collision queries
  hash.js               Stable state hash for determinism tests

ui/
  render.js             Canvas drawing: grid background, cached glow shapes, camera
  hud.js                HUD values from run state
  screens.js            Title, level-up, pause, end, error overlays; focus management
  input.js              Keyboard state → {dx, dy}; 1/2/3, Esc/P; blur/visibility → pause
  params.js             Read ?seed and ?levelSeconds (R7)

data/
  game.json             All authored content (contracts/game-data.md)

tests/
  harness.js            test(), assertEqual(), assertThrows(), summary; zero tests = fail
  index.html            Browser runner with visible totals and failed test names
  run.mjs               Node runner; exit code 0 only on full pass
  rng.test.js           Seed reproducibility, distribution sanity
  content.test.js       Valid file passes; each broken-file case fails with the right item ID
  difficulty.test.js    20 levels, monotonic, debut levels, run length incl. levelSeconds
  progression.test.js   Telemetry curve, offer rules (max tools, max rank, fallback), describeChange vs applied stats
  run.test.js           Phase transitions, pause/levelup freeze, loss/win incl. same-step tie, multi-level-up queue
  combat.test.js        Movement normalisation, contact damage + invulnerability, caps, pickup merge
  behaviors.test.js     split generations, blink distance, weapon kinds hit expected targets
  determinism.test.js   Same seed + inputs → same hash; engine source scan for banned APIs

README.md               How to run/test, controls, current status, verification table
```

**Structure Decision**: Single static project at the repository root, following the starter
plan's layout (`engine/`, `ui/`, `data/`, `tests/`) with modules re-cut for a real-time game. The
starter's `rules.js`/`state.js`/`feedback.js` quiz split is replaced by the engine modules above.
Small files may be merged if separation adds no value.

## Hardest behavior and first evidence

**Hardest behavior to get right**: keeping the simulation deterministic and correct across phase
changes — level-ups (including several queued at once), pause, tab blur, and the win/loss
tie on the final step — while staying smooth at 300 enemies.

**First evidence we'll check**: `determinism.test.js` — a fixed seed and a recorded 3,600-step
input sequence produce the same state hash on two runs, and stepping while in `levelup` or
`paused` leaves the hash unchanged.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 1 · Prove the engine | `rng`, `content` validation, `difficulty`, `progression`, `run` with chase + Ping, determinism test; core-roster `data/game.json` | Terminal and browser tests pass; zero-test guard works |
| 2 · Playable loop | Canvas render, input, HUD, title/level-up/pause/end/error screens, URL params; Firewall Rule, Bandwidth Upgrade, Latency Spike | Quickstart M2–M9 in a browser |
| **Milestone gate** | **Core loop (FR-029)** | **M1–M9 recorded in README; fresh-start playthrough recorded (SC-012)** |
| 3 · Full roster | `split`, `blink`, `pulse`, `spread`; Broadcast Storm, Route Flap, DDoS Botnet, Ansible Playbook, Load Balancer, Redundant Power Supply in data | F1–F3; new behavior tests pass |
| 4 · Performance & usability | Spatial grid, cached glow, caps/merge, reduced motion, focus, live region | F5, F6, F9 |
| 5 · Balance & package | Tune data for SC-002/SC-011; README run/test/status; optional GitHub Pages | F4, F7, F8, F10 recorded |

Generate `tasks.md` from these slices and the spec's acceptance criteria. Do not add tasks for
features outside the spec.

## Verification and reporting

- Automated: `node tests/run.mjs` and http://127.0.0.1:8000/tests/ (see [quickstart.md](./quickstart.md)).
- Manual: scenarios M1–M9 and F1–F10 in [quickstart.md](./quickstart.md).
- For each acceptance criterion and scenario, the README records **pass / fail / not run**, date,
  browser/device, and evidence. A checked task box is not evidence on its own (C7).

## Scope controls

Out of scope for v1 (from the spec's Non-Goals and the starter plan): persistence, meta-
progression, multiplayer, runtime AI, accounts/backend, content editor, audio, multiple maps,
touch/gamepad, and quiz mechanics. If time runs short after the milestone, propose the smallest
coherent reduction (for example, ship with fewer roster items), update spec and tasks, and record
it — never silently drop checks.

## Complexity Tracking

No constitution violations to justify. One deviation from the starter plan is recorded:

| Deviation from the workshop starter plan | Why Needed | Simpler Alternative Rejected Because |
|-----------------------------------|------------|-------------------------------------|
| Canvas 2D play field instead of DOM controls + SVG | Up to 300 enemies + 600 other moving objects per frame (FR-020, SC-005) | DOM/SVG nodes per entity cannot keep 60 fps at that count; Canvas is built-in, so still no dependency (R1) |
| Second test runner (`tests/run.mjs`, Node) alongside the browser runner | Reproducible terminal command for agents and C7 evidence | Browser-only runner cannot be run headlessly; Node is optional for players |
