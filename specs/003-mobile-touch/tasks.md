---

description: "Task list for feature 003 — Mobile and Touch Play"
---

# Tasks: Mobile and Touch Play

**Input**: Design documents from `specs/003-mobile-touch/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md);
constitution v2.0.0 (platform amended 2026-11-19)

**Tests**: Included. The plan and quickstart require unit tests U1–U5, scripted touch checks T1–T11,
and real-device checks H1–H6 (constitution C7).

**Organization**: Grouped by user story: US1 Steer with a thumb (P1), US2 Every screen works by tap
(P1), US3 Fits the screen and stays put (P1), US4 Plays smoothly on a mid-range phone (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 as above
- Paths are relative to the repository root.

## Global rules for every task

- Desktop must stay unchanged until a touch happens (FR-020): no new visible element, layout change,
  or behaviour change for a never-touched mouse-and-keyboard device.
- `ui/joystick.js`, `ui/tapguard.js`, and `ui/view.js` are pure: no `window`, `document`, timers, or
  `Math.random` at import or call time, so they run under `jsc -m tests/run.mjs`.
- The engine changes only in `moveEngineer`; keyboard inputs must keep producing identical state
  hashes (all existing determinism tests unchanged).
- After each phase run `jsc -m tests/run.mjs` and keep all existing tests (98) passing; from Phase 2
  on, also run the existing desktop browser checks (`python3 tests/browser/drive.py`, excluding touch).

---

## Phase 1: Setup

- [x] T001 Remove the Sync Impact Report comment from the top of `.specify/memory/constitution.md` (keep the v2.0.0 content) so it is ready to commit
- [x] T002 [P] Create empty test modules `tests/movement.test.js` and `tests/touch-ui.test.js` with the existing harness pattern and register both in `tests/files.js`
- [x] T003 [P] Create empty pure modules `ui/joystick.js`, `ui/tapguard.js`, `ui/view.js` and a DOM module `ui/touchmode.js`, each with a header comment naming its contract section ([contracts/input.md](./contracts/input.md), [contracts/ui-controls.md](./contracts/ui-controls.md))
- [x] T004 [P] Extend the purity source scan in `tests/determinism.test.js` to cover `ui/joystick.js`, `ui/tapguard.js`, and `ui/view.js` (no `document`, `window`, `setTimeout`, `setInterval`, `performance.now`, `Math.random`)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Analog engine input, touch-mode detection, and the trusted-touch browser driver. Every
story depends on these.

### Tests first

- [x] T005 [P] Write U1 in `tests/movement.test.js`: inputs at 0°, 30°, 45°, 137°, 300° move exactly `moveSpeed × dt` in that direction; `{dx: 5, dy: 0}` behaves like `{1, 0}`; `NaN`, `undefined`, strings, and `Infinity` count as 0; `{0, 0}` does not move; keyboard-style inputs (−1/0/1) give the same positions as before (compare against the existing straight and diagonal tests in `tests/combat.test.js`)
- [x] T006 [P] Write U2 in `tests/movement.test.js`: a recorded 1,800-step sequence of arbitrary-angle inputs (generated from `createRng`) played twice yields identical `hashRun`; and the existing 3,600-step keyboard determinism hash in `tests/determinism.test.js` is unchanged by the engine change (the test already exists — confirm it still passes)

### Implementation

- [x] T007 Change `moveEngineer` in `engine/combat.js` per data-model.md `MovementInput.dx` and `MovementInput.dy`: replace `clampAxis` (−1/0/1 snapping) with clamping to [−1, 1] and non-finite → 0, then normalise the non-zero vector so speed is always full and `facing` follows the exact angle
- [x] T008 [P] Implement `ui/touchmode.js` per data-model.md `TouchMode.on`: `createTouchMode()` returns `{get on, onChange(cb)}`; on at load when `matchMedia('(pointer: coarse)')` matches; set on at the first `pointerdown` with `pointerType === 'touch'` (capture phase on `window`); never set off; toggles class `touch` on `<body>`
- [x] T009 [P] Write the stdlib-only DevTools Protocol client `tests/browser/cdp.py` (research T8): discover the page target via `http://127.0.0.1:<port>/json`, open a minimal WebSocket (handshake + masked text frames + frame reading), `send(method, params)` returning the matching result; helpers `set_device(width, height, mobile, dpr)` (`Emulation.setDeviceMetricsOverride` + `Emulation.setTouchEmulationEnabled`), `touch(type, points)` (`Input.dispatchTouchEvent`), `throttle(rate)` (`Emulation.setCPUThrottlingRate`), `evaluate(expr)` (`Runtime.evaluate`, returnByValue)
- [x] T010 *(The check functions live in `tests/browser/touch_checks.py`, run by `drive.py`.)* Extend `tests/browser/drive.py` with CDP-driven checks: launch Chrome with `--remote-debugging-port=<free port>` for entries marked `cdp`, run a Python check function per entry that drives touches through `cdp.py` and reads results via `evaluate` (and/or `/__result`), print PASS/FAIL like the other checks, and add `--only touch` filtering; existing checks keep running exactly as before
- [x] T011 [P] Update the input table in `specs/001-survivors-first-playable/contracts/engine-api.md` for `step(run, input)`: `dx`, `dy` any finite number clamped to [−1, 1], direction normalised (feature 003), per [contracts/input.md](./contracts/input.md)

