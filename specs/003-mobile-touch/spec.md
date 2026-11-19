# Feature Specification: Mobile and Touch Play

**Feature Branch**: `003-mobile-touch`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Make Uptime Survivors playable on phones and tablets with touch
controls. Lift feature 001's non-goal "No mobile/touch controls" (gamepad stays out of scope) and
add a note to 001's spec. Touch movement (floating virtual joystick: touch anywhere and drag to
steer), on-screen pause and mute buttons, tappable level-up/start/end screens, layout that works in
portrait and landscape on small screens with notches/safe areas, no page scroll/zoom/pull-to-refresh
during play, acceptable performance on a mid-range phone, and sound that starts on the Start tap.
Keyboard play on desktop must keep working unchanged. The game is already published on the web via
GitHub Pages, which is how players reach it on mobile."

## Overview

Uptime Survivors (features 001 and 002) is played in a desktop browser with a keyboard. It is already
published on the web, so phone and tablet players can open it, but they cannot steer, pause, or
mute. This feature makes a full run playable with touch alone: the player touches anywhere on the
play field and drags to steer the engineer, and uses on-screen buttons for pause and mute. Every
screen fits and works on small touch screens in portrait and landscape, and the browser page never
scrolls, zooms, or refreshes by accident during play.

The game itself does not change: same enemies, tools, difficulty, sound, and determinism (constitution
C5). Desktop keyboard play keeps working exactly as before.

This feature lifts feature 001's non-goal "No mobile/touch controls or gamepad support" for touch
only; gamepad support remains out of scope. All other non-goals of features 001 and 002 still apply.

## Clarifications

### Session 2026-11-19

- Q: How far should a player on a portrait phone be able to see around the engineer? → A: At least
  330 game units in every direction (half the desktop view distance). The screen's short side sets
  this, so phones draw about 40% smaller in either orientation; desktop is unchanged. *(Wording
  corrected during planning: the original note said landscape was barely affected, which is only
  true for screens at least 660 CSS px tall.)*
- Q: Should touch steering always move at full speed, or slower for a short drag? → A: Always full
  speed once the drag passes the dead zone; the drag sets direction only (matches the keyboard).
- Q: When should the on-screen buttons and touch controls reminder appear? → A: From the start on
  devices whose main input is touch (phones, tablets), and on any other device as soon as it is
  touched; mouse-and-keyboard devices never show them.
- Q: Which real phones will confirm touch feel and performance? → A: One current iPhone (Safari) and
  one current Android phone (Chrome); no older device is available, so the mid-range target is checked
  with a slowed-down scripted check instead.
- Q: What delays should touch players get around the pause and level-up screens? → A: Nothing on
  either screen can be selected until every finger that was on the screen when it opened has been
  lifted, and not until 500 ms after it opened; a selection needs a new tap. No resume countdown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Steer with a thumb (Priority: P1)

A player opens the game on a phone, taps Start, and steers the engineer by touching anywhere on the
play field and dragging; a joystick appears where the finger landed. Lifting the finger stops the
engineer. Tools keep firing on their own, so one thumb is enough to play a whole run.

**Why this priority**: Without touch movement the game cannot be played on a phone at all; this is
the core of the feature.

**Independent Test**: On a phone, start a run and play for two minutes using only one finger: the
engineer goes where the finger drags, stops on release, and the run behaves as it does on desktop.

**Acceptance Scenarios**:

1. **Given** a run in progress on a touch screen, **When** the player touches the play field,
   **Then** a joystick appears centred on the touch point and the engineer does not move yet.
2. **Given** the joystick is shown, **When** the player drags beyond a small dead zone, **Then** the
   engineer moves at full speed in the drag direction (any angle, not only 8 directions), and turns
   as the finger moves.
3. **Given** the player is steering, **When** the finger lifts (or the touch is cancelled by the
   system), **Then** the engineer stops and the joystick disappears.
4. **Given** the finger is dragged far from where it landed, **When** it passes the joystick's edge,
   **Then** steering continues in that direction (the joystick follows or clamps), and never stops
   the engineer unexpectedly.
5. **Given** a second finger touches the screen while steering, **When** that happens, **Then** it
   does not change steering; only the first finger steers.
