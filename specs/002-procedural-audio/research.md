# Research: Procedural Audio

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Builds on feature 001's architecture: a pure, deterministic engine (`engine/`) that reports what
happened each step through `run.events`, and a UI layer (`ui/`, `main.js`) that reacts to those
events. Audio is a new consumer of the same events.

## A1 · Sound generation: Web Audio API synthesis

- **Decision**: Generate every sound with the browser's built-in Web Audio API — oscillators (sine,
  square, sawtooth, triangle), a short white-noise buffer created in code, gain envelopes, and
  simple filters. No audio files, samples, or libraries.
- **Rationale**: Meets FR-016 and constitution C1/C5 (original, self-contained, nothing downloaded).
  Minimal techno (kick, hats, clap, bass) and short game blips are classic synthesis targets.
- **Alternatives considered**: Recorded samples (files, licensing, C1 risk); a synth library such as
  Tone.js (a dependency, and far more than this needs); `<audio>` elements (need files).

## A2 · Where audio lives: outside the engine

- **Decision**: New `audio/` folder beside `engine/` and `ui/`. The engine only gains two new
  **events** (`fire`, `pickup`) — no new state, no randomness, no timing. Audio reads `run.events`
  each frame, exactly like the renderer.
- **Rationale**: Keeps the engine pure and deterministic (FR-017, C5): events are not part of the
  state hash, so the same seed and inputs give the same run whether sound is on, muted, or
  unavailable. Existing determinism tests keep guarding this.
- **Alternatives considered**: Calling audio from inside the engine (breaks purity and testability);
  inferring "fired" and "collected" from state changes in the UI (fragile).

## A3 · Starting sound: on the Start click

- **Decision**: Create the audio context inside the Start button's click handler (and on New Run /
  Replay Seed if it does not exist yet). Before that, nothing exists to make sound (FR-010). If
  creation or `resume()` fails, mark audio "unavailable" and carry on silently (FR-020).
- **Rationale**: Browsers only allow audio after a user gesture; the Start click is that gesture.
- **Alternatives considered**: Creating the context at page load (blocked/suspended by autoplay rules,
  and would break "no sound before Start").

## A4 · Mixing: three gain stages

- **Decision**: `effects gain → master`, `music gain → duck gain → master`, `master → speakers`.
  Mute sets master to 0; volumes set the effects and music gains (0–100% → 0–1, squared for a more
  natural loudness curve); ducking sets the duck gain to the data's `duckFactor` (0.5). Gain changes
  use a 20 ms ramp to avoid clicks. Mute takes effect within one ramp (≤ 0.1 s, SC-002).
- **Rationale**: Each control (FR-008, FR-011–FR-013) maps to exactly one gain node.
- **Alternatives considered**: Per-sound volume math (error-prone, cannot duck playing notes).

## A5 · Music timing: look-ahead scheduler

- **Decision**: A 16-step sequencer. A timer runs every 25 ms and schedules all steps falling in the
  next 120 ms on the audio clock. Tempo and active layers are read at the start of each bar, so
  changes land on the beat and the loop never gaps (FR-005).
- **Rationale**: The standard pattern for glitch-free browser sequencing; JavaScript timers alone
  drift, while the audio clock is sample-accurate.
- **Alternatives considered**: Scheduling from `requestAnimationFrame` (stops when the tab is hidden,
  jittery); pre-rendering a loop (cannot change tempo smoothly).

## A6 · Tempo and intensity curve

- **Decision**: Tempo rises linearly from `bpmStart` (118) at level 1 to `bpmEnd` (156) at level 20 —
  +32%, never decreasing (FR-006). Layers join at the enemy debut levels: kick + bass at 1, closed
  hats at 4, clap at 8, open hat + percussion at 12, a filtered synth stab at 16 (FR-007).
- **Rationale**: A minimal techno pulse (clarification Q1) builds tension mainly through tempo and
  added percussion, not melody. Tying layers to debut levels makes each new threat audible.
- **Alternatives considered**: Tempo steps only at debut levels (spec requires change every level to
  be non-decreasing only, but a steady climb feels better); key changes (too melodic for the style).

## A7 · Effect limiting

- **Decision**: A pure "audio director" module turns each frame's events into at most one request per
  sound type, enforces each type's `minIntervalMs` (60 ms for fire, hit, defeat, pickup), caps
  simultaneous effects at `maxConcurrentEffects` (8), and drops — never queues — the rest (FR-003).
  Several `level-up` events in one frame → one sound (FR-004).
- **Rationale**: 300 enemies can produce hundreds of hit events a second; limiting keeps the mix clean
  and CPU low (SC-005). Being pure, it is unit-testable in Node/jsc without a browser.
- **Alternatives considered**: Limiting inside the mixer (untestable without audio hardware).

## A8 · Sound data and validation

- **Decision**: All sound design in a new `data/audio.json` (effects, music layers and patterns,
  tempos, defaults, mix). A pure validator (`audio/content.js`) checks it before Start, including a
  cross-check that a music layer joins at every enemy debut level from `data/game.json`. Errors use
  the existing error screen (FR-018, C6).
- **Rationale**: Keeps gameplay data and sound data reviewable separately; both are still validated
  before play, and sound can be tuned by editing data.
- **Alternatives considered**: An `audio` section inside `data/game.json` (mixes concerns; the engine
  validator would grow sound rules it never uses).

## A9 · Session-only settings

- **Decision**: Mute and volumes live in `main.js` state for the page session and are passed to each
  new run's audio; nothing is written to storage (FR-014, feature 001 non-goal "no persistence").
- **Alternatives considered**: `localStorage` (explicitly out of scope).

## A10 · Verifying sound without ears

- **Decision**: The audio layer counts what it plays (per sound type), and exposes context state,
  mute, volumes, current tempo, and active layers through the existing read-only debug handle.
  Headless Chrome (with `--autoplay-policy=no-user-gesture-required`) checks: nothing before Start,
  sound running after Start, M toggles, sliders change gains, tempo/layers follow difficulty, and
  frame rate with 300 enemies. Distinctness and pleasantness (SC-003, SC-008) need human listeners
  and are recorded as such.
- **Rationale**: Constitution C7 — automated evidence where possible, honest "not run" otherwise.