**Checkpoint**: U1–U2 and all 98 existing tests pass; desktop browser checks pass; `drive.py` can
open an emulated phone and dispatch a trusted touch.

---

## Phase 3: User Story 1 — Steer with a thumb (Priority: P1) 🎯 MVP

**Goal**: Touch anywhere and drag to steer at any angle at full speed; release stops; one finger only.

**Independent Test**: Emulated phone (390 × 844): start a run by tap, drag at 30° → the engineer heads
≈ 30° at full speed within 100 ms; release → stops within 100 ms; the joystick shows and hides; a
second finger changes nothing (T1, T2).

### Tests for User Story 1

- [x] T012 [P] [US1] Write U3 in `tests/touch-ui.test.js` for `joystickStep`: a point inside 10% of the radius → `{0, 0}` and base unchanged; a point at 30° and 40 px → unit vector at 30° and base unchanged; a point 100 px away with radius 56 → unit vector, base moved toward the point so it is exactly 56 px away; never returns NaN when point equals base
- [x] T013 [US1] Add CDP checks T1 and T2 to `tests/browser/drive.py` (functions `check_touch_mode`, `check_steering`): T1 — phone emulation shows `body.touch`, `#touch-pause`, `#touch-sound` on load; desktop emulation (no touch) shows none of them until one trusted touch, then shows them; a never-touched desktop page never does. T2 — start by tap; touch down, move to 30° 60 px away; within 100 ms `run.engineer.facing` ≈ 30° (±2°) and speed equals `moveSpeed`; `#joystick` visible at the touch point; second touch dragged elsewhere leaves facing unchanged; lift → engineer stationary within 100 ms and `#joystick` hidden; a touch that starts on HUD text (e.g. the difficulty label) steers; a touch on `#touch-pause` pauses and does not steer

### Implementation for User Story 1

- [x] T014 [US1] Implement `JOYSTICK_RADIUS`, `DEAD_ZONE`, and `joystickStep(base, point, radius, deadZone)` in `ui/joystick.js` per [contracts/input.md](./contracts/input.md) and data-model.md `TouchSteeringState.radius`, `TouchSteeringState.deadZone`, `TouchSteeringState.base`, `TouchSteeringState.direction`
- [x] T015 [US1] Add pointer steering to `createInput` in `ui/input.js` per [contracts/input.md](./contracts/input.md) and data-model.md `TouchSteeringState.pointerId`, `TouchSteeringState.point`: accept an `isPlaying()` option; start on a touch `pointerdown` on the canvas only while playing (call `setPointerCapture`), ignore other pointers while one steers, update on `pointermove` via `joystickStep`, end on `pointerup` / `pointercancel` / `lostpointercapture` or when `isPlaying()` turns false; `move()` returns the touch direction while steering, else `moveFromKeys`; add `joystick()` for drawing; `clear()` also ends steering
- [x] T016 [P] [US1] Add the joystick element to `index.html` (`#joystick` with ring and knob, `aria-hidden="true"`) and its styles to `style.css` (fixed-position, pointer-events none, 112 px ring, hidden by default, shown with a class), plus `touch-action: none` on `#game` so dragging the play field never scrolls
- [x] T017 [US1] Wire touch steering in `main.js`: pass `isPlaying` to `createInput`; each frame position/show/hide `#joystick` from `input.joystick()`; create touch mode (`ui/touchmode.js`) at boot; expose `touchMode` and the joystick state on the `__uptimeSurvivors` debug handle
- [x] T018 [US1] Run U3, T1, T2 (`drive.py --only touch`) and the desktop checks; fix failures