6. **Given** the same seed and the same sequence of movement directions, **When** a run is played
   with touch or with keys, **Then** the outcome is identical (determinism is unaffected by the
   input device).

---

### User Story 2 - Every screen works by tap (Priority: P1)

A player can do everything without a keyboard: start a run, choose level-up upgrades, pause and
resume, mute and unmute, change volumes on the pause screen, quit to the title, and start a new run
or replay the seed from the end screen.

**Why this priority**: The keyboard-only actions (pause, mute, number keys) would otherwise leave a
touch player stuck or unable to silence the game.

**Independent Test**: On a phone, complete a run from the title to the end screen and start another
run, using only taps; pause, mute, change both volumes, and choose at least 3 upgrades along the way.

**Acceptance Scenarios**:

1. **Given** the title screen on a touch device, **When** it is shown, **Then** the controls
   reminder describes touch controls (drag to steer, pause and sound buttons) instead of only keys.
2. **Given** a run in progress on a touch device, **When** it is shown, **Then** a pause button and
   a sound (mute) button are visible, do not cover the engineer, and each responds to a single tap.
3. **Given** the level-up or pause screen opens while a finger is on the screen, **When** that finger
   stays down, moves, or lifts over a button, **Then** nothing is selected; the finger must be lifted
   first, and only a new tap at least 500 ms after the screen opened selects a choice or button.
4. **Given** the pause screen, **When** the player uses the sound button and the Music and Effects
   controls by touch, **Then** they work as with a mouse (feature 002).
5. **Given** the end screen, **When** the player taps New Run or Replay Seed, **Then** the next run
   starts, with sound if sound was on.

---

### User Story 3 - Fits the screen and stays put (Priority: P1)

The game fills a phone or tablet screen in portrait or landscape, keeps the HUD and buttons clear of
notches, rounded corners, and system bars, and the page never scrolls, zooms, bounces, or reloads
while playing. Rotating the device mid-run re-fits the game without losing the run.

**Why this priority**: Accidental page scrolling, zooming, or pull-to-refresh would end or ruin runs
on a phone even with working controls.

**Independent Test**: On a phone, play for five minutes with vigorous dragging, double taps, and
swipes from the edges, in portrait, then rotate to landscape; nothing scrolls, zooms, or reloads,
the run continues, and every HUD element stays readable and uncovered.

**Acceptance Scenarios**:

1. **Given** a phone in portrait or landscape, **When** any screen is shown, **Then** all of its
   content and buttons are visible and usable without scrolling or zooming.
2. **Given** a device with a notch or rounded corners, **When** the HUD and buttons are shown,
   **Then** none of them is hidden behind the notch, corners, or system bars.
3. **Given** a run in progress, **When** the player drags, double-taps, pinches, or pulls down from
   the top of the play field, **Then** the page does not scroll, zoom, bounce, select text, show a
   context menu, or refresh.
4. **Given** a run in progress, **When** the device is rotated, **Then** the game re-fits the new
   orientation within 1 second and the run continues (paused or playing as before).
5. **Given** any supported screen and orientation, **When** a run is in progress, **Then** the player
   can see approaching problems from every side early enough to react: the view shows at least
   330 game units around the engineer in every direction (half the desktop view distance).
6. **Given** the app is switched away from, the screen locks, or a call comes in, **When** that
   happens, **Then** the game pauses and sound goes silent, as on desktop when the tab loses focus.

---

### User Story 4 - Plays smoothly on a mid-range phone (Priority: P2)

A full run, including the crowded late levels, stays smooth enough to steer accurately on a
mid-range phone, and the phone does not overheat or drain noticeably faster than a typical game.

**Why this priority**: The game works without this, but stutter in the late game makes runs unfair;
it can be tuned after the controls work.

**Independent Test**: On a mid-range phone, play a fast run (`levelSeconds` test setting) through
level 20 and a few normal minutes; measure frame pacing with 150 and 300 problems on screen.

**Acceptance Scenarios**:

1. **Given** a mid-range phone with 150 problems on screen, **When** playing, **Then** motion looks
   smooth (see SC-004).
