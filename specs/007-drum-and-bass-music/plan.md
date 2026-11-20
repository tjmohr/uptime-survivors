# Implementation Plan: Drum & Bass Soundtrack

**Branch**: `007-drum-and-bass-music` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-drum-and-bass-music/spec.md`

## Summary

Replace feature 002's single minimal-techno track (tempo 118 → 156 BPM, layers joining at debut
levels) with five original drum & bass songs at a fixed 174 BPM — Liquid, Jump-up, Neurofunk, Jungle,
Dancefloor — generated in the browser. A run is cut into five 4-level blocks; each block plays one song
from a seed-derived shuffle (no repeats). Each song builds through four stages, follows a 32-bar cycle
with fills on bars 8/16/24 and a breakdown on bars 29–32, and hands over to the next song with a 2-bar
equal-power crossfade and a DJ-style bass swap.

Technical approach: a new pure module `audio/arrange.js` makes every musical decision (order, stage,
phrase cycle, which hits sound, crossfade gains) and is unit-tested in jsc; `audio/synth.js` keeps the
Web Audio graph, gains per-song `mainBus`/`bassBus` buses, and a slightly extended Voice (unison/detune,
filter sweep and Q, tempo-synced LFO, drive). Song content lives in `data/audio.json` (schemaVersion 2)
and is validated with song/part-named errors. A preview page supports the local listening checks.

## Technical Context

**Language/Version**: JavaScript (ES2020 modules), HTML, CSS — unchanged

**Primary Dependencies**: none; Web Audio API (OscillatorNode, BiquadFilterNode, GainNode,
WaveShaperNode, AudioBufferSourceNode) — all already used or standard

**Storage**: N/A (static `data/audio.json`; audio settings remain page-session only)

**Testing**: jsc unit runner (`tests/run.mjs`), headless-Chrome browser checks (`tests/browser/drive.py`),
human listening checks via `tests/music-preview.html`

**Target Platform**: desktop and mobile browsers (Chrome tested; others untested as before)

**Project Type**: static single-page web game

**Performance Goals**: no measurable frame-rate drop vs. feature 002 (existing B7 / T9 limits: desktop
avg < 20 ms and p95 < 34 ms; 4× throttled phone ≥ 50 fps at ~150 enemies and ≥ 30 fps at ~300); audio scheduling keeps a 174 BPM grid with
no drift (research M2, M10)

**Constraints**: no audio files; original compositions (C1); song order must not consume `run.rng` (C5);
all music values in validated data (C6); ≤ 2 songs live at once; ≤ 14 parts per song (research M11)

**Scale/Scope**: 5 songs × 4–14 parts, patterns ≤ 8 bars; ~1 new module, 3 changed audio modules, data
rewrite of `music`, 1 preview page, test updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| **C1** Fun survivors-like, networking theme, original assets | Music stays original (written for this project, no samples, breakbeats from original patterns — research M7/M8); song titles are network-themed; gameplay unaffected | PASS |
| **C5** Deterministic, self-contained | Song order uses its own generator seeded from the run seed, never `run.rng` (M3); no network requests or audio files; unit test M-U9 + existing determinism tests | PASS |
| **C6** Content and logic separate, validated | All songs, patterns, stages, grid constants in `data/audio.json`; `validateAudioData` rejects bad music naming song/part (M12); arrangement rules in a pure module tested without rendering (M1) | PASS |
| **C7** Done is demonstrated | quickstart.md lists scripted (M-U*, B5/B9/B10) and human (M-H1–M-H6) checks; results recorded as pass/fail/not run; superseded 002/004 requirements annotated | PASS |
| **First Release Scope** | No new mechanic, platform or persistence; audio content change within the existing sound feature; desktop + mobile browsers unchanged | PASS |

**Post-design re-check (after Phase 1)**: PASS — the data model keeps every number in data, the arranger
is pure, the preview page is a test asset not linked from the game, and nothing reads `run.rng`.

## Project Structure

### Documentation (this feature)

```text
specs/007-drum-and-bass-music/
├── plan.md              # This file
├── research.md          # Phase 0: decisions M1–M14
├── data-model.md        # Phase 1: Music, Song, Part, Voice extensions, runtime state
├── quickstart.md        # Phase 1: unit, browser and listening checks
├── contracts/
│   ├── audio-api.md     # arrange.js (new), synth/director/content changes, preview page
│   └── music-data.md    # audio.json › music (schemaVersion 2) and error examples
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
audio/
├── arrange.js           # NEW — pure: songOrder, block/stage, phrase cycle, hits per step, crossfade gains, arrangement state
├── content.js           # CHANGED — schemaVersion 2, music/song/part validation, extended Voice
├── director.js          # CHANGED — remove bpmForLevel/layersForLevel; rest unchanged
└── synth.js             # CHANGED — fixed-tempo sequencer driven by arrange.js; per-song main/bass buses;
                         #           Voice: unison/detune, filter toHz/q, LFO, drive; skip-late steps; stats().music
data/
└── audio.json           # CHANGED — schemaVersion 2; music = 5 songs (effects unchanged)
main.js                  # CHANGED — audio.startMusic(run.seed)
tests/
├── music.test.js        # NEW — M-U2…M-U7, M-U9
├── audio-content.test.js   # CHANGED — schema 2, M-U1, M-U8
├── audio-director.test.js  # CHANGED — drop bpm/layer tests
├── files.js             # CHANGED — register music.test.js
├── music-preview.html   # NEW — human listening page (M13)
└── browser/
    ├── smoke-audio.html     # CHANGED — B5 rewritten; B9, B10 added; layerCounts → music.partCounts
    └── smoke-incidents.html # unchanged expectations (incidentMusic)
specs/002-procedural-audio/spec.md, contracts/audio-data.md, data-model.md   # "superseded by 007" notes
specs/004-major-incidents/spec.md                                            # incident layer note
README.md                # music section, verification rows M-U*, B9, B10, M-H1–M-H6
```

**Structure Decision**: Keep the existing flat layout (`audio/`, `data/`, `tests/`). The only new
production module is `audio/arrange.js`, mirroring how `engine/` keeps rules pure and the browser layer
thin.

## Implementation Phases (for /speckit-tasks)

1. **Foundation** — data schema 2 + validator (content.js), `arrange.js` pure functions with unit tests,
   remove bpm/layer helpers. One placeholder-quality song is enough to wire everything.
2. **US1 (P1) fixed-tempo groove** — synth sequencer on the 174 BPM grid driven by the arranger, Voice
   extensions, per-song buses, `startMusic(seed)` wiring, stats; existing sound checks still pass.
3. **US2 (P1) song blocks, order, crossfade** — seeded order, block changes, crossfade + bass swap in
   synth, B5/B9/B10.
4. **US3 (P2) build-up + phrase cycle + incident per song** — stages, fills, breakdowns, riser, per-song
   incident part; M-U4/M-U5; incident checks.
5. **US4 (P2) five distinct songs** — write the five songs' data per research M8; preview page; listening
   checks prepared (M-H1–M-H6).
6. **Polish** — performance checks (B7/T9), docs (superseded notes, README), full browser suite, local
   play-test hand-off to the user (no push).

## Complexity Tracking

No constitution violations; nothing to justify.