**Checkpoint**: A run can be steered by touch in an emulated phone; desktop unchanged.

---

## Phase 4: User Story 2 — Every screen works by tap (Priority: P1)

**Goal**: Pause and Sound buttons, a touch controls reminder, and the lift-first + 500 ms tap guard on
level-up and pause screens; every action possible by tap.

**Independent Test**: Emulated phone, touch only: start, choose 3 upgrades, pause/resume, mute/unmute,
move both sliders, quit to title, New Run, Replay Seed (T3); a finger held when level-up opens never
selects, and taps before 500 ms are ignored (T4).

### Tests for User Story 2

- [x] T019 [P] [US2] Write U4 in `tests/touch-ui.test.js` for the tap guard: opened at t=0 with pointer 7 held → `canArm` false at 600 ms while 7 is down; true at 600 ms after 7 lifts; false at 300 ms with nothing held; true at exactly 500 ms; a selection whose pointerdown came before arming is rejected even if it ends later
- [x] T020 [US2] Add CDP checks T3 and T4 to `tests/browser/drive.py` (`check_tap_everything`, `check_tap_guard`): T3 — launched with `--autoplay-policy=no-user-gesture-required` as in feature 002's checks: after the Start tap, `audio.status === 'running'` within 500 ms and the HUD reads "♪ Sound on (M)" (FR-019); a `#touch-sound` tap mutes (`audio.muted === true`, master gain ≈ 0) and a second tap unmutes; then every action in the Independent Test above by trusted taps only, asserting the resulting phase/settings each time; and no control has information available only on hover — every button and slider has visible text or an `aria-label`, and no element relies on a `title` tooltip (FR-021); T4 — hold a finger, force a level-up via the debug handle, lift the finger over choice 1 → no choice made; tap choice 1 at ~300 ms → ignored; tap at ~600 ms → chosen and play resumes immediately; repeat on the pause screen with the Resume button; on the pause screen, a finger held at open and then dragged across the Music slider leaves `musicVolume` and the slider value unchanged; keyboard `Digit1` and a mouse click are not delayed (desktop unchanged)

### Implementation for User Story 2

- [x] T021 [US2] Implement `createTapGuard(openedAt, heldAtOpen, minDelayMs = 500)` with `canArm(now, pointersDown)` in `ui/tapguard.js` per data-model.md `TapGuard.openedAt`, `TapGuard.heldAtOpen`, `TapGuard.minDelayMs`
- [x] T022 [US2] Track touch pointers currently down (capture-phase `pointerdown` / `pointerup` / `pointercancel` on `window`) and apply the guard in `ui/screens.js`: when the `levelup` or `paused` screen opens, create a guard from the current time and pointers; on the overlay, a touch `pointerdown` arms only if `canArm`; in the capture phase call `preventDefault()` and `stopPropagation()` on any touch `pointerdown` that is not armed, and keep the overlay's interactive elements `pointer-events: none` until the guard can arm (re-enable at `openedAt + 500 ms` once every held pointer is up), so buttons, choices, and sliders never react to an unarmed touch and slider positions always match the real volume; as a backstop also cancel unarmed touch-originated `click`s; mouse, pen, and keyboard pass through ([contracts/ui-controls.md](./contracts/ui-controls.md) › Tap guard)
- [x] T023 [P] [US2] Add `#touch-pause` ("❚❚", `aria-label="Pause"`) and `#touch-sound` ("♪", `aria-label="Sound"`, `aria-pressed`) buttons to `index.html` inside the HUD, and style them in `style.css`: ≥ 44 × 44 CSS px, top-right below the HUD top row, inside `env(safe-area-inset-*)`, shown only under `body.touch` during a run; the HUD stays `pointer-events: none` so touches on HUD text reach the play field, while `#touch-pause` and `#touch-sound` get `pointer-events: auto`
- [x] T024 [US2] Wire the buttons in `main.js` and `ui/hud.js`: Pause button calls `togglePause`; Sound button calls `toggleMute` and reflects state (`aria-pressed`, glyph ♪ / ♪̸) alongside the existing HUD sound text; a touch starting on a button never starts steering (T015 already limits steering to the canvas — verify)
- [x] T025 [P] [US2] Show the touch controls reminder on the title in `ui/screens.js` `showTitle` when touch mode is on ("Steer: touch and drag anywhere", "Pause: ❚❚ button", "Sound: ♪ button"; FR-009), keyboard lines otherwise; re-render the title if touch mode turns on while it is shown; make overlay buttons, choices, and sliders ≥ 44 px tall under `body.touch` in `style.css` (FR-010)
- [x] T026 [US2] Run U4, T3, T4 and the desktop checks; fix failures

