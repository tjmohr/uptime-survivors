---
description: "Task list for feature 007 — Drum & Bass Soundtrack"
---

# Tasks: Drum & Bass Soundtrack

**Input**: Design documents from `specs/007-drum-and-bass-music/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The spec's acceptance scenarios and success criteria are checked by the unit
(M-U*) and browser (B*) checks listed in quickstart.md, following this project's practice (C7).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its
own. Work stays on the local `007-drum-and-bass-music` branch; nothing is pushed or merged until the
user has listened locally and asks for it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Test scaffolding and a performance baseline to compare against (SC-008).

- [x] T001 Create `tests/music.test.js` (empty suite using `tests/harness.js`) and register it in `tests/files.js`
- [x] T002 [P] Record the current music performance baseline: run `python3 tests/browser/drive.py --only audio` (B7) and `--only T9`, and write the avg/p95 figures into a "Baseline (feature 002 music)" note at the end of `specs/007-drum-and-bass-music/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema-2 data and validation, the pure arranger's core, and removal of the old tempo/layer
helpers. After this phase the game loads valid schema-2 data (five minimal scaffold songs).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Update `audio/content.js` for schemaVersion 2: export `SONG_STYLES` and `PART_ROLES` (contracts/audio-api.md), reject the old `bpmStart`/`bpmEnd`/`layers` fields as unknown, remove the debut-level cross-check, and validate the Music section per data-model.md › Music.bpm, Music.stepsPerBar, Music.levelsPerSong, Music.crossfadeBars, Music.cycleBars, Music.fillBars, Music.breakdownBars, Music.ghostGain and Music.songs
- [x] T004 Add Song validation to `audio/content.js` per data-model.md › Song.id, Song.name, Song.style, Song.rootHz, Song.bassAudibility, Song.gain, Song.parts, including every song-level rule listed under data-model.md › Song (stage-1 contents incl. noise-only stage-1 risers, later stages add parts, snare or clap on steps 4/12, hats by stage 2, fill at stage 1, exactly one incident part, an 8-bar part, bass loudest, speaker-audible bass, distinct songs, ≥ 3 `speakers` songs); errors use `{path, id: "<songId>"}`
- [x] T005 Add Part validation to `audio/content.js` per data-model.md › Part.id, Part.role, Part.instrument, Part.register, Part.stage, Part.pattern, Part.notes, Part.voice (fill hits only on steps 8–15; notes count equals hit count; music voice duration ≤ 2 bars at `bpm`); errors use `id: "<songId>/<partId>"`
- [x] T006 Extend Voice validation in `audio/content.js` per data-model.md › Voice.unison, Voice.detuneCents, Voice.filter.toHz, Voice.filter.q, Voice.lfo, Voice.drive (optional fields; effect voices keep validating exactly as before when the fields are absent)
- [x] T007 [P] Rewrite `tests/audio-content.test.js` for schemaVersion 2: valid minimal fixture passes; one failing case per row of the error table in contracts/music-data.md with the expected path and song/part id (M-U8); effects validation tests still pass
- [x] T008 Rewrite `data/audio.json` to schemaVersion 2: keep `defaults`, `mix`, `effects` unchanged; set the Music grid constants (bpm 174, fill/breakdown bars, ghostGain 0.35); add five **scaffold** songs (ids, names, styles, roots and bassAudibility from research.md M8) that satisfy every validation rule with minimal parts (kick, snare, hat, sub, upper bass for `speakers` songs, fill, one part each at stages 2–4, incident, one 8-bar part); the full songs come in US4
- [x] T009 Create `audio/arrange.js` (pure, no browser APIs) with `songOrder(seed, songs)` using a dedicated `createRng((seed ^ 0x5eed0174) >>> 0)` from `engine/rng.js` and Fisher–Yates, plus `blockForLevel`, `stageForLevel`, `cycleBarOf` (contracts/audio-api.md, research.md M3/M4)
- [x] T010 Add `partsForBar(song, songBar, stage, incident, music)` (cumulative stages only; phrase-cycle rules come in US3) and `hitsForStep(entries, songBar, step, music)` (`x` → 1, `o` → `ghostGain`, note entry per hit, pattern looping per its own bar count) to `audio/arrange.js` (research.md M6)
- [x] T011 Add `createArrangement(music)` to `audio/arrange.js` with `start(seed, level)`, `queueLevel`, `queueIncident`, `advanceBar()`, `live()`, `state()`: level changes apply on the next bar line; within-block changes update the stage only (block changes are added in US2) (data-model.md › Arrangement state)
- [x] T012 [P] Remove `bpmForLevel` and `layersForLevel` from `audio/director.js` and their tests from `tests/audio-director.test.js`; keep `createDirector`/`consume`/`reset`/`counts` unchanged
- [x] T013 Add M-U1 (shipped data validates, bpm 174, five styles, ≥ 3 `speakers`) and M-U3 (block/stage for levels 1–20; songs change exactly at 5, 9, 13, 17) and M-U9 (no browser globals in `audio/arrange.js`; a seeded run's `hashRun` is identical before and after calling `songOrder`) to `tests/music.test.js`

**Checkpoint**: `jsc -m tests/run.mjs` passes; the game loads without validation errors (music playback is wired in US1).

---

## Phase 3: User Story 1 — A drum & bass groove at a steady 174 BPM (Priority: P1) 🎯 MVP

**Goal**: The run plays drum & bass at a fixed 174 BPM from the arranger's parts; all existing sound
behaviour (mute, volumes, ducking, hidden tab, audio failure, start/stop) is unchanged.

**Independent Test**: `python3 tests/browser/drive.py --only audio` passes with B1–B4, B6–B8 updated;
`stats().music.bpm` is 174 at every level of a shortened-timer run.

### Tests for User Story 1

- [x] T014 [US1] Update `tests/browser/smoke-audio.html` for the new stats shape: replace `layerCounts.kick`/`activeLayers` reads with `music.partCounts`/`music.activeParts` in B1–B4 and B6–B8, and assert `music.bpm === 174` in B1/B2 (FR-001, FR-015)

### Implementation for User Story 1

- [x] T015 [US1] Extend `playVoice` in `audio/synth.js` for the new Voice fields: `unison`/`detuneCents` (stacked detuned oscillators), `filter.toHz` sweep and `filter.q`, tempo-synced `lfo` (OscillatorNode at `bpm/60*4/steps` Hz into a GainNode on the filter frequency or the envelope gain), `drive` (WaveShaperNode with a cached curve per drive value); fields absent → exactly the 002 node graph (research.md M7)
- [x] T016 [US1] Rewrite the music sequencer in `audio/synth.js`: one global bar/step counter on the fixed `bpm` grid, hits from `arrange.hitsForStep` for each live song, look-ahead 200 ms, skip (count in `skippedSteps`) any step more than one step late without shifting the grid, per-song `mainBus`/`bassBus` GainNodes at `Song.gain` into the existing `music → duck → master` chain (research.md M2, M9, M10)
- [x] T017 [US1] Implement `startMusic(seed, level = 1)` and `stopMusic()` (20 ms bus ramps, disconnect) and `stats().music` (`bpm, order, songId, stage, block, bar, cycleBar, crossfade, liveSongs, activeParts, partCounts, songStarts, skippedSteps, stepTimes`) in `audio/synth.js` per contracts/audio-api.md; keep `incidentMusic`, `level` top-level
- [x] T018 [US1] Change `main.js` to call `audio.startMusic(run.seed)` for every new run, Replay Seed and New Run (FR-014)
- [x] T019 [US1] Run `jsc -m tests/run.mjs` and `python3 tests/browser/drive.py --only audio`; fix failures until B1–B4, B6–B8 pass

**Checkpoint**: A run plays the block-1 scaffold song at 174 BPM; sound controls behave as before.

---

## Phase 4: User Story 2 — A different song every 4 levels, in a seeded order (Priority: P1)

**Goal**: Songs change at difficulty 5, 9, 13, 17 in the seed's order (no repeats) with a 2-bar
equal-power crossfade and a bass swap at the bar-2 line; never more than two songs live.

**Independent Test**: Shortened-timer run with `?seed=7&levelSeconds=3`: five different songs start at
levels 1, 5, 9, 13, 17 in `songOrder(7)` order; Replay Seed repeats it; crossfades last 2 bars with no
overlapping bass (B5, B9, B10).

### Tests for User Story 2

- [x] T020 [P] [US2] Add M-U2 to `tests/music.test.js`: `songOrder` is a permutation, deterministic per seed, and seeds 1–30 give ≥ 10 distinct orders with every song first at least once (SC-003; if it fails, change the salt in `audio/arrange.js`, not the rule)
- [x] T021 [P] [US2] Add M-U6 and M-U7 to `tests/music.test.js`: `crossfadeGains` equal-power main and step bass (never both basses > 0); arrangement starts a crossfade on the bar after a block change, ends it 2 bars later, and a second block change during a crossfade cuts the outgoing song (≤ 2 live)

### Implementation for User Story 2

- [x] T022 [US2] Add `crossfadeGains(barInFade, fraction)` and block-change handling to `createArrangement` in `audio/arrange.js` (crossfade start/end, cut rule, `songStarts` records `{songId, bar, level}`) per data-model.md › Arrangement state and research.md M9
- [x] T023 [US2] In `audio/synth.js`, turn arrangement crossfades into gain automation: equal-power `setValueCurveAtTime` on both `mainBus`es over 2 bars from the bar line; `bassBus` step (outgoing off, incoming on at bar 2 with 20 ms ramps); do not schedule silent-bass notes; remove and disconnect the outgoing song after 2 bars; 20 ms cut for a song dropped mid-fade (FR-008, FR-008a, FR-009)
- [x] T024 [US2] Rewrite B5 in `tests/browser/smoke-audio.html`: `?seed=7&levelSeconds=3` run — at every sample the gaps between consecutive `stats().music.stepTimes` (ignoring skipped steps) are 86.2 ± 0.2 ms (60/174/4), including during song and stage changes; `songStarts` has five distinct songs at levels 1/5/9/13/17 matching `songOrder(7, data.music.songs)`, stage equals `stageForLevel(level)`, every start on a bar line (SC-001, SC-002)
- [x] T025 [US2] Add B9 to `tests/browser/smoke-audio.html`: Replay Seed twice with seed 7 → identical `order` and `songStarts` song ids (FR-006)
- [x] T026 [US2] Add B10 to `tests/browser/smoke-audio.html`: across a song change, crossfade duration 2.76 ± 0.1 s on the audio clock, `liveSongs.length ≤ 2` at every sample, no outgoing bass hits after crossfade bar 1 and no incoming bass hits before bar 2 (SC-004 scripted half)
- [x] T026a [US2] Add B12 to `tests/browser/smoke-audio.html` with `?seed=7&levelSeconds=3`: (a) mute before difficulty 5 and unmute after difficulty 6 starts — `songStarts` already lists block 2's song and `stage` is 2; (b) `pagehide`/`pageshow` mid-crossfade — after return `liveSongs` is 1 within 2 bars and the song is not recorded in `songStarts` twice (spec Edge Cases: muted, tab hidden mid-crossfade)
- [x] T027 [US2] Run unit tests and `python3 tests/browser/drive.py --only audio`; fix until B5, B9, B10, B12 pass

**Checkpoint**: The soundtrack changes every 4 levels in a seeded order with clean crossfades.

---

## Phase 5: User Story 3 — Each song builds through its block (Priority: P2)

**Goal**: Four cumulative build-up stages per block; the 32-bar phrase cycle with fills on bars
8/16/24 and a breakdown on 29–32 (fill/riser on 32); a per-song incident layer.

**Independent Test**: M-U4/M-U5 pass; the incident checks still pass; on the preview page the stages,
fills and breakdowns are heard (M-H2, M-H3).

### Tests for User Story 3

- [x] T028 [P] [US3] Add M-U4 and M-U5 to `tests/music.test.js`: stage 1 contains only drums/fill/riser/bass parts (any stage-1 riser is noise-only) and parts never decrease across stages for every shipped song; drums play steps 0–7 only on bars 8/16/24, are silent on 29–32 and return on bar 33; fills only on 8/16/24/32 steps 8–15; riser only on bar 32; a stage change during a breakdown adds drum parts first at the drop (FR-010, FR-013a, FR-013b, SC-005)

### Implementation for User Story 3

- [x] T029 [US3] Implement the phrase cycle in `partsForBar` in `audio/arrange.js` (roles `drums`, `fill`, `riser`, `bass`, `music`, `incident` per research.md M5), with `cycleBars`, `fillBars` and `breakdownBars` read from data
- [x] T030 [US3] Wire the per-song incident part: `queueIncident` applies on the next bar line, the live songs' `incident` parts play only while active, `stats().incidentMusic` unchanged, in `audio/arrange.js` and `audio/synth.js` (FR-012)
- [x] T031 [US3] Support `startMusic(seed, level)` with `level > 1` (song for that block, stage for that level) in `audio/arrange.js` and add a unit test for levels 6 and 17 in `tests/music.test.js` (User Story 3 scenario 5)
- [x] T032 [US3] Run unit tests, `python3 tests/browser/drive.py --only incidents` and `--only audio`; fix failures

**Checkpoint**: Each block builds from drums + bass to the full arrangement with fills and breakdowns.

---

## Phase 6: User Story 4 — Five songs that sound clearly different (Priority: P2)

**Goal**: Replace the scaffold songs with the five full original songs from research.md M8 and give the
user a preview page to listen to them locally.

**Independent Test**: Shipped data validates (M-U1); the preview page plays every song at every stage;
automated spectral and loudness checks pass (B11); human checks M-H1–M-H6 are ready to run.

### Implementation for User Story 4

- [x] T033 [US4] Write song `liquid-uplink` ("Uplink", Liquid, F, headphones-first) in `data/audio.json` per research.md M8: rolling ghost-note break, sine sub following an 8-bar Fm9–D♭maj7–A♭–E♭ progression, unison saw pad (slow attack), triangle keys, airy atmosphere, fills and riser, incident part in key — citing data-model.md › Song.parts and Part.pattern/Part.notes for the content rules
- [x] T034 [US4] Write song `jump-up-handshake` ("Handshake", Jump-up, G, speakers) in `data/audio.json`: punchy two-step, sine sub + square "talking" upper bass with filter LFO (2–3 step period) and call-and-response riff, brass-like stab, shaker, fills, incident part
- [x] T035 [US4] Write song `neuro-packet-storm` ("Packet Storm", Neurofunk, E, speakers) in `data/audio.json`: tight snare with body tone, 16th hats, 3-voice reese upper bass with drive, filter LFO and sweeps, dark atmosphere, metallic hits, fills, incident part
- [x] T036 [US4] Write song `jungle-backbone` ("Backbone", Jungle, A, headphones-first) in `data/audio.json`: chopped break as separate kick/snare/hat parts with many `o` ghost hits and a 4-bar variation, long sine sub with slides, off-beat minor skank stabs, tom-roll bar-32 fill, incident part
- [x] T037 [US4] Write song `dancefloor-uptime` ("Uptime", Dancefloor, D, speakers) in `data/audio.json`: driving two-step with big clap, sine sub + driven saw upper bass an octave up, unison stabs, stage-4 square lead hook (8 bars), riser into each drop, incident part
- [x] T038 [P] [US4] Add `previewSong(songId, stage)` and `previewJump(cycleBar)` to `audio/synth.js` and create `tests/music-preview.html` (Start button, song picker, stage 1–4, incident toggle, "Jump to bar 25", "Next song (crossfade)", Music volume, read-out of song/style/stage/cycle bar/crossfade/bass audibility; shows validation errors instead of playing) per contracts/audio-api.md
- [x] T039 [US4] Add B11 to `tests/browser/smoke-audio.html`: render 16 bars of each song's stage-4 arrangement with an `OfflineAudioContext` and check (a) every `speakers` song has clearly measurable 150 Hz–1 kHz bass-band energy (≥ −20 dB relative to its sub band) (SC-007a proxy) and (b) song loudness (RMS) is within 3 dB of the median, adjusting `Song.gain` (data-model.md › Song.gain) until it is
- [x] T040 [US4] Run unit tests and `python3 tests/browser/drive.py --only audio`; fix validation or B11 failures

**Checkpoint**: Five full, distinct songs play in the game and on the preview page.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T041 Compare B7 and T9 against the T002 baseline (`python3 tests/browser/drive.py --only audio` and `--only T9`); reduce part density, unison or chord sizes if B7 average frame time exceeds the baseline by more than 1 ms or B7/T9 miss their limits (SC-008); record the figures under the baseline note in `specs/007-drum-and-bass-music/research.md`
- [x] T042 [P] Annotate superseded requirements: `specs/002-procedural-audio/spec.md` (FR-005, FR-006, FR-007), `specs/002-procedural-audio/contracts/audio-data.md` and `data-model.md` (music section → 007), `specs/004-major-incidents/spec.md` (incident music layer → per-song incident part) (FR-017)
- [x] T043 [P] Update `README.md`: music description (drum & bass, 174 BPM, five songs, seeded order, 4-level blocks), the preview page URL, and verification rows M-U1–M-U9, B5, B9, B10, B11 and human checks M-H1–M-H6 (recorded "not run" until the user listens)
- [x] T044 Run the full verification: `jsc -m tests/run.mjs` and `python3 tests/browser/drive.py`; record pass/fail per check in `README.md` and set **Status** in `specs/007-drum-and-bass-music/spec.md`
- [x] T045 Hand off for local listening (no commit/push/merge unless asked): serve with `python3 -m http.server 8000 --bind 127.0.0.1`, give the user http://127.0.0.1:8000/tests/music-preview.html and http://127.0.0.1:8000/?levelSeconds=10, and list the human checks M-H1–M-H6 from quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1 (Phase 3)** needs Phase 2 (data, validator, arranger core).
- **US2 (Phase 4)** needs US1 (the synth sequencer and buses it automates).
- **US3 (Phase 5)** needs Phase 2; its synth part (T030) needs US1. It can run in parallel with US2
  apart from shared edits to `audio/arrange.js` (do T029 before or after T022, not at the same time).
- **US4 (Phase 6)** needs US1 to be audible; the song data (T033–T037) depends only on the Phase 2
  validator and can be written in parallel with US2/US3 by one person (same file: sequential).
- **Polish (Phase 7)** after all stories.

### Within Each Story

- Tests are written first and fail before implementation (T014, T020–T021, T028).
- `audio/arrange.js` (pure) before `audio/synth.js` (playback) before browser checks.

### Parallel Opportunities

- T002 alongside T001; T007 and T012 alongside T003–T006/T008–T011 (different files).
- T020 and T021 together (same new test file sections — coordinate, or run sequentially).
- T028 alongside US2 work; T038 (preview page) alongside T033–T037.
- T042 and T043 together.

## Parallel Example: User Story 2

```text
Task: "T020 [US2] M-U2 songOrder tests in tests/music.test.js"
Task: "T021 [US2] M-U6/M-U7 crossfade and arrangement tests in tests/music.test.js"
then
Task: "T022 [US2] crossfadeGains + block changes in audio/arrange.js"
Task: "T023 [US2] crossfade automation in audio/synth.js"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 (schema 2, validator, scaffold songs, arranger core).
2. Phase 3 (US1): the game plays a drum & bass groove at 174 BPM with all sound controls intact.
3. **Stop and validate**: unit tests + `--only audio`.

### Incremental Delivery

1. + US2 → five songs rotate every 4 levels with crossfades (scaffold quality).
2. + US3 → build-up, fills, breakdowns, per-song incident layer.
3. + US4 → full original songs, preview page, spectral/loudness checks.
4. Polish → performance, docs, full suite, local hand-off. The user listens before any push/merge.