2. **Given** a mid-range phone with 300 problems on screen, **When** playing, **Then** the game stays
   playable without freezes (see SC-004).
3. **Given** a device that cannot keep up, **When** frame rate drops, **Then** visual effects are
   reduced before gameplay suffers, and the game rules still run at their fixed rate (the run's
   outcome does not depend on device speed).

---

### Edge Cases

- **Touch and keyboard on one device** (tablet with keyboard, touchscreen laptop): both work and can
  be mixed. A touchscreen laptop looks like desktop until its screen is first touched, then shows
  touch mode for the rest of the page session.
- **Touch starts on a button** (pause, sound, a level-up choice): it acts as that button and does not
  start steering.
- **Touch starts on the HUD**: it still steers, so the HUD never blocks movement (except the buttons).
- **Finger slides off the screen edge**: steering continues while the touch is held; ends on release
  or cancel.
- **Very small screens** (narrower than 360 px in portrait): best effort; the game may show a "rotate
  your device" hint rather than an unusable layout.
- **Very large touch screens** (tablets): the layout scales up; buttons stay at a comfortable size
  rather than becoming huge.
- **Sound on iPhone with the silent switch on**: the browser may keep game audio silent; the game
  cannot detect this, so the sound control still shows its own state. Documented as a known limit.
- **Long press**: does not open a context menu, select text, or show a magnifier.
- **Reduced motion preference**: unchanged from feature 001.
- **Browser zoom or text-size settings**: the game layout still fits and stays usable.

## Requirements *(mandatory)*

### Functional Requirements

**Touch steering**

- **FR-001**: On a touch device, touching the play field during a run MUST show a joystick centred on
  the touch point; dragging MUST steer the engineer in the drag direction at any angle.
- **FR-002**: Dragging less than a small dead zone (about 10% of the joystick's radius) MUST NOT
  move the engineer; beyond it the engineer MUST move at full speed in the drag direction. Drag
  distance sets direction only, never speed (no slow walking), matching keyboard movement.
- **FR-003**: Lifting or cancelling the steering touch MUST stop the engineer and hide the joystick.
- **FR-004**: Only the first touch MUST steer; other simultaneous touches MUST NOT change steering.
- **FR-005**: Touch steering MUST feed the game the same kind of movement input as the keyboard, so
  that runs stay deterministic for a given seed and input sequence (constitution C5).

**On-screen controls**

- **FR-006**: During a run on a touch device, on-screen Pause and Sound (mute) buttons MUST be shown,
  each at least 44 × 44 CSS pixels, placed clear of the engineer and of safe-area insets.
- **FR-007**: Every action that needs a key on desktop MUST be possible by tap: start, choose a
  level-up upgrade, pause, resume, mute/unmute, change Music and Effects volume, quit to title, new
  run, and replay seed.
- **FR-008**: On the level-up and pause screens, touch selections MUST be accepted only when (a) every
  touch that was on the screen when the screen opened has been lifted, and (b) at least 500 ms have
  passed since the screen opened; the selection MUST come from a new tap that starts after both
  conditions hold. Play resumes immediately after a choice or Resume (no countdown). Keyboard and
  mouse selection on desktop is unchanged.
- **FR-009**: On touch devices, the title screen's controls reminder MUST describe touch controls.
- **FR-010**: All tappable controls MUST have a touch target of at least 44 × 44 CSS pixels.

**Layout and page behaviour**

- **FR-011**: Every screen MUST fit without scrolling or zooming in portrait and landscape on screens
  from 360 × 640 CSS pixels up to large tablets.
- **FR-012**: HUD elements and buttons MUST stay inside the screen's safe area (clear of notches,
  rounded corners, and system bars).
- **FR-013**: During play, dragging, double-tapping, pinching, long-pressing, and pulling down MUST
  NOT scroll, zoom, bounce, select text, open a context menu, or refresh the page.
- **FR-014**: When the device rotates or the window resizes, the game MUST re-fit within 1 second and
  the run MUST continue in the same state.
- **FR-015**: On every supported screen and orientation, the play view MUST show at least 330 game
  units from the engineer in every direction (half the desktop view distance); on desktop, where the
  view already exceeds this, it MUST be unchanged.
