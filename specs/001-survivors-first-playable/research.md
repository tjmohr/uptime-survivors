# Research: Uptime Survivors — First Playable

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-18

Source inputs: the spec (including its Clarifications), the constitution (v1.0.0), and
the workshop starter plan (no longer in the repository). The starter plan's quiz-specific parts (`evaluate(challenge, answer)`,
submit/retry/hints, briefings, source records) are workshop-template leftovers and are not used.
Its general rules — static files, no framework, data in JSON, pure logic separate from UI,
dependency-free browser test runner, recorded verification — are kept.

## R1 · Rendering: Canvas 2D instead of DOM/SVG

- **Decision**: Draw the play field with the browser's built-in Canvas 2D API. Use ordinary HTML
  elements for the title, level-up, pause, end, and error screens laid over the canvas.
- **Rationale**: The spec needs up to 300 enemies, 200 pickups, and many projectiles moving every
  frame (FR-020, SC-005). Creating and moving that many DOM/SVG nodes per frame is far slower than
  drawing to one canvas. Canvas is built into every browser, so it adds no dependency — the
  starter plan's "no rendering dependency" rule still holds. HTML overlays keep menus keyboard-
  and screen-reader-friendly.
- **Alternatives considered**: DOM/SVG per entity (starter default; too slow at 300+ entities);
  WebGL or a library such as Pixi/Phaser (faster, but adds a dependency or a lot of setup the
  60-minute build cannot afford, and the shape-based art does not need it).

## R2 · Game loop: fixed-step simulation, separate rendering

- **Decision**: Advance the game simulation in fixed steps of 1/60 s, driven by
  `requestAnimationFrame` with a time accumulator (at most 5 steps per frame to avoid a
  "spiral of death" after a stall). Rendering reads the latest state and never changes it.
- **Rationale**: Fixed steps make the simulation deterministic (C5): the same seed and the same
  per-step inputs always give the same result, independent of frame rate. They also make the
  engine testable without a browser (C6).
- **Alternatives considered**: Variable time step (simpler, but results depend on frame rate, which
  breaks seeded replay and SC-006).

## R3 · Seeded randomness

- **Decision**: A small seeded pseudo-random generator (mulberry32, 32-bit seed) owned by the run
  state. Every random choice in the engine — spawn position, enemy-type pick, level-up offers —
  calls it. `Math.random` is banned in `engine/` (checked by a test that scans the source).
  Visual-only effects in `ui/` may use their own unseeded randomness.
- **Rationale**: Satisfies C5 and FR-026 with about 10 lines of code and no dependency.
- **Alternatives considered**: `crypto.getRandomValues` (not seedable); a library such as
  seedrandom (unnecessary dependency).

## R4 · Replay and determinism evidence

- **Decision**: The engine takes input as a per-step record `{dx, dy}` (each −1, 0, or 1) plus
  level-up choice events. Tests replay a recorded input sequence twice with the same seed and
  compare a hash of the final state. In the game, "Replay Seed" starts a new run with the same
  seed (the player's own inputs will differ, so only the opening is identical).
- **Rationale**: Proves SC-006 automatically and cheaply. A full input recorder in the UI is not
  needed for the spec.
- **Alternatives considered**: Recording and replaying player input in the UI (useful for bug
  reports, but out of scope for v1).

## R5 · Collision with 300 enemies

- **Decision**: A uniform spatial grid (cell size 64 world units) rebuilt each step. Projectiles,
  orbit barriers, pulses, and the player query only nearby cells. All shapes collide as circles.
- **Rationale**: Checking every projectile against every enemy is O(n²), roughly 60,000 checks a
  step at the caps; the grid cuts that to a few hundred. Circles are simple and match the
  node-shaped art.
- **Alternatives considered**: Quadtree (more code for no gain at this scale); brute force (fine
  for the core-loop milestone, too slow at full difficulty).

## R6 · Glow effect without losing frame rate

- **Decision**: Pre-render each glowing shape once to a small off-screen canvas (using
  `shadowBlur`) and draw those cached images each frame. Do not use `shadowBlur` in the per-frame
  draw loop.
- **Rationale**: Live `shadowBlur` on hundreds of shapes per frame is a known Canvas performance
  trap. Cached images keep the network-diagram look (FR-025a) cheap.
- **Alternatives considered**: Live shadow blur (too slow at 300 enemies); no glow (loses the
  chosen look).

## R7 · Shortened-timer test setting and seed selection

- **Decision**: URL query parameters, read once at start: `?seed=<integer>` fixes the seed and
  `?levelSeconds=<number>` overrides every difficulty level's duration (e.g., `2` gives a
  40-second full run). Both are shown in small text on the HUD when active so a test run is never
  mistaken for a real one. Neither is shown on the title screen.
- **Rationale**: The spec requires a non-player-facing shortened timer (Assumptions, FR-029).
  Query parameters need no UI and work on static hosting.
- **Alternatives considered**: A hidden key combination (harder to document and reproduce); a
  separate test build (extra files to keep in sync).

## R8 · Testing without a framework

- **Decision**: A tiny shared test harness (`test`, `assertEqual`, `assertThrows`) used by two
  runners: `tests/index.html` (browser, as the starter plan requires) and `tests/run.mjs` (Node 18+,
  so agents and CI can run tests from a terminal). Both report totals and failed test names, and
  both treat zero tests found as a failure.
- **Rationale**: Engine modules are pure ES modules with no DOM, so the same test files run in
  both places. The Node runner gives a reproducible command for C7 evidence.
- **Alternatives considered**: Vitest/Jest (adds a dependency and install step); browser-only
  runner (fine for humans, awkward for automated checks).

## R9 · Data loading and validation

- **Decision**: All content lives in one file, `data/game.json`, loaded with `fetch` using a
  relative URL. A validator checks the whole file before the title screen enables Start and
  returns a list of errors, each naming the item ID and field. Any error shows the error screen
  instead of the game (FR-024).
- **Rationale**: One file is easiest to review and edit (C6); relative URLs work under a
  GitHub Pages subpath.
- **Alternatives considered**: Separate files per entity type (more requests and cross-file ID
  checks for little benefit at this size); a JSON Schema library (dependency).

## R10 · Initial balance targets

- **Decision**: Start from the tuning values in [data-model.md](./data-model.md#initial-tuning)
  and adjust in playtests against SC-002 (first level-up within 60 s) and SC-011 (most first runs
  end at difficulty 8–14). The tests check structure and monotonic difficulty, not exact feel.
- **Rationale**: Balance can only be confirmed by playing; keeping every number in data makes
  tuning a data edit, not a code change.
- **Alternatives considered**: Formula-generated difficulty curves (less reviewable than an
  explicit 20-row table).
