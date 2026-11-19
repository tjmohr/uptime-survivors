# Research: Mobile and Touch Play

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Builds on features 001 and 002: a pure, deterministic engine stepped at a fixed 1/60 s, fed one
movement input `{dx, dy}` per step; a Canvas 2D renderer; HTML overlays for HUD and screens; Web Audio
sound started on the Start click.

## T1 · Movement input: analog direction in the engine

- **Finding**: `engine/combat.js` snaps each axis to −1, 0, or 1 (`clampAxis`), so the engine can only
  move in 8 directions. FR-001 requires any angle.
- **Decision**: The engine accepts any finite `dx`, `dy` in [−1, 1] (values outside are clamped, non-
  numbers become 0) and normalises the direction, so speed stays full in every direction (FR-002,
  clarification Q2). A zero vector means "stand still".
- **Rationale**: Keyboard inputs (−1/0/1) produce exactly the same numbers as before, so every existing
  state hash and determinism test is unchanged (SC-006). Touch inputs are plain numbers per step, so a
  recorded touch run replays exactly (FR-005, SC-007).
- **Alternatives considered**: Snap touch to 8 or 16 directions in the UI (feels wrong on a joystick;
  violates FR-001); a separate engine input type for touch (two code paths for one concept).

## T2 · Touch input: Pointer Events, floating joystick

- **Decision**: Use Pointer Events. The first `pointerdown` of type `touch` on the play field (not on a
  button or open screen) becomes the steering pointer; its start point is the joystick centre. Later
  pointers are ignored for steering (FR-004). `pointerup` / `pointercancel` / `lostpointercapture`
  end steering (FR-003). The joystick has a 56 CSS px radius and a 10% dead zone; if the finger goes
  past the edge, the base is dragged along behind it (floating) so steering never stalls.
  The pure mapping (origin, point → direction, new base) lives in `ui/joystick.js`.
- **Rationale**: Pointer Events unify touch, pen, and mouse, support pointer capture (finger may leave
  the canvas or screen edge), and expose `pointerType` for touch-mode detection.
- **Alternatives considered**: Touch Events (more code, no pointer capture); fixed on-screen joystick
  (takes space, harder in both orientations).

## T3 · Touch mode detection

- **Decision**: Touch mode starts on when `matchMedia('(pointer: coarse)')` matches at load (main input
  is a finger), and switches on for the rest of the page session at the first `pointerdown` with
  `pointerType === 'touch'` (clarification Q3). Touch mode adds a `touch` class on `<body>` that shows
  the Pause/Sound buttons and the touch controls reminder.
- **Alternatives considered**: `'ontouchstart' in window` / `maxTouchPoints` (true on touchscreen
  laptops, would show buttons to keyboard users); user-agent sniffing (unreliable).

## T4 · Tap guard on level-up and pause screens

- **Decision**: A small pure guard (`ui/tapguard.js`) records, when a screen opens, the time and the set
  of touch pointers currently down. A touch `pointerdown` on the overlay "arms" a selection only if
  every recorded pointer has been lifted and ≥ 500 ms have passed (clarification Q5). Touch-originated
  `click`s that were not armed are cancelled in the capture phase. Mouse, pen, and keyboard selection
  bypass the guard (desktop unchanged).
- **Rationale**: Testing the guard as a pure function makes the timing rules unit-testable without a
  browser; filtering in the capture phase leaves the existing screen code untouched.
- **Alternatives considered**: Disabling buttons for 500 ms (also blocks keyboard; doesn't cover the
  "finger still down" case); a resume countdown (rejected in Q5).

## T5 · Stopping the page from moving

- **Decision**: viewport meta `width=device-width, initial-scale=1, viewport-fit=cover`; on
  `body.touch` (touch mode only), plus `#game`: `overscroll-behavior: none`, `touch-action: none`, `user-select: none`,
  `-webkit-user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color:
  transparent`; prevent `contextmenu` and iOS `gesturestart`. Overlay panels use
  `touch-action: manipulation` so buttons and sliders work but double-tap zoom stays off.
- **Rationale**: Covers scroll, rubber-band bounce, pull-to-refresh, pinch and double-tap zoom, long-
  press menus, text selection, and the iOS magnifier (FR-013) without `user-scalable=no`, which iOS
  ignores. Scoping to touch mode keeps desktop behaviour unchanged (FR-020); phones get the lock
  from page load because touch mode is on from the start there.
