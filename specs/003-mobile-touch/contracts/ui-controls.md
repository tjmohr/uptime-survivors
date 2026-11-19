# Contract: Touch Controls, Screens, and Layout (additions to features 001 and 002)

## Touch mode

On from load on devices whose main pointer is coarse (phones, tablets); switched on at the first touch
on any other device; stays on for the page session (clarification Q3). Off → the page looks and
behaves exactly as in features 001–002 (FR-020).

## On-screen controls (touch mode, during a run)

| Control | Placement | Action |
|---------|-----------|--------|
| **Pause** (`#touch-pause`, "❚❚") | Top-right, below the HUD's top row, inside the safe area | Same as Esc/P: pause, or resume when paused |
| **Sound** (`#touch-sound`, "♪" / "♪̸") | Next to Pause | Same as M: toggle mute; label reflects state; `aria-pressed` |
| **Joystick** (`#joystick`) | Where the steering finger landed | Visual only: outer ring (radius 56 px) and knob; hidden when not steering; `aria-hidden` |

Each button is at least 44 × 44 CSS px (FR-006, FR-010) and has an accessible name.

## Screens

| Screen | Change in touch mode |
|--------|---------------------|
| Title | Controls reminder: "Steer: touch and drag anywhere", "Pause: ❚❚ button", "Sound: ♪ button" (FR-009). Keyboard lines kept on non-touch devices. |
| Level-up | Choices guarded (below). Number keys unchanged. |
| Paused | Buttons and sliders guarded (below); sliders usable by touch (feature 002 FR-013). |
| End | New Run / Replay Seed by tap (no guard needed). |

## Tap guard (FR-008, clarification Q5)

On the level-up and pause screens, a **touch** selection is accepted only from a new tap whose
`pointerdown` happens after (a) every touch that was down when the screen opened has lifted and (b)
500 ms have passed since it opened. Other touch taps do nothing. Play resumes immediately after a
choice or Resume. Mouse, pen, and keyboard are not affected.

## Page behaviour (FR-011–FR-014)

- No page scroll, rubber-band bounce, pull-to-refresh, pinch or double-tap zoom, text selection,
  long-press menu, or tap highlight during play.
- Every screen fits 360 × 640 CSS px and larger in both orientations without scrolling; HUD and
  buttons stay inside safe-area insets; below 600 px width the HUD uses a compact layout.
- Rotation / resize re-fits within 1 s; the run's phase is unchanged.
- Narrower than 360 px in portrait: a "Rotate your device for more room" hint may show; the game
  still runs.

## View (FR-015)

The play view shows at least 330 game units from the engineer to every screen edge. Desktop view
unchanged.

## Hidden page (FR-016)

`visibilitychange` (hidden), `blur`, and `pagehide` pause the run and suspend sound, as in features
001–002.
