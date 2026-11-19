# Implementation Plan: Procedural Audio — Sound Effects and Music

**Branch**: `002-audio` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-procedural-audio/spec.md`

## Summary

Add 10 synthesized sound effects and a looping minimal-techno music track whose tempo and layers rise
with difficulty, plus mute (M) and separate music/effects volume on the pause screen. All sound is
generated at run time with the browser's built-in Web Audio API — no files, no libraries. Audio is a
new consumer of the engine's existing per-step events; the engine gains only two event types
(`fire`, `pickup`) and stays deterministic. Sound design lives in a new validated `data/audio.json`.
Decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3 — as feature 001

**Primary Dependencies**: None. Browser built-ins only (Web Audio API added to feature 001's Canvas 2D, `fetch`, `requestAnimationFrame`)

**Storage**: N/A. `data/audio.json` is read-only content; audio settings are in memory for the page session

**Testing**: Feature 001's dependency-free harness (`tests/run.mjs`, `tests/index.html`) plus scripted headless Chrome checks (`tests/browser/drive.py`)

**Target Platform**: Current desktop browsers with keyboard and speakers/headphones

**Project Type**: Static single-page browser game (extension of feature 001)

**Performance Goals**: No regression of feature 001 SC-005 (smooth at 300 enemies) with sound on; ≤ 8 simultaneous effects; music scheduling gap-free

**Constraints**: No audio files or downloads; engine stays free of browser APIs and nondeterminism; no sound before the first Start; settings not persisted

**Scale/Scope**: 10 effects, 7 music layers, 1 track, 3 controls; about 4 new source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan meets it | Pre | Post |
|-----------|-------------|------------------------|-----|------|
| C1 · Fun survivors-like, networking theme, original | Original assets | Every sound is synthesized from code and data; no third-party audio. Adds feedback and tension to the core loop. | ✅ | ✅ |
| C5 · Deterministic, self-contained | Static files only; seeded engine | Web Audio is built in; nothing downloaded. Engine only adds events (not hashed); audio lives outside `engine/`; determinism test re-run with sound-related events. | ✅ | ✅ |
| C6 · Content and logic reviewable separately | Data in files, validated before play | All sound design in `data/audio.json`, validated (with a cross-check against `data/game.json`) before Start; event→sound decisions in a pure, tested director module separate from synthesis. | ✅ | ✅ |
| C7 · Done is demonstrated | Evidence recorded; unrun checks visible | Unit tests A1–A6, scripted browser checks B1–B8, human checks H1–H3 recorded in the README with pass / fail / not run. | ✅ | ✅ |
| First Release Scope | Agreed scope; amendments explicit | The constitution's out-of-scope list does not include audio, so no amendment is needed. Feature 001's spec listed "No audio" as a non-goal; this feature lifts it, and a task adds a note to feature 001's spec. | ✅ | ✅ |

**Gate result: PASS.** No violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-procedural-audio/
├── plan.md              # This file
├── research.md          # Phase 0: decisions A1–A10
├── data-model.md        # Phase 1: sound data, settings, state, event→sound mapping
├── quickstart.md        # Phase 1: validation scenarios A1–A6, B1–B8, H1–H3
├── contracts/
│   ├── audio-data.md    # data/audio.json shape and validation output
│   ├── audio-api.md     # audio modules + engine event additions
│   └── ui-controls.md   # M key, HUD indicator, pause-screen controls
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
audio/                   NEW
  content.js             validateAudioData(raw, gameData) — pure
  director.js            events → effect requests, rate limiting, tempo/layer curve — pure
  synth.js               Web Audio: context, gain chain, voices, effects, music sequencer

data/
  audio.json             NEW — all sound design (contracts/audio-data.md)

engine/                  CHANGED (events only)
  weapons.js             emit `fire` once per projectile volley
  combat.js              emit `pickup` on collection

ui/                      CHANGED
  input.js               M key callback
  screens.js             title reminder; pause-screen Sound toggle + Music/Effects sliders
  hud.js                 sound indicator

index.html               HUD sound indicator element
main.js                  load + validate audio.json; create audio on Start; per-frame director wiring;
                         ducking; suspend/resume on hide/blur; session settings; debug handle stats

tests/
  audio-content.test.js  NEW — A1
  audio-director.test.js NEW — A2–A4
  determinism.test.js    CHANGED — A5 (events present, director does not mutate run)
  files.js               register new test files
  browser/smoke-audio.html  NEW — B1–B8 (headless Chrome)
  browser/drive.py       CHANGED — add audio page and autoplay flag

specs/001-survivors-first-playable/spec.md      note: "No audio" non-goal lifted by feature 002
specs/001-survivors-first-playable/contracts/engine-api.md   add `fire`, `pickup` events
README.md                controls (M), sound section, verification rows A/B/H
```

**Structure Decision**: Audio gets its own top-level `audio/` folder, parallel to `engine/` and `ui/`,
so the two pure modules (`content.js`, `director.js`) can be unit-tested outside a browser while all
Web Audio code is isolated in `synth.js`.

## Hardest behavior and first evidence

**Hardest behavior to get right**: gap-free music whose tempo and layers change on bar boundaries
while the game pauses, ducks, suspends on tab switches, and restarts on new runs — without ever
affecting gameplay or frame rate.

**First evidence we'll check**: `audio-director.test.js` — a flood of 500 `hit` events over one
simulated second yields at most one `hit` per 60 ms and never more than 8 concurrent effects; and
the tempo curve is non-decreasing with +30% or more at level 20.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
|-------|-------------|--------------------------------|
| 1 · Data and decisions | `data/audio.json`, `audio/content.js`, `audio/director.js`, engine `fire`/`pickup` events | A1–A5 pass in terminal and browser runners |
| 2 · Effects | `audio/synth.js` effects path, Start-gesture start, mute (M), HUD indicator, wiring in `main.js` | B1–B3, B6 |
| 3 · Music | Sequencer, tempo/layer curve, ducking, stop on end, restart on new run, suspend/resume | B4 (ducking), B5 |
| 4 · Controls and polish | Pause-screen sliders, title reminder, accessibility announcements, tuning by ear | B4, B7, B8; H1–H3 recorded (or "not run") |
| 5 · Package | Feature 001 spec note, engine contract update, README | README verification rows complete |

## Verification and reporting

- Automated: `node tests/run.mjs` / `jsc -m tests/run.mjs` and `/tests/` in a browser.
- Scripted browser: `python3 tests/browser/drive.py` (adds the audio page; launches Chrome with
  `--autoplay-policy=no-user-gesture-required` only for that page).
- Human listening (H1–H3) recorded honestly as pass / fail / not run.

## Scope controls

Out of scope (spec Non-Goals): audio files or samples, persistence of settings, per-tool/per-enemy
unique sounds beyond the 10 events, multiple tracks or a sound test menu, positional audio, and audio
settings on the title screen beyond M. If time runs short, ship slices 1–2 (effects + mute) and record
music as not delivered rather than shipping an untested sequencer.

## Complexity Tracking

No constitution violations to justify.