- **Risk**: iOS Safari's handling of pinch inside `touch-action: none` areas varies by version —
  confirmed only on the real iPhone (quickstart H).

## T6 · Fitting the screen and view distance

- **Decision**: Layout uses `100dvh`/`100dvw` with safe-area padding `env(safe-area-inset-*)` on the HUD
  and buttons (FR-012); a compact HUD layout below 600 CSS px width. The renderer's zoom becomes
  `scale = min(max(1, halfDiagonal / 660), shortSide / 660)` (CSS px per game unit), so the short side
  always shows ≥ 330 game units each way (FR-015). On a 1400 × 1000 desktop the cap (1.51) is above the
  current value (1.30), so desktop is unchanged; on a 390 × 844 phone, in either orientation, the scale
  drops from 1.0 to 0.59. Pure function `viewScale(w, h)` in `ui/view.js`.
- **Note**: the short side is what limits the view, so a phone in landscape (390 px tall) shrinks the
  same as in portrait. The spec's clarification wording was corrected accordingly.
- **Rotation**: the existing `resize` handler re-fits within one frame (FR-014); `visualViewport`
  resize is also listened to for iOS.

## T7 · Performance and adaptive quality

- **Decision**: Keep the fixed-step engine (FR-018). Add a quality governor in the renderer: if the
  average frame time over 2 s exceeds 20 ms, step down one level — (1) device-pixel-ratio cap 2 → 1.5,
  (2) → 1, (3) particles and screen flash off. Never steps back up during a page session. Current
  level shown in `render.stats()`.
- **Rationale**: Pixel count dominates canvas cost on phones (high-DPR screens); dropping resolution
  first keeps visuals mostly intact (FR-017).
- **Alternatives considered**: Fewer enemies on slow devices (changes gameplay; violates C5/FR-018).

## T8 · Scripted checks with real touch: Chrome DevTools Protocol

- **Decision**: Extend `tests/browser/drive.py` with a stdlib-only DevTools Protocol client
  (`tests/browser/cdp.py`: HTTP `/json` discovery + a minimal WebSocket client). Touch checks launch
  headless Chrome with `--remote-debugging-port`, then use `Emulation.setDeviceMetricsOverride`
  (phone sizes, `mobile: true`), `Emulation.setTouchEmulationEnabled`, `Input.dispatchTouchEvent`
  (trusted touches, so pointer events and clicks behave like a real finger), and
  `Emulation.setCPUThrottlingRate` (4×, SC-004 mid-range proxy). Results are still reported through
  `/__result`.
- **Rationale**: Synthetic `new PointerEvent()` calls are untrusted and do not trigger default actions
  (scroll, zoom, click synthesis), so they cannot prove FR-013 or the tap guard. No new dependency.
- **Alternatives considered**: Playwright/Puppeteer (Node not installed; adds dependencies); in-page
  synthetic events only (insufficient evidence).
- **Limits**: Headless Chrome is not Safari. Safe-area insets are checked by overriding the CSS
  environment where Chrome supports it and confirmed on the real iPhone; feel, iOS zoom behaviour, the
  silent switch, and real frame rates are confirmed on the two test phones.

## T9 · Sound on touch

- **Decision**: No change to feature 002's audio: `click` on Start is a user activation on iOS and
  Android, so `AudioContext` creation/resume succeeds (FR-019). The touch Sound button calls the same
  mute toggle as M. iOS `pagehide` is added to the existing hide handling (FR-016).

## T10 · Constitution scope

- **Finding**: The constitution's First Release Scope says "**Platform:** desktop browser, static files
  only, no install." Supporting phones and tablets changes that agreed scope.
- **Decision**: Amend the constitution before implementation (Governance: "Change this budget only by
  updating the agreed scope"), e.g. "Platform: desktop and mobile web browsers (keyboard or touch),
  static files only, no install." This is a change to the release budget; under the constitution's
  versioning rule that is a MAJOR bump (1.0.1 → 2.0.0) unless the amendment classifies it as an
  expansion. Done with `/speckit-constitution`, not by this plan.
- **Status**: Done — constitution amended to v2.0.0 on 2026-11-19 (MAJOR, per the release-budget rule).
