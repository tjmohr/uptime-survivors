# Implementation Plan: Mobile and Touch Play

**Branch**: `003-mobile-touch` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-mobile-touch/spec.md`

## Summary

Make a full run playable with touch alone on phones and tablets, in both orientations, without
changing desktop play. A floating joystick (touch anywhere, drag to steer) feeds the engine an
any-angle direction; on-screen Pause and Sound buttons replace Esc/P and M; level-up and pause screens
get a lift-first + 500 ms tap guard; the page is locked against scroll/zoom/refresh; the view keeps at
least 330 game units visible on small screens; and the renderer lowers its resolution when a device
cannot keep up. The engine change is one function (analog movement input) that leaves every existing
hash unchanged. Decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3 — as features 001–002

**Primary Dependencies**: None. Browser built-ins only (adds Pointer Events, `matchMedia`, CSS
`env(safe-area-inset-*)`, `dvh` units)

**Storage**: N/A (touch mode and render quality are in memory for the page session)

**Testing**: Existing dependency-free harness (`tests/run.mjs`, `tests/index.html`); scripted headless
Chrome checks extended with a stdlib-only DevTools Protocol client for trusted touch input, device
emulation, and CPU throttling; real-device checks on a current iPhone (Safari) and Android phone (Chrome)

**Target Platform**: Desktop browsers with keyboard (unchanged) and mobile browsers with touch (Safari on
iOS, Chrome on Android), 360 × 640 CSS px and up

**Project Type**: Static single-page browser game, published on GitHub Pages

**Performance Goals**: SC-004 — current test phones ≥ 55 fps with 300 enemies; 4× CPU-throttled proxy ≥ 50
fps with 150 and ≥ 30 with 300; no freeze > 0.25 s; desktop SC-005 unchanged

**Constraints**: Engine stays pure and deterministic; keyboard inputs must produce identical hashes;
desktop look and behaviour unchanged until a touch happens; no dependencies; no `user-scalable=no`

**Scale/Scope**: ~4 new small UI modules, changes to input/render/screens/HUD/CSS/index, one engine
function, one new test page, a CDP helper for the driver

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun survivors-like, networking theme, original | Original assets; core loop | Same game and content; one-thumb steering keeps the survivors-like loop; new UI glyphs are plain text/CSS | ✅ | ✅ |
| C5 · Deterministic, self-contained | Seeded engine; static files; same-origin | Engine input becomes analog but stays a plain per-step value; keyboard hashes unchanged; touch runs replay exactly (U1, U2); no new requests | ✅ | ✅ |
| C6 · Content and logic reviewable separately | Rules separate from input/rendering | Touch handling, guard, and view math live in `ui/`; the engine change is input sanitising only; no game data changes | ✅ | ✅ |
| C7 · Done is demonstrated | Evidence; unrun checks visible | Unit U1–U5, scripted T1–T11, real-device H1–H6 recorded in README with pass / fail / not run | ✅ | ✅ |
| First Release Scope | "**Platform:** desktop and mobile web browsers, played with a keyboard or by touch; static files only, no install." (v2.0.0) | Phones and tablets by touch, published as static files on GitHub Pages; no gamepad, app, or offline mode. The original v1.0.1 platform line ("desktop browser") conflicted; resolved by the constitution amendment of 2026-11-19 (research T10). | ⚠️ | ✅ |

**Gate result: PASS** (against constitution v2.0.0). The first check found one conflict: the v1.0.1
First Release Scope named only desktop browsers. It was resolved openly, as Governance requires, by
amending the constitution to v2.0.0 on 2026-11-19 (platform: desktop and mobile web browsers, keyboard
or touch), not by weakening it here. No principle (C1, C5, C6, C7) is violated. Feature 001's spec is
annotated (done during `/speckit-specify`).

## Project Structure

### Documentation (this feature)

```text
specs/003-mobile-touch/
├── plan.md              # This file
├── research.md          # Phase 0: decisions T1–T10
├── data-model.md        # Phase 1: input, touch steering, touch mode, tap guard, screen fit, quality
├── quickstart.md        # Phase 1: U1–U5, T1–T11, H1–H6
├── contracts/
│   ├── input.md         # engine input change, joystick math, input module
│   └── ui-controls.md   # touch mode, buttons, guard, layout, view, hidden page
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
engine/
  combat.js              CHANGED — moveEngineer: clamp to [−1, 1] + normalise (any angle)

