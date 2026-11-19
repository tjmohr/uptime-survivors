# Implementation Plan: Late-Game Upgrades

**Branch**: `006-late-game-upgrades` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-late-game-upgrades/spec.md`

## Summary

Add three tools with new behaviour kinds (Traceroute `chain`, Rate Limiter `aura`, Null Route `zone`),
four passives (QoS Policy, Link Aggregation, Observability Stack, Hardened Config), and a repeatable
upgrade (Capacity Planning) offered with Failover once the pool is empty; Failover heals 15%. All bonuses
flow through one new pure module (`engine/stats.js`) used by both the weapons and every screen that shows
numbers, so displayed rank + "with bonuses" values always equal what the game applies. All content is
data in `data/game.json`, validated before Start, and tuned with a new seeded balance simulation.
Decisions: [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3 — as features 001–005

**Primary Dependencies**: None (browser built-ins only)

**Storage**: N/A

**Testing**: jsc unit tests (`tests/run.mjs`) with new `tests/upgrades.test.js`; new balance simulation
`tests/balance/upgrades.mjs`; scripted headless Chrome checks (`tests/browser/drive.py`) with a new
`smoke-upgrades.html`; existing touch/phone checks

**Target Platform**: Desktop and mobile web browsers (constitution v2.0.0)

**Project Type**: Static single-page browser game on GitHub Pages

**Performance Goals**: No regression of 001 F5 / 003 T9 (300 enemies, 60 fps desktop; ≥ 30 fps on the
4× throttled phone) with all three new tools owned; aura and zones use the spatial grid; ≤ 8 zones

**Constraints**: Engine pure and deterministic (no new randomness needed); 4-tool limit, 5 ranks, 20
levels unchanged; incidents never slowed; displayed numbers = applied numbers (C6)

**Scale/Scope**: +3 tools, +4 passives, +1 repeatable, 1 value change; 1 new engine module, changes in 7
engine modules and 5 UI modules; no new audio

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun, networking theme, original | Every ability tied to a real concept; original | Traceroute, traffic policing, black-hole routing, QoS, LACP, observability, hardening, capacity planning — each concept in its data entry and the Field Guide; original code-drawn visuals | ✅ | ✅ |
| C5 · Deterministic, self-contained | Seeded; same seed + inputs → same outcome | No new randomness (deterministic targeting rules); zones, slow field, capacity takes hashed (U8) | ✅ | ✅ |
| C6 · Content and logic separate; displayed = computed | All content in validated data; shown numbers match rules | All new items and numbers in `data/game.json` with validation (U1); one `effectiveToolStats` used by weapons and UI (U2, B2, B3) | ✅ | ✅ |
| C7 · Done is demonstrated | Evidence; unrun checks visible | U1–U8, S1–S4, B1–B4, H1–H2 recorded in README as pass / fail / not run | ✅ | ✅ |
| First Release Scope | One core mechanic; data-driven levels; no meta-progression | More level-up choices within the same mechanic; nothing persists between runs | ✅ | ✅ |

**Gate result: PASS.** No amendment needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-late-game-upgrades/
├── plan.md              # This file
├── research.md          # R1–R8
├── data-model.md        # new kinds, passive stats, repeatable, run state, events
├── quickstart.md        # U1–U8, S1–S4, B1–B4, H1–H2
├── contracts/
│   ├── game-data.md     # starting values and text
│   ├── engine-api.md    # engine/stats.js + module changes
│   └── ui.md            # stat text, level-up, HUD, Field Guide, play field
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
data/game.json           3 tools, 4 passives, repeatable, fallbackHealPercent 15

engine/
  stats.js               NEW — bonusTotals, effectiveToolStats, repeatableBonus
  content.js             new kinds/fields/caps; repeatable validation
  weapons.js             chain / aura / zone; effective stats; slow field; zones
  behaviors.js           slow factor for ordinary enemies
  combat.js              damage reduction; telemetry gain
  progression.js         passive totals; [repeatable, heal] offer; capacityTakes
  run.js, hash.js        new run state

ui/
  stattext.js            new labels; "(X with bonuses)"
  screens.js             level-up repeatable choice + effective values; end-screen ×n
  hud.js                 Capacity Planning ×n in loadout
  guide.js, icons.js     Field Guide: new items, Capacity Planning entry, icons, effective values
  render.js              Traceroute path, Rate Limiter ring, Null Route zones

tests/
  upgrades.test.js       NEW — U1–U7; determinism.test.js — U8
  balance/upgrades.mjs   NEW — S1–S4
  browser/smoke-upgrades.html (+ drive.py "upgrades")   NEW — B1–B3; B4 = full suite
  guide.test.js, content.test.js, progression.test.js   updated counts / heal 15%
README.md                section, verification rows; 005 Field Guide wording
```

**Structure Decision**: One new pure engine module for bonuses; new tool kinds inside the existing
weapons module; everything else is data and small UI changes.

## Hardest behavior and first evidence

**Hardest behavior to get right**: balance — 49 upgrades plus stacking bonuses must make the late game
feel rewarding (pool lasts past difficulty 12, real build variety) without making runs much easier
(SC-004), while Rate Limiter must not trivialise the hordes.

**First evidence we'll check**: S1 and S4 from `tests/balance/upgrades.mjs` on 10 seeds right after the
engine slice, before any UI work; tune rank numbers in data until both pass, then S3.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 1 · Data + validation | New data, validation rules, `engine/stats.js` | U1, U2 |
| 2 · Engine | Three kinds, slow field, zones, passives, offers, hash | U3–U8 |
| 3 · Balance | `upgrades.mjs`; tune data | S1–S4 |
| 4 · UI | Stat text, level-up, HUD, end screen, Field Guide, icons, play-field drawing | B1–B3 |
| 5 · Regression | Full browser suite, performance, phone fit | B4 |
| 6 · Package | README, 005 wording note | Rows recorded; H rows "not run" |

## Scope controls

Out of scope (spec Non-Goals): evolutions, rerolls/banish, more repeatables, changes to the tool limit,
ranks, levels, enemies, or incidents. If time runs short, ship slices 1–3 plus the minimum UI (level-up
and HUD) and record the Field Guide icons/drawing polish as not delivered.

## Complexity Tracking

No constitution violations to justify.