**Checkpoint**: A full run is possible by touch alone with no accidental selections.

---

## Phase 5: User Story 3 — Fits the screen and stays put (Priority: P1)

**Goal**: Every screen fits phones and tablets in both orientations within safe areas; the page never
scrolls, zooms, or refreshes; rotation keeps the run; the view shows ≥ 330 game units; hiding pauses.

**Independent Test**: Emulated 360 × 640, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768: all screens
fit inside the viewport and simulated safe areas; drags, double taps, long press, and pull-down move
nothing; rotating mid-run keeps the run; short side shows ≥ 330 units (T5–T8, T10).

### Tests for User Story 3

- [x] T027 [P] [US3] Write U5 in `tests/touch-ui.test.js` for `viewScale(w, h)`: 1400 × 1000 → same value as feature 001's formula (≈ 1.303); 390 × 844 and 844 × 390 → 390 / 660 ≈ 0.591; 360 × 640 → ≥ 330 units on the short side; for a grid of sizes from 320 × 480 to 2560 × 1440 the short side always shows ≥ 330 units and the scale never exceeds feature 001's value
- [x] T028 [US3] Add CDP checks T5–T8 and T10 to `tests/browser/drive.py` (`check_page_lock`, `check_fit`, `check_rotation`, `check_view_distance`, `check_hidden`): T5 — vigorous trusted drags, a double tap, a 1 s long press, and a pull-down from the top: `scrollY` 0, `visualViewport.scale` 1, same `performance.timeOrigin` (no reload), empty selection; and on desktop emulation without touch, end-screen text can still be selected; T6 — at each size, title, HUD, level-up, pause, and end screens: every visible element's rect within the viewport and, with simulated safe-area insets (CSS custom-property override fallback if `Emulation.setSafeAreaInsetsOverride` is unavailable), HUD and buttons inside the insets; no horizontal or vertical overflow; T7 — 390 × 844 → 844 × 390 mid-run: canvas re-sized within 1 s, `run.phase` unchanged, tick continues; T8 — at each size `render.stats().viewHalfShort` ≥ 330, desktop 1400 × 1000 scale unchanged; T10 — dispatch `visibilitychange` (hidden) and `pagehide` → run paused and audio suspended

### Implementation for User Story 3