- **FR-016**: When the game is hidden (app switch, screen lock, incoming call), it MUST pause and
  silence sound, as on desktop.

**Performance**

- **FR-017**: On a mid-range phone, the game MUST meet SC-004; if the device cannot keep up, visual
  effects (glow, particles) MUST be reduced automatically before gameplay smoothness suffers.
- **FR-018**: Game rules MUST keep running at their fixed rate regardless of device speed, so a run's
  outcome never depends on the device (constitution C5; already true in feature 001).

**Sound and compatibility**

- **FR-019**: Sound MUST start on the Start tap on touch devices, under the same rules as feature 002
  (no sound before Start; M key and sound button share one mute setting).
- **FR-020**: Desktop keyboard and mouse play MUST be unchanged: all feature 001 and 002 checks MUST
  still pass. Touch mode (on-screen Pause and Sound buttons, touch controls reminder) MUST be on from
  page load on devices whose main input is touch, and MUST switch on for any other device at its first
  touch; a device that is never touched MUST NOT show the joystick or touch-only buttons.
- **FR-021**: No information MUST depend on hovering; every control MUST work without a mouse.

### Non-Goals

- No gamepad or controller support (still a non-goal from feature 001).
- No native app, app-store release, installable home-screen app, or offline mode.
- No forced fullscreen or orientation lock (players may choose either orientation).
- No haptics / vibration.
- No touch-specific gameplay changes (no tap-to-aim, no auto-move); tools still fire on their own.
- No persistence of settings (feature 001 non-goal still applies).
- No new content, enemies, tools, or difficulty changes.

### Key Entities

- **Touch Steering State**: whether a steering touch is active, where it began (joystick centre), the
  current drag offset, and the resulting movement direction.
- **On-screen Controls**: the Pause and Sound buttons shown during a run on touch devices.
- **Screen Fit**: current orientation, usable area after safe-area insets, and the view distance
  around the engineer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a phone, a first-time player starts a run within 2 taps of the page loading, and the
  game is fully playable with touch alone from title to end screen.
- **SC-002**: The engineer starts moving within 100 ms of a drag past the dead zone and stops within
  100 ms of the finger lifting.
- **SC-003**: During a 5-minute session of vigorous play, the page scrolls, zooms, refreshes, or
  shows a browser menu 0 times.
- **SC-004**: On the current iPhone (Safari) and current Android phone (Chrome) used for testing, the
  game averages at least 55 frames per second with 300 problems on screen, with no freeze longer than
  0.25 seconds. In a scripted check that slows the processor to roughly a mid-range phone (4× slower
  than the test machine), it averages at least 50 frames per second with 150 problems and at least
  30 with 300.
- **SC-005**: On screens of 360 × 640 CSS pixels and larger, in both orientations, 100% of screens
  show all their content and controls with nothing hidden behind a notch, corner, or system bar.
- **SC-006**: All existing desktop checks from features 001 and 002 pass unchanged.
- **SC-007**: The same seed and movement sequence produce identical runs whether entered by touch or
  keys (100% of determinism test repeats).
- **SC-008**: At least 3 of 5 playtesters using their own phones finish their first run without
  instructions and rate the touch controls as comfortable; none trigger an accidental upgrade choice or pause-menu action.

## Assumptions

- The game is already published on GitHub Pages, which is how mobile players reach it; no hosting
  work is needed. (Feature 001 task T074 and its README note should be updated to say so.)
- Real-device testing uses one current iPhone (Safari) and one current Android phone (Chrome). No
  older phone is available, so "mid-range" performance is approximated by a scripted check with the
  processor slowed 4×; results on actual older phones remain unverified and are recorded as such.
  Frame-rate targets (SC-004) are starting values.
- The minimum view distance (330 game units around the engineer, FR-015) keeps the late game fair on
  a portrait phone; on desktop the view is unchanged.
- Scripted checks can simulate phone screens and touch input in a desktop browser; feel and
  real-device performance are confirmed on the two test phones.
- This feature amends feature 001's non-goal "No mobile/touch controls or gamepad support" (touch only);
  feature 001's spec notes that touch controls are delivered by feature 003.
