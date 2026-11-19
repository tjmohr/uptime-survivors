# Data Model: Mobile and Touch Play

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

This feature adds no game content and no files under `data/`. Everything below is UI state held in
memory for the page session (no persistence). Units: CSS pixels (px), milliseconds (ms), game units.

## Movement Input (engine, changed)

The one input the engine reads each step (feature 001 `step(run, input)`).

| Field | Type | Rule |
|-------|------|------|
| `dx` | number | Finite; clamped to [−1, 1]; non-number → 0 |
| `dy` | number | Finite; clamped to [−1, 1]; non-number → 0 |

Direction = `(dx, dy)` normalised; `(0, 0)` = stand still. Speed is always the engineer's full move
speed (FR-002). Keyboard produces only −1/0/1 per axis (unchanged); touch produces any direction.

## Touch Steering State (`ui/input.js`)

| Field | Type | Rule |
|-------|------|------|
| `pointerId` | number \| null | The single steering pointer; `null` when not steering (FR-004) |
| `base` | {x, y} px | Joystick centre; starts at the touch point; dragged along if the finger passes the edge |
| `point` | {x, y} px | Current finger position |
| `radius` | px | 56 |
| `deadZone` | fraction | 0.10 of `radius` (FR-002) |
| `direction` | {dx, dy} | Unit vector from `base` to `point`, or {0, 0} inside the dead zone |

Transitions: idle → (touch `pointerdown` on play field during `playing`) → steering → (`pointerup` /
`pointercancel` / lost capture / run leaves `playing`) → idle. Steering never starts on a button,
the overlay, or outside a run.

## Touch Mode (`ui/touchmode.js`)

| Field | Type | Rule |
|-------|------|------|
| `on` | boolean | True at load if the main pointer is coarse; set true at the first touch `pointerdown`; never set back to false in a page session (clarification Q3) |

When `on`: `<body>` has class `touch`; on-screen Pause and Sound buttons show during runs; the title
shows the touch controls reminder (FR-006, FR-009).

## Tap Guard (`ui/tapguard.js`)

One per opening of the level-up or pause screen (FR-008, clarification Q5).

| Field | Type | Rule |
|-------|------|------|
| `openedAt` | ms | Time the screen opened |
| `heldAtOpen` | set of pointer ids | Touch pointers down when the screen opened |
| `minDelayMs` | ms | 500 |

`canArm(now, pointersDown)` is true only when no id in `heldAtOpen` is still down and
`now − openedAt ≥ minDelayMs`. A touch selection counts only if its `pointerdown` happened while
`canArm` was true. Mouse, pen, and keyboard selection are not guarded.

## Screen Fit (`ui/view.js`, renderer)

| Field | Type | Rule |
|-------|------|------|
| `w`, `h` | px | Current layout viewport |
| `scale` | px per game unit | `min(max(1, hypot(w, h) / 2 / 660), min(w, h) / 660)` (FR-015) |
| `viewHalfShort` | game units | `min(w, h) / 2 / scale`; always ≥ 330 |
| `safeInsets` | px | From `env(safe-area-inset-*)`; HUD and buttons stay inside (FR-012) |

## Render Quality (renderer)

| Field | Type | Rule |
|-------|------|------|
| `level` | 0–3 | 0 full; 1 DPR cap 1.5; 2 DPR cap 1; 3 also particles and flash off |
| `window` | ms | 2000 of frame times averaged |
| `threshold` | ms | Average frame time > 20 ms steps down one level; never steps up in a session (FR-017) |