- [x] T029 [US3] Implement `viewScale(w, h)` and `VIEW_RADIUS`/`MIN_VIEW_UNITS` in `ui/view.js` per data-model.md `ScreenFit.w`, `ScreenFit.h`, `ScreenFit.scale`, `ScreenFit.viewHalfShort`; use it in `ui/render.js` `resize()` (multiplied by the device-pixel-ratio) and report `viewHalfShort` in `render.stats()`
- [x] T030 [US3] Lock the page in `index.html` and `style.css` (research T5): viewport meta `width=device-width, initial-scale=1, viewport-fit=cover`; on `body.touch` (and always on `#game`): `overscroll-behavior: none`, `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`; overlay panels under `body.touch` get `touch-action: manipulation`; in `ui/touchmode.js`, while touch mode is on, prevent `contextmenu` and `gesturestart`. Desktop without touch keeps text selection and every other default (FR-020)
- [x] T031 [US3] Make the layout fit in `style.css` per data-model.md `ScreenFit.safeInsets`: `#game` and overlay sized with `100dvw`/`100dvh` (fallback `100vw`/`100vh`); HUD padded by `env(safe-area-inset-*)`; compact HUD below 600 px width (smaller meters, loadout wraps or truncates, test label on its own line); overlay panels scroll-free at 360 × 640 (max-height with internal layout, smaller headings on short screens); a "Rotate your device for more room" hint shown only below 360 px portrait (FR-011, FR-012)
- [x] T032 [US3] Handle rotation and iOS viewport changes in `ui/render.js` and `main.js`: also listen to `visualViewport` `resize` and `orientationchange`; re-fit within one frame; never reset or pause the run on resize (FR-014)
- [x] T033 [US3] Add `pagehide` to the hidden-page handling in `ui/input.js` (same path as `visibilitychange` hidden: pause + `audio.suspend()`), and resume sound on `pageshow`/visible as now (FR-016)
- [x] T034 [US3] Run U5, T5–T8, T10 and the desktop checks; fix failures

**Checkpoint**: Every screen fits every tested size; the page never moves; rotation and hiding are safe.

---

## Phase 6: User Story 4 — Plays smoothly on a mid-range phone (Priority: P2)

**Goal**: Adaptive render quality keeps play smooth on slower devices without changing gameplay.

**Independent Test**: Emulated phone with CPU throttled 4×: ≥ 50 fps average with 150 enemies and ≥ 30
with 300, no frame > 250 ms; quality level reported (T9).

### Tests for User Story 4

- [x] T035 [US4] Add CDP check T9 to `tests/browser/drive.py` (`check_throttled_perf`): 390 × 844 phone emulation, `throttle(4)`, start a run, test-only invincibility, spawn 150 then 300 enemies with huge health (as in `smoke3.html` perf mode), measure frame intervals for 5 s each via `requestAnimationFrame` in the page; report avg, p95, max, and `render.stats().quality`; pass per SC-004 thresholds

### Implementation for User Story 4

- [x] T036 [US4] Add the quality governor to `ui/render.js` per data-model.md `RenderQuality.level`, `RenderQuality.window`, `RenderQuality.threshold`: track frame times; when the 2 s average exceeds 20 ms, step down one level (DPR cap 2 → 1.5 → 1, then particles and flash off); never step up during the page session; apply immediately (re-run `resize()` for DPR changes); report `quality` in `stats()`
- [x] T037 [US4] Add a test-only frame-rate overlay in `ui/render.js` and `main.js`, enabled by `?fps=1` (parsed in `ui/params.js` and shown in the HUD test label like other test settings): refreshed every second, it shows average fps over the last 5 s, p95 and worst frame time, enemy count, and render quality level; it never appears without the parameter (SC-004 real-device measurement, quickstart H4)
- [x] T038 [US4] Run T9 and the desktop F5/B7 perf checks; tune the governor (not gameplay) until T9 passes or record the measured shortfall honestly; fix failures

