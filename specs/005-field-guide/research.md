# Research: Field Guide

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

No `NEEDS CLARIFICATION` items remained in the Technical Context; the decisions below settle the open
design choices, all against the existing code (features 001–004).

## R1 · Where "met this run" is recorded

- **Decision**: The engine keeps `run.encountered`, a list of enemy type ids and incident ids in the
  order first met. `spawnEnemy` (engine/spawner.js) adds the enemy's `typeId` the first time that type
  spawns; `arriveIncidents` (engine/incidents.js) adds the incident id on arrival. The list is created
  empty by `createRun`, so it resets with every run, and it is included in `hashRun`.
- **Rationale**: Spec clarification Q2 says "met" means "entered the game", which is an engine fact. One
  hook in `spawnEnemy` covers ordinary spawns, Broadcast Storm splits, and Route Leak minions (spec edge
  case). Recording it in the engine keeps it deterministic and testable in jsc without a browser.
  Enemy and incident ids are unique across both lists (feature 004 validation), so one list is enough.
- **Alternatives**: Track in the UI from `difficulty-up` debut events — wrong, because a debut banner
  fires when a type enters the mix, before one has spawned, and it misses incidents' minions. Track
  "seen on screen" in the renderer — rejected by clarification Q2.

## R2 · Guide content as a pure model

- **Decision**: New `ui/guide.js` exports `buildGuide(run)`, a pure function (no DOM) returning the
  guide's sections and entries as plain data, built only from `run.data`, `run.defs`, `run.engineer`,
  `run.elapsed`, and `run.encountered`. `ui/screens.js` gets `showGuide(model, handlers)` that turns the
  model into HTML.
- **Rationale**: C6 requires displayed numbers to match the rules; a pure model can be checked against
  the engine's own rank tables in the jsc unit tests, and against `hashRun` to prove it changes nothing
  (FR-015). Splitting model and view mirrors `describeChange` (engine) vs. the level-up screen (UI).
- **Alternatives**: Build DOM directly from `run` in screens.js — harder to test without a browser.

## R3 · Stat wording identical to the level-up screen

- **Decision**: Move `STAT_LABELS`, `UNITS`, `fmtValue`, and `describeStatChange` from `ui/screens.js`
  into a new DOM-free `ui/stattext.js`; screens.js re-imports them (no behaviour change). Current stats
  are stat-change records with `from: null` (rendered "Damage 12", "Move speed +10%"); the "Next rank"
  line uses `describeChange(data, {kind, id, fromRank: r, toRank: r + 1})` from engine/progression.js,
  which already lists only the stats that change (rendered "Damage 12 → 15").
- **Rationale**: One formatter and one change calculator for both screens guarantees the same numbers and
  wording (FR-008, C6) and that the next-rank line equals what the next level-up offer would show.
- **Alternatives**: A second formatter for the guide — risks drift.

## R4 · Which numbers are "the stats the game is using"

- **Decision**: A tool's stats are `def.ranks[rank - 1]` restricted to `TOOL_KIND_FIELDS[def.kind]`
  (what engine/weapons.js reads); a passive's stats are all fields of `def.ranks[rank - 1]` (what
  `passiveTotals` sums). Unowned entries use rank 1. Offline is `tool.offlineUntil > run.elapsed`, the
  same test as weapons.js and the HUD.
- **Rationale**: Passives change engineer stats, not tool stats, so tool rank values are exactly what
  fires. The guide shows per-item rank values, as the level-up screen does.
- **Alternatives**: Show engineer totals (e.g. final move speed) — not part of the spec; deferred.

## R5 · Icons

- **Decision**: Inline SVG icons from a new DOM-free `ui/icons.js`:
  - **Enemies and incidents**: `shapePoints(shape, r)` returns the polygon vertices; render.js's
    `shapePath` is changed to draw from the same function, so guide and play field cannot disagree
    (US1 scenario 3). Colour comes from the data (`color`). Locked entries use the same shape outline in
    a neutral grey (`#64748b`) with no fill colour (FR-011).
  - **Tools**: a small drawing per tool kind that echoes its play-field look, in the colours render.js
    uses (Ping: white projectile dot; Firewall Rule: cyan barriers on an orbit ring; Ansible Playbook:
    violet pulse ring; Load Balancer: three lime projectiles fanning out). The colours move from
    render.js constants into `ui/icons.js` exports that render.js imports.
  - **Passives**: a simple glyph per passive id (Bandwidth Upgrade: double chevron; Redundant Power
    Supply: two stacked PSU bars), with a generic circle fallback for an unknown id.
  - All icons are `aria-hidden="true"` (FR-012) and static (reduced-motion edge case).
- **Rationale**: SVG is crisp at any device pixel ratio, needs no canvas per entry, and the markup is a
  string a jsc test can inspect. Presentation (colours, glyphs) already lives in render.js keyed by tool
  id (`PROJECTILE_COLORS`), so this follows the existing split; no new data fields are needed.
- **Alternatives**: `icon` fields in data/game.json — adds validation for presentation-only values;
  reusing `makeSprite` canvases — blurry when scaled and harder to test.

## R6 · Navigation, Esc, and focus

- **Decision**: The pause panel gets a "Field Guide" button between Resume and Quit to Title. The guide
  is a new overlay screen `guide` with: a Back button, a `role="tablist"` with two `role="tab"` buttons
  (Left/Right arrows move between them, `aria-selected`), and one `role="tabpanel"` scroll container.
  Each entry is an `<article tabindex="0">` labelled by its name, so Tab reaches every entry. Esc **and
  P** close the guide back to the pause screen (they never resume from the guide), with focus on the
  Field Guide button. The guide opens on "Network problems".
- **Rationale**: FR-002 requires Esc to return to the pause screen and the game to stay paused; P is the
  other pause key, so treating it the same avoids a surprise resume. The tablist pattern is what FR-012
  asks for.
- **Alternatives**: Esc resumes the game directly — breaks FR-002.

## R7 · Phones and touch

- **Decision**: The guide panel uses the full overlay inside the safe area (`--sat` etc. from feature
  003), with the header (Back, tabs) fixed and the list scrolling (`overflow-y: auto;
  overscroll-behavior: contain; touch-action: pan-y`). `guide` joins the tap-guarded screens in
  screens.js (500 ms plus all fingers lifted, feature 003). Entries are not buttons, so a scroll gesture
  that ends on an entry selects nothing. Controls are ≥ 44 × 44 CSS px on touch.
- **Rationale**: Matches FR-013/FR-014 and the existing overlay lock (`body.touch .overlay`), which
  stops the page itself from scrolling or zooming.
- **Alternatives**: A separate full-page view — would fight the overlay lock and safe-area code.

## R8 · Verification

- **Decision**: New jsc unit tests (`tests/guide.test.js`) for the model, locking, stats, icons, and
  no-change; one new browser page (`tests/browser/smoke-guide.html`) for open/close/keyboard/focus/ARIA;
  a phone check added to `tests/browser/touch_checks.py` (fit at 360 × 640 both orientations, scroll
  inside the guide only, tap guard). Real screen reader, real phones, and the SC-006 playtest are human
  checks, recorded "not run" until done.