ui/
  joystick.js            NEW — pure joystickStep()
  tapguard.js            NEW — pure tap guard
  view.js                NEW — pure viewScale()
  touchmode.js           NEW — touch-mode detection, body class
  input.js               CHANGED — pointer steering, joystick state, pagehide
  render.js              CHANGED — viewScale, adaptive quality, joystick drawing hook (or HTML joystick)
  screens.js             CHANGED — touch reminder on title, guard on level-up/pause
  hud.js                 CHANGED — touch Pause/Sound buttons state

index.html               viewport-fit=cover; joystick and touch buttons
style.css                safe areas, dvh, compact HUD, page lock, touch-mode visibility, 44 px targets
main.js                  wire touch mode, buttons, guard; pass joystick to renderer

tests/
  movement.test.js       NEW — U1, U2
  touch-ui.test.js       NEW — U3, U4, U5
  files.js               register new tests
  browser/cdp.py         NEW — stdlib DevTools Protocol client
  browser/smoke-touch.html  NEW — T1–T10
  browser/drive.py       CHANGED — CDP-driven touch checks

.specify/memory/constitution.md   AMENDED to v2.0.0 (done via /speckit-constitution) — platform line
specs/001-survivors-first-playable/contracts/engine-api.md   input contract update
specs/001-survivors-first-playable/tasks.md   T074 marked done (already on GitHub Pages)
README.md                touch controls, mobile section, verification rows, Pages URL, known limits
```

**Structure Decision**: Keep the existing `engine/` / `ui/` / `audio/` split. All touch logic is UI-side;
the three pieces with real rules (joystick math, tap guard, view scale) are pure modules testable in
jsc without a browser.

## Hardest behavior and first evidence

**Hardest behavior to get right**: a finger that is steering when the level-up screen appears must
never select an upgrade, while real taps a moment later must work instantly — on both iOS Safari and
Android Chrome, with their different click-synthesis rules.

**First evidence we'll check**: U4 (pure guard timing) and T4 in headless Chrome with trusted
`Input.dispatchTouchEvent` touches: hold a finger, force a level-up, lift over a choice → nothing
chosen; tap at 300 ms → ignored; tap at 600 ms → chosen. Then H1 on both real phones.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 0 · Scope | Constitution amendment (platform) — **done** (v2.0.0, 2026-11-19) | Amendment recorded ✅ |
| 1 · Engine + pure modules | Analog input; `joystickStep`, tap guard, `viewScale` | U1–U5 pass; all existing tests pass |
| 2 · Steering | Pointer steering, joystick visual, touch mode, page lock, CDP driver | T1, T2, T5, T11 |
| 3 · Buttons and guard | Pause/Sound buttons, title reminder, tap guard | T3, T4 |
| 4 · Fit | Safe areas, compact HUD, view scale, rotation, pagehide | T6, T7, T8, T10 |
| 5 · Performance | Adaptive quality | T9; H4 on phones |
| 6 · Package | 001 contract + T074, README, real-device and playtest records | README rows complete (H rows pass / not run) |

## Verification and reporting

- Automated: `node tests/run.mjs` / `jsc -m tests/run.mjs`, and `/tests/` in a browser.
- Scripted browser: `python3 tests/browser/drive.py` (desktop + touch), `--only touch`.
- Real devices: H1–H6 on the current iPhone and Android phone, recorded honestly; older-phone
  performance stays "not verified" (clarification Q4).

## Scope controls

Out of scope (spec Non-Goals): gamepad, native/installable app, offline mode, forced fullscreen or
orientation lock, haptics, touch-specific gameplay, persistence, new content. If time runs short, ship
slices 1–3 (steering, buttons, guard) with the page lock, and record fit polish and adaptive quality as
not delivered rather than shipping untested layout code.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| Constitution amendment (platform) — done, v2.0.0 | The v1.0.1 First Release Scope named only desktop browsers | Implementing mobile without amending would silently exceed the agreed scope (Governance) |
| DevTools Protocol client in tests | Trusted touch input, device emulation, CPU throttling | Synthetic in-page events are untrusted: they cannot prove no-scroll/zoom or the tap guard |