**Checkpoint**: Throttled phone emulation meets SC-004 or the gap is recorded.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T039 Run the full suite: `jsc -m tests/run.mjs`, unit tests in Chrome, and `python3 tests/browser/drive.py` (all desktop checks + touch checks T1–T10 = T11 desktop-unchanged evidence); fix regressions
- [x] T040 [P] Mark feature 001 task T074 (GitHub Pages) done in `specs/001-survivors-first-playable/tasks.md` with a note that the game is published on GitHub Pages, and replace the README known-limit line "Not published to GitHub Pages…" with the published URL (ask the user for the exact URL if it cannot be derived from the `origin` remote)
- [x] T041 Update `README.md`: controls table (touch: drag to steer, ❚❚ pause, ♪ sound; level-up/pause tap guard), a short "Play on a phone" section (Pages URL, both orientations, iPhone silent-switch note), status and known limits (headless Chrome is not Safari; older-phone performance unverified), project layout (new `ui/` modules), and verification rows U1–U5, T1–T11, H1–H6 with pass / fail / not run, date, environment, plus a row "FR-021 no hover-only information: pass (T3) / by inspection"
- [ ] T042 *(Not run — needs the user's phones; README rows "Phone H1–H5" say not run.)* Real-device checks H1–H5 on the user's current iPhone (Safari) and current Android phone (Chrome) via the GitHub Pages build of this branch or a LAN-served copy; use `?fps=1` for H4; record results in `README.md` (requires the user; record "not run" until done)
- [ ] T043 *(Not run — needs 5 people; README row "Phone H6" says not run.)* Playtest H6 (SC-008) with 5 people on their own phones; record in `README.md` (requires people; record "not run" until done)
- [x] T044 *(Done 2026-11-19: U1–U5 and T1–T11 run and recorded; H1–H6 recorded as not run.)* Walk through [quickstart.md](./quickstart.md) end to end and tick tasks in this file only with their evidence recorded

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1** → **US2** → **US3** → **US4** → **Polish**
- **US1** needs T007 (analog engine input), T008 (touch mode), T009–T010 (CDP driver).
- **US2** needs US1's touch mode wiring (T017) for button visibility; the tap guard itself (T021–T022)
  depends only on Phase 2. Its T3 check steers with US1.
- **US3** needs Phase 2 only (its checks emulate sizes and dispatch touches); it can run in parallel
  with US2 if different people work on `ui/screens.js` vs `style.css`/`ui/render.js` — but T030/T031
  and T016/T023/T025 all touch `style.css`, so sequence those.
- **US4** needs T029 (view scale lives in the same `resize()` the governor changes).
- Same-file sequences: `ui/input.js` (T015 → T033); `ui/render.js` (T029 → T032 → T036 → T037);
  `style.css` (T016 → T023 → T025 → T030 → T031); `main.js` (T017 → T024 → T030/T032);
  `tests/browser/drive.py` (T010 → T013 → T020 → T028 → T035).

### Story completion order

```text
Setup ─▶ Foundational ─▶ US1 (steer) ─▶ US2 (tap) ─▶ US3 (fit) ─▶ US4 (perf) ─▶ Polish
                                    └───────────── US3 can start after Foundational ─┘
```

---

## Parallel Examples

```text
Phase 1:  T002 tests registration  ∥  T003 module stubs  ∥  T004 purity scan
Phase 2:  T005 + T006 movement tests  ∥  T008 ui/touchmode.js  ∥  T009 tests/browser/cdp.py  ∥  T011 001 contract
US1:      T012 joystick unit tests  ∥  T016 index.html/style.css joystick markup
US2:      T019 tap-guard unit tests  ∥  T023 button markup/styles  ∥  T025 title reminder
US3:      T027 viewScale unit tests  (then T029 → T032 in ui/render.js)
Polish:   T040 001 tasks + README Pages line  ∥  T042 real-device checks (user)
```

---

## Implementation Strategy

### MVP first

1. Phases 1–2 — analog engine input proven by U1–U2 with unchanged keyboard hashes; trusted-touch
   driver working.
2. Phase 3 (US1) — steering by touch. **Stop and validate** T1, T2, and that desktop checks pass.
3. Phase 4 (US2) — without the buttons and tap guard a phone player cannot pause, mute, or safely
   choose upgrades, so US1 + US2 together are the smallest shippable mobile version.

### Incremental delivery (plan slices)

| Plan slice | Tasks | Evidence |
|------------|-------|----------|
| 0 · Scope | (done: constitution v2.0.0) + T001 | Amendment recorded |
| 1 · Engine + pure modules | T002–T008, T011, T012, T014, T019, T021, T027, T029 | U1–U5 |
| 2 · Steering | T009, T010, T013, T015–T018, T030 | T1, T2, T5, T11 |
| 3 · Buttons and guard | T020, T022–T026 | T3, T4 |
| 4 · Fit | T028, T031–T034 | T6, T7, T8, T10 |
| 5 · Performance | T035–T038 | T9; H4 |
| 6 · Package | T039–T044 | README rows complete |

### Fallback

If time runs short, ship slices 1–3 (steering, buttons, guard) plus the page lock (T030) and record fit
polish (T031–T032) and adaptive quality (T036) as not delivered ([plan.md](./plan.md) › Scope controls).
