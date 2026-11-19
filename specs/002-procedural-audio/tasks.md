---

description: "Task list for feature 002 — Procedural Audio"
---

# Tasks: Procedural Audio — Sound Effects and Music

**Input**: Design documents from `specs/002-procedural-audio/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan and quickstart require unit tests A1–A6, scripted browser checks
B1–B8 and human checks H1–H3 (constitution C7).

**Organization**: Tasks are grouped by user story. All three stories are P1; they are ordered
effects → music → controls, following the plan's slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 Hear the action · US2 Music that builds · US3 Control the sound
- Paths are relative to the repository root. Folders `audio/`, `engine/`, `ui/`, `data/`, `tests/`
  follow [plan.md](./plan.md) → Project Structure.

## Global rules for every task

- `audio/content.js` and `audio/director.js` stay pure: no `window`, `document`, `fetch`,
  `AudioContext`, `Math.random`, or timers (they must run under `jsc -m tests/run.mjs`).
- All Web Audio code lives only in `audio/synth.js`; every public method catches its own errors
  and turns `status` into `unavailable` instead of throwing ([contracts/audio-api.md](./contracts/audio-api.md)).
- The engine changes only by pushing two new events; no state, timing, or RNG changes (FR-017).
- After each phase, run `jsc -m tests/run.mjs` (or `node tests/run.mjs`) and keep all 73 existing
  tests passing.

---

## Phase 1: Setup

**Purpose**: Create the new folder, files, and test registration.

- [x] T001 Create the `audio/` folder with empty ES modules `audio/content.js`, `audio/director.js`, `audio/synth.js`, each with a one-line header comment stating its role and purity rule from [plan.md](./plan.md)
- [x] T002 [P] Create empty test modules `tests/audio-content.test.js` and `tests/audio-director.test.js` using the existing harness pattern (see `tests/content.test.js`), and register both in `tests/files.js`
- [x] T003 [P] Extend the engine purity source scan in `tests/determinism.test.js` so it also scans `audio/content.js` and `audio/director.js` for browser APIs and `Math.random`

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Sound data, its validator, the pure director, the two engine events, and audio
loading in `main.js`. Every story depends on these.

**⚠️ CRITICAL**: No user story work begins until this phase passes A1–A5.

### Tests first

- [x] T004 [P] Write A1 tests in `tests/audio-content.test.js`: the shipped `data/audio.json` (read with the harness file reader) passes `validateAudioData(raw, gameData)`; broken copies fail with an error naming the path for each of: missing effect key, unknown effect key, bad `wave`, pattern length ≠ 16, pattern with no `x`, `bpmEnd` < 1.3 × `bpmStart`, no layer with `joinLevel` 1, no layer at a debut level from `data/game.json`, duplicate layer `id`, `win` voice > 3000 ms, other effect voice > 1000 ms, unknown field at any level; validator never throws on `null`, arrays, or strings
- [x] T005 [P] Write A2–A4 tests in `tests/audio-director.test.js`: (A2) each engine event in the data-model "Event → sound mapping" table yields the right effect, `difficulty-up` with empty `debuts` yields only a `level`, several `level-up` in one call yield one `levelUp`, `run-ended` yields `runEnded` with the outcome, and `consume` never mutates its `events` array; (A3) 500 `hit` events spread over 1000 simulated ms yield at most one `hit` per 60 ms, at no `nowMs` are more than 8 effects sounding, and excess requests are dropped not queued; `reset()` clears timing; (A4) `bpmForLevel` is non-decreasing over 1–20 with level 20 ≥ 1.3 × level 1, and `layersForLevel` adds a layer at every debut level 4, 8, 12, 16
- [x] T006 [P] Write A5 tests in `tests/determinism.test.js`: a seeded run with Ping and Load Balancer active emits `fire` events (one per volley, `{toolId}`) and `pickup` events (`{value}`); the state hash after N ticks is identical with and without a director consuming `run.events` each step, and the director never writes to `run`
- [x] T007 [P] Write A6 test in `tests/audio-content.test.js`: the source of `audio/*.js` contains no `fetch(`, `XMLHttpRequest`, `import(`, or `http` URL, and (via a file list passed from `tests/browser/drive.py` or a Python check in T045) the repository contains no `.wav`, `.mp3`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.webm`, or `.opus` files

### Implementation

- [x] T008 Create `data/audio.json` matching [contracts/audio-data.md](./contracts/audio-data.md): `schemaVersion` 1; `defaults` music 60, effects 80, muted false; `mix` masterGain 0.8, duckFactor 0.5, maxConcurrentEffects 8; all 10 effects (`fire`, `pulse`, `damage`, `hit`, `defeat`, `pickup`, `levelUp`, `newThreat`, `win`, `loss`) with clearly different pitch/rhythm/timbre per [research.md](./research.md) A1 (e.g. fire = short square down-blip, pulse = sine swell, damage = low saw buzz, hit = noise tick, defeat = triangle drop, pickup = rising sine chirp, levelUp = 3-note rising arpeggio, newThreat = two-tone alarm, win = 4-note major arpeggio ≤ 3 s, loss = descending saw ≤ 3 s), `minIntervalMs` 60 for fire/hit/defeat/pickup; music bpmStart 118, bpmEnd 156, stepsPerBar 16 and layers per research A6: kick + bass at 1, closed hat at 4, clap at 8, open hat + percussion at 12, filtered stab at 16
- [x] T009 Implement `validateAudioData(raw, gameData)` and `EFFECT_NAMES` in `audio/content.js`, returning `{ok, data}` or `{ok:false, errors:[{path,id,message}]}` like `validateGameData` in `engine/content.js`, never throwing, rejecting unknown fields, and enforcing the rules for: data-model.md `AudioSettingsDefaults.schemaVersion`, `AudioSettingsDefaults.defaults.musicVolume`, `AudioSettingsDefaults.defaults.effectsVolume`, `AudioSettingsDefaults.defaults.muted`, `AudioSettingsDefaults.mix.masterGain`, `AudioSettingsDefaults.mix.duckFactor`, `AudioSettingsDefaults.mix.maxConcurrentEffects`; data-model.md `Voice.wave`, `Voice.notes`, `Voice.gain`, `Voice.attackMs`, `Voice.filter`; data-model.md `Note.freq`, `Note.toFreq`, `Note.ms`; data-model.md `SoundEffectDefinition.voice`, `SoundEffectDefinition.minIntervalMs`; data-model.md `MusicDefinition.bpmStart`, `MusicDefinition.bpmEnd`, `MusicDefinition.stepsPerBar`, `MusicDefinition.layers`; data-model.md `MusicLayer.id`, `MusicLayer.joinLevel`, `MusicLayer.pattern`, `MusicLayer.voice`, `MusicLayer.pitches`; plus the data-model.md cross-file rules (a layer at `joinLevel` 1 and at every enemy `debutLevel` in `gameData.enemies`, message naming the enemy id as in the contract example)
- [x] T010 Implement `bpmForLevel(audioData, level)` and `layersForLevel(audioData, level)` in `audio/director.js` per data-model.md `AudioState.bpm` and `AudioState.activeLayers`
- [x] T011 Implement `createDirector(audioData)` in `audio/director.js` per [contracts/audio-api.md](./contracts/audio-api.md): `consume(events, nowMs)` → `{effects, level, runEnded}` using the data-model.md "Event → sound mapping" table, applying data-model.md `SoundEffectDefinition.minIntervalMs` via `AudioState.lastPlayed`, the `AudioSettingsDefaults.mix.maxConcurrentEffects` cap via `AudioState.playing` (each effect's end time = `nowMs` + voice duration), at most one request per effect per call, one `levelUp` per call; `reset()`; `counts` per data-model.md `AudioState.counts`
- [x] T012 [P] Push `{type:'fire', toolId}` once per volley for `projectile-nearest` and `spread` tools in `engine/weapons.js` (inside `updateTool`, after the volley's projectiles are created; not per projectile; not for `pulse` or `orbit` kinds)
- [x] T013 [P] Push `{type:'pickup', value}` once per collected telemetry pickup in `engine/combat.js` (`updatePickups`, where `addTelemetry` is called)
- [x] T014 Load `data/audio.json` in `main.js` `boot()` alongside `data/game.json`, validate it with `validateAudioData(raw, validatedGameData)`, and show errors from both files together on the existing "Game data has errors" screen (`ui/screens.js` `showError`); a missing or unparsable `audio.json` is reported as an error there too
- [x] T015 Create page-session audio settings in `main.js` per data-model.md "Audio Settings (page session)" — `AudioSettings.muted`, `AudioSettings.musicVolume`, `AudioSettings.effectsVolume` — (initialised from `defaults`, never written to storage, FR-014), and add `audio: null` to the debug handle `globalThis.__uptimeSurvivors` (filled with `audio.stats()` and `director.counts` later)

**Checkpoint**: A1–A5 pass in `jsc -m tests/run.mjs` and in `tests/index.html`; the game still
boots and plays silently; existing 73 tests pass.

---

## Phase 3: User Story 1 — Hear the action (Priority: P1) 🎯 MVP

**Goal**: The 10 game events each play their own short sound once the player presses Start.

**Independent Test**: Start a run, play one minute: every listed event is audible and distinct; the
title screen is silent; `__uptimeSurvivors.audio.effectCounts` rises for each effect seen (B1, B2, B6).

### Tests for User Story 1

- [x] T016 [P] [US1] Create `tests/browser/smoke-audio.html` (same result-reporting pattern as `tests/browser/smoke3.html`: `GET /__result?d=<json>`) with modes `b1` (load the game in an iframe; after 1 s assert `audio.status === 'idle'` and no effect counted), `b2` (click Start; within 500 ms assert `status === 'running'`; after 10 s of play assert `fire`, `hit`, `pickup` counts > 0), and `b6` (iframe page with `?audioFail=1`; assert play continues, HUD text is "Sound unavailable", `status === 'unavailable'`)
- [x] T017 [US1] Add the audio page to `tests/browser/drive.py`: launch Chrome with `--autoplay-policy=no-user-gesture-required` for that page only, run modes via `--only`, and print pass/fail per check

### Implementation for User Story 1

- [x] T018 [US1] Implement in `audio/synth.js`: `createAudio(audioData, settings)` (status `idle`, nothing created); `start()` creating the `AudioContext` and the gain chain from research A4 (effects → master, music → duck → master, master → destination; volume % → gain via `(pct/100)²`; master = `AudioSettingsDefaults.mix.masterGain` or 0 when muted), resolving `running` or `unavailable` and never rejecting, with status values per data-model.md `AudioState.status`; a test hook that makes `start()` fail when the page URL has `?audioFail=1` (read in `main.js` and passed in settings, not read inside synth)
- [x] T019 [US1] Implement voice playback in `audio/synth.js`: a shared white-noise buffer generated in code once; `playVoice(voice, when, dest, freqOverride)` building an oscillator or noise source, optional filter, gain envelope (`attackMs` attack, exponential release to the end of the last note), and per-note frequency steps/slides (`toFreq` via `exponentialRampToValueAtTime`); `play(effectName)` schedules the effect's voice on the effects bus, is a no-op unless `running`, and counts into `effectCounts`
- [x] T020 [US1] Implement `audio.stats()` in `audio/synth.js` with all fields listed in [contracts/audio-api.md](./contracts/audio-api.md) (music fields report defaults until US2)
- [x] T021 [US1] Wire audio into `main.js`: create `audio` once; call `await audio.start()` inside the Start, New Run and Replay Seed click handlers only if `status === 'idle'` (FR-010, research A3); create a director per page and `reset()` it in `startRun`; each frame after stepping, `plan = director.consume(run.events, performance.now())` and `audio.play()` each `plan.effects` entry; on `plan.runEnded` play `win`/`loss` (music stop is added in US2); expose `audio.stats()` and `director.counts` on the debug handle
- [x] T022 [P] [US1] Add a HUD sound indicator element to `index.html` and render it from `ui/hud.js` (`createHud` gets a `setSound(status, muted)` method): "♪ Sound on (M)", "Sound off (M)", or "Sound unavailable" per [contracts/ui-controls.md](./contracts/ui-controls.md); style it in `style.css` to match the existing HUD
- [x] T023 [US1] When `start()` resolves `unavailable`, set the HUD to "Sound unavailable" and announce it once through the existing ARIA live region (`ui/screens.js`), with no error screen (FR-020, FR-019)
- [x] T024 [US1] Run B1, B2, B6 via `python3 tests/browser/drive.py --only audio` and fix failures; confirm all unit tests still pass

**Checkpoint**: Effects play during a run, nothing before Start, graceful "Sound unavailable".

---

## Phase 4: User Story 2 — Music that builds with the danger (Priority: P1)

**Goal**: A minimal techno loop starts with the run, speeds up every level, gains a layer at each
debut level, ducks on pause/level-up screens, and stops at the end.

**Independent Test**: With `?levelSeconds=2`, `__uptimeSurvivors.audio.bpm` rises each level, layer
count grows at 4, 8, 12, 16, music is ducked while paused, and music stops with a `win`/`loss` at the
end (B4 ducking part, B5).

### Tests for User Story 2

- [x] T025 [P] [US2] Add mode `b5` to `tests/browser/smoke-audio.html`: load with `?levelSeconds=2&seed=12345`, keep the engineer invulnerable as the 001 full-run check does, sample `audio.stats()` every 250 ms; assert `bpm` is non-decreasing and ≥ 1.3× its first value by level 20, `activeLayers` grows at levels 4, 8, 12, 16, every active layer's `layerCounts` increases, and at the end music is stopped and `effectCounts.win` (or `loss`) is exactly 1
- [x] T026 [P] [US2] Add mode `b4duck` to `tests/browser/smoke-audio.html`: start a run, press Escape → `ducked === true`; resume → `false`; force a level-up screen → `ducked === true`

### Implementation for User Story 2

- [x] T027 [US2] Implement the look-ahead sequencer in `audio/synth.js` per research A5: a 25 ms `setInterval` scheduling every step that falls in the next 120 ms on `context.currentTime`; step length = 60 / bpm / 4; at each bar start (step 0) read the pending level and recompute `bpm` with `bpmForLevel` and the active layers with `layersForLevel` (imported from `audio/director.js`); for each active layer whose data-model.md `MusicLayer.pattern` has `x` at the step, play its voice on the music bus, cycling data-model.md `MusicLayer.pitches` when present; count into `layerCounts`
- [x] T028 [US2] Implement `startMusic()` (bar 1, level 1, clear pending), `stopMusic()` (clear the timer, stop future scheduling), and `setLevel(level)` (stored as pending, applied at the next bar) in `audio/synth.js`; `stats()` now reports live `level`, `bpm`, `activeLayers` (ids), `layerCounts`
- [x] T029 [US2] Implement `setDucked(bool)` in `audio/synth.js`: duck gain ramps over 20 ms to data-model.md `AudioSettingsDefaults.mix.duckFactor` or 1
- [x] T030 [US2] Wire music in `main.js`: `startMusic()` in `startRun` after `audio.start()` (restarts from bar 1 for New Run / Replay Seed, FR-009); `stopMusic()` in `quitToTitle`; apply `plan.level` with `setLevel`; on `plan.runEnded` call `stopMusic()` before playing `win`/`loss`; every frame `setDucked(run.phase === 'paused' || run.phase === 'levelup')`
- [x] T031 [US2] Implement `suspend()` / `resume()` in `audio/synth.js` (context suspend/resume plus pausing the sequencer timer so no steps pile up); call `suspend()` from the existing `onFocusLost` callback in `main.js`, and add an `onFocusGained` callback (window `focus` and `visibilitychange` to visible) to `createInput` in `ui/input.js` that calls `resume()`; on return the game is paused, so music resumes ducked (spec Edge Cases)
- [x] T032 [US2] Run B4 (ducking) and B5 via `drive.py --only audio` and fix failures

**Checkpoint**: Music starts, climbs, ducks, stops, and restarts; US1 still passes.

---

## Phase 5: User Story 3 — Control the sound (Priority: P1)

**Goal**: M mutes/unmutes everything anywhere; the pause screen has a Sound toggle and Music/Effects
volume sliders; settings last for the page session.

**Independent Test**: Press M twice during play (muted, then unmuted with unchanged volumes); open
Pause and move both sliders (gains change); press M on the title, then Start (run starts muted)
(B3, B4 controls part).

### Tests for User Story 3

- [x] T033 [P] [US3] Add mode `b3` to `tests/browser/smoke-audio.html`: during play dispatch `M` → `muted === true` and HUD "Sound off (M)" within 100 ms; `M` again → `muted === false` with `musicVolume`/`effectsVolume` unchanged; on a fresh page press `M` on the title then Start → run starts with `muted === true`
- [x] T034 [P] [US3] Add mode `b4controls` to `tests/browser/smoke-audio.html`: on the pause screen the Sound button and Music/Effects range inputs exist with labels showing current %; ArrowLeft on Music lowers it by 10; setting Effects to 0 → `effectsVolume === 0` while music layer counts keep rising; New Run keeps the changed settings

### Implementation for User Story 3

- [x] T035 [US3] Implement `setMuted(bool)`, `setMusicVolume(pct)`, `setEffectsVolume(pct)` in `audio/synth.js` with 20 ms gain ramps (research A4), values per data-model.md `AudioSettings.muted`, `AudioSettings.musicVolume`, `AudioSettings.effectsVolume`; calls before `start()` only update stored settings so the run starts with them
- [x] T036 [P] [US3] Add an `onMuteKey` callback for `KeyM` (any screen, no repeat) to `createInput` in `ui/input.js`, without disturbing existing pause and choice keys
- [x] T037 [US3] In `main.js`, toggle `settings.muted` on M, call `audio.setMuted`, update the HUD indicator via `hud.setSound`, and announce "Sound on" / "Sound off" through the ARIA live region (FR-012); works on title, playing, paused, level-up and end screens
- [x] T038 [US3] Add to the pause screen in `ui/screens.js` `showPause`: a **Sound** toggle button and two native `<input type="range" min="0" max="100" step="10">` sliders labelled **Music** and **Effects** with the current % shown, per [contracts/ui-controls.md](./contracts/ui-controls.md); wire changes to callbacks that `main.js` maps to `settings` and the `audio.set*` methods; keyboard focus order and arrow keys work; slider keys must not trigger game input; style in `style.css`
- [x] T039 [P] [US3] Add "Sound: M to mute" to the title screen controls reminder in `index.html` / `ui/screens.js` `showTitle` (FR-015)
- [x] T040 [US3] Run B3 and B4 (controls) via `drive.py --only audio` and fix failures

**Checkpoint**: All three stories work together; A1–A6 and B1–B6 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance, network, documentation, tuning, and recording evidence.

- [x] T041 [P] Add mode `b7` to `tests/browser/smoke-audio.html`: reuse the 001 F5 perf setup (300 enemies, sound on, unmuted) and assert the same frame-pacing threshold as 001 SC-005; record frame stats
- [x] T042 [P] Add mode `b8` to `tests/browser/smoke-audio.html` / `drive.py`: play 30 s with sound on and confirm from the server log and `performance.getEntriesByType('resource')` that no request goes to another origin and no audio file is requested
- [x] T043 Run the full browser suite (`python3 tests/browser/drive.py`) including the existing 001 checks, and fix any regression caused by audio wiring
- [ ] T044 *(Not done by ear — no human listener yet; see H1–H3 in the README. Done so far: worst-case headroom check — master 0.8 × (music 0.36 × Σ layer gains 1.125 + effects 0.64 × top-8 effect gains 1.29) ≈ 0.99 < 1.0 even if every peak lined up; A1 re-run after edits.)* Tune `data/audio.json` by ear for distinctness and comfort (no harsh highs, effects sit above the music, gains keep the master from clipping with 8 effects plus all layers); re-run A1 after edits
- [x] T045 [P] Add the A6 repository check (no audio-file extensions anywhere outside `.git/`) to `tests/browser/drive.py` or a small `tests/check_no_audio_files.py`, and run it
- [x] T046 [P] Add a note to `specs/001-survivors-first-playable/spec.md` Non-Goals: "No audio" is lifted by feature 002 (`specs/002-procedural-audio/`)
- [x] T047 [P] Add the `fire` and `pickup` events to the event table in `specs/001-survivors-first-playable/contracts/engine-api.md`
- [x] T048 Update `README.md`: controls (M), a short Sound section (what plays, mute, pause-screen volumes, no persistence), and verification rows A1–A6, B1–B8, H1–H3 with pass / fail / not run, date, and environment (H1–H3 "not run" unless a human has done them)
- [x] T049 *(Done 2026-11-19: A1–A6 and B1–B8 run and recorded; H1–H3 recorded as not run.)* Walk through [quickstart.md](./quickstart.md) end to end and mark every task in this file complete only with its evidence recorded

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish (Phase 6)**
- **US1 (Phase 3)** needs Phase 2. It creates `audio/synth.js` start/play and the `main.js` wiring.
- **US2 (Phase 4)** needs Phase 2 and T018–T021 from US1 (context, gain chain, frame wiring).
- **US3 (Phase 5)** needs Phase 2 and T018, T021, T022 from US1 (gain chain, wiring, HUD
  indicator). It does not need US2; if built before US2, the Music slider only affects the empty
  music bus until US2 lands.
- **Polish** needs all stories.

### Within phases

- Tests (T004–T007) are written before T008–T013 and fail first.
- T008 (data) before T009 is finished (the shipped-file test needs it); T009 before T014.
- T010 before T011 and T027; T018 before T019, T020, T027–T029, T031, T035.
- `main.js` tasks (T014, T015, T021, T023, T030, T031, T037) are sequential — same file.
- `audio/synth.js` tasks (T018–T020, T027–T029, T031, T035) are sequential — same file.
- `tests/browser/smoke-audio.html` modes (T016, T025, T026, T033, T034, T041, T042) touch one file;
  [P] marks mean "parallel with other files", not with each other.

### Story completion order

```text
Setup ─▶ Foundational ─▶ US1 (effects) ─┬─▶ US2 (music)   ─┬─▶ Polish
                                         └─▶ US3 (controls) ─┘
```

---

## Parallel Examples

### Phase 2

```text
T004 tests/audio-content.test.js   T005 tests/audio-director.test.js   T006 tests/determinism.test.js
then: T012 engine/weapons.js  ∥  T013 engine/combat.js  ∥  T008 data/audio.json
```

### User Story 1

```text
T022 index.html + ui/hud.js + style.css  ∥  T018–T020 audio/synth.js  ∥  T016 smoke-audio.html
```

### User Story 2

```text
T025 + T026 smoke-audio.html  ∥  T027–T029 audio/synth.js
```

### User Story 3

```text
T036 ui/input.js  ∥  T039 title reminder  ∥  T035 audio/synth.js
```

### Polish

```text
T045 no-audio-files check  ∥  T046 001 spec note  ∥  T047 001 engine contract  ∥  T041/T042 browser modes
```

---

## Implementation Strategy

### MVP first

1. Phases 1–2 (data, validator, director, engine events) — prove with A1–A5.
2. Phase 3 (US1) — effects playing, nothing before Start, "Sound unavailable" path.
3. **Stop and validate** B1, B2, B6. Because sound must never be forced on a player, add at least
   T035–T037 (M to mute) before showing the MVP to anyone.

### Incremental delivery (plan slices)

| Plan slice | Tasks | Evidence |
|------------|-------|----------|
| 1 · Data and decisions | T001–T015 | A1–A5 |
| 2 · Effects | T016–T024, T035–T037 | B1–B3, B6 |
| 3 · Music | T025–T032 | B4 (ducking), B5 |
| 4 · Controls and polish | T033–T034, T038–T044 | B4, B7, B8; H1–H3 recorded |
| 5 · Package | T045–T049 | README verification rows complete |

### Fallback

If time runs short, ship slices 1–2 (effects + mute) and record music as **not delivered** in the
README, rather than shipping an untested sequencer ([plan.md](./plan.md) → Scope controls).
