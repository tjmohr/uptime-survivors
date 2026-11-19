# Implementation Plan: Field Guide

**Branch**: `005-field-guide` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-field-guide/spec.md`

## Summary

Add a **Field Guide** screen opened from the pause screen, with two tabs: "Network problems" (5 enemy
types in debut order, then the 3 Major Incidents with their arrival level) and "Tools & passives" (4 tools
and 2 passives with rank, current stats, a "Next rank" line, "Not owned", and OFFLINE). Problems not yet
met this run are locked "???" entries with a grey silhouette; the engine records first spawns and
arrivals in a new deterministic `run.encountered` list. The guide content is built by a pure function
(`ui/guide.js › buildGuide`) from validated data and the engine's own rank tables and change calculator,
so the numbers and wording match the level-up screen. Icons are inline SVG drawn from the same shape
vertices the play field uses. No data, gameplay, or audio changes. Decisions: [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3 — as features 001–004

**Primary Dependencies**: None (browser built-ins only)

**Storage**: N/A (encounter list lives in the run; nothing persisted)

**Testing**: Existing jsc harness (`tests/run.mjs`) with new `tests/guide.test.js`; scripted headless
Chrome checks (`tests/browser/drive.py`) with a new `smoke-guide.html` and a phone check in
`touch_checks.py`

**Target Platform**: Desktop and mobile web browsers (constitution v2.0.0)

**Project Type**: Static single-page browser game on GitHub Pages

**Performance Goals**: Guide opens in under 100 ms on the 003 throttled-CPU phone profile (14 entries,
built once per opening); no per-frame work while open; no change to play-time frame cost

**Constraints**: Engine stays pure and deterministic; guide reads the run and never changes it
(FR-015); all text from validated data (FR-010); fits 360 × 640 in both orientations inside the safe
area; feature 003 tap guard applies

**Scale/Scope**: 1 new screen, 14 entries; 3 new DOM-free UI modules (`guide.js`, `icons.js`,
`stattext.js`); small changes to 3 engine modules (+ hash) and to screens/render/main/input/style

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun survivors-like, networking theme, original | Every enemy/ability tied to a real concept; original | The guide shows each item's real concept and description from data, strengthening C1's evidence (SC-005); original icons, no third-party assets | ✅ | ✅ |
| C5 · Deterministic, self-contained | Seeded randomness; same seed + inputs → same outcome | `run.encountered` is a deterministic record, hashed; no randomness added; guide is read-only (G5, G6); no network requests | ✅ | ✅ |
| C6 · Content and logic reviewable separately | Content in validated data; displayed numbers match rules | No new content; guide text only from validated data; stats come from the engine's rank tables and `describeChange`, formatted by the same function as the level-up screen (G3) | ✅ | ✅ |
| C7 · Done is demonstrated | Evidence; unrun checks visible | G1–G6, GB1–GB5, GH1–GH3 recorded in README as pass / fail / not run | ✅ | ✅ |
| First Release Scope | One core mechanic; no persistence or meta-progression | Reference screen while paused; encounter list resets each run and is never saved (not meta-progression) | ✅ | ✅ |

**Gate result: PASS.** No amendment needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-field-guide/
├── plan.md              # This file
├── research.md          # R1–R8
├── data-model.md        # run.encountered, guide model
├── quickstart.md        # G1–G6, GB1–GB5, GH1–GH3
├── contracts/
│   ├── engine-api.md    # engine hooks + DOM-free ui modules
│   └── ui-guide.md      # pause button, guide screen, keys, layout
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
engine/
  run.js                 encountered: [] in createRun
  spawner.js             spawnEnemy records first spawn of each type
  incidents.js           arriveIncidents records the incident
  hash.js                hashes run.encountered

ui/
  stattext.js            NEW — stat labels/units/describeStatChange (moved from screens.js)
  guide.js               NEW — buildGuide(run): pure guide model
  icons.js               NEW — shapePoints, problem/loadout SVG icons, TOOL_COLORS
  render.js              shapePath uses shapePoints; colours from icons.js
  screens.js             Field Guide button on pause; showGuide; 'guide' tap-guarded
  input.js               (unchanged API) Esc/P routed by main.js
main.js                  openGuide / back to pause; Esc/P in guide → back
style.css                guide panel, tabs, entries, scroll, safe area, touch sizes

tests/
  guide.test.js          NEW — G1–G5
  determinism.test.js    G6 (encountered hashed and deterministic)
  browser/smoke-guide.html (+ drive.py entries "guide")   NEW — GB1–GB4
  browser/touch_checks.py                                 GB5 phone check
README.md                Field Guide section, verification rows
```

**Structure Decision**: One tiny engine record plus pure UI modules for the model, icons, and stat text;
the DOM work stays in screens.js like every other overlay.

## Hardest behavior and first evidence

**Hardest behavior to get right**: the "Tools & passives" numbers — they must equal what the engine
uses and read exactly like the level-up screen, including the next-rank line, for every rank of every
item.

**First evidence we'll check**: G3 in jsc, iterating all 6 items × ranks 1–5, comparing `buildGuide`
output with the rank tables and with the level-up offer text for the same change, before any DOM work.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 1 · Engine record | `run.encountered` in run/spawner/incidents/hash | G2 (engine part), G6, all existing tests |
| 2 · Model | `stattext.js` move, `guide.js` | G1, G2, G3, G5 |
| 3 · Icons | `icons.js`, render.js uses `shapePoints` | G4; existing render smoke checks |
| 4 · Screen | Pause button, `showGuide`, tabs, keys, focus, styles | GB1–GB4 |
| 5 · Phone | Safe area, scroll, tap guard, touch sizes | GB5 |
| 6 · Package | README section and rows | Rows recorded; GH rows "not run" until done |

## Scope controls

Out of scope (spec Non-Goals): new content, persistence, search/filters/sorting, animated previews,
external links, engineer stat totals. If time runs short, ship slices 1–4 (desktop guide complete) and
record GB5 as not run.

## Complexity Tracking

No constitution violations to justify.
