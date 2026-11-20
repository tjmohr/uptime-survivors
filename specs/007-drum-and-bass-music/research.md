# Research: Drum & Bass Soundtrack (feature 007)

All unknowns from the plan's Technical Context are resolved here. Each entry: Decision, Rationale,
Alternatives considered. IDs (M1…) are referenced from plan.md, data-model.md and tasks.

## M1 · Split arrangement (pure) from playback (Web Audio)

- **Decision**: Add `audio/arrange.js`, a DOM-free module that owns every musical decision: song
  order, block/stage for a level, the 32-bar phrase cycle, which parts sound on a given bar and step,
  crossfade and bass-swap gains. `audio/synth.js` keeps the Web Audio graph and only plays the notes
  the arranger returns.
- **Rationale**: The spec's measurable rules (tempo constant, order, stages non-decreasing, fills on
  bars 8/16/24, breakdown 29–32, bass swap) can then be unit-tested in the jsc runner with no browser,
  like the engine (C6 "rule tests run without rendering"). The browser checks only confirm the wiring.
- **Alternatives**: Keep all logic inside synth.js (today's approach) — untestable without a browser
  and much harder to reason about with two songs live at once.

## M2 · Fixed tempo and the shared beat grid

- **Decision**: One global grid: 174 BPM, 16 steps per bar (step = 60/174/4 ≈ 86.2 ms, bar ≈ 1.379 s).
  The sequencer advances a single global bar counter; every song, stage change, fill, breakdown and
  crossfade is computed from that counter, so two songs can never drift apart. `bpm` stays in data
  (validated as > 0) but the shipped value is 174 and a test pins it.
- **Rationale**: FR-001 / SC-001; a single clock makes beat alignment during crossfades automatic.
- **Alternatives**: A clock per song — needless; any rounding difference becomes audible drift.

## M3 · Song order from the seed without touching game randomness

- **Decision**: `songOrder(seed, songIds)` builds its own `createRng((seed ^ 0x5eed0174) >>> 0)` (the
  engine's mulberry32, a separate instance) and Fisher–Yates shuffles the song ids. It is called from
  `startMusic(seed)` with `run.seed`; `run.rng` is never read.
- **Rationale**: FR-006/FR-007, constitution C5: the simulation is unaffected because the game's
  generator is not consumed; the same seed always gives the same order. The salt decorrelates the
  music order from the run's own first random numbers. SC-003 (≥ 10 distinct orders and every song
  first at least once across seeds 1–30) is checked by a unit test; if a salt failed it, the salt —
  not the rule — is changed.
- **Alternatives**: Drawing from `run.rng` — breaks determinism of the simulation when sound state
  differs (rejected by FR-007). `Math.random()` — breaks Replay Seed (rejected by the clarified
  answer).

## M4 · Blocks, stages and the timing of changes

- **Decision**: `block = floor((level − 1) / 4)` (0–4) and `stage = ((level − 1) mod 4) + 1`. A level
  change is queued and applied on the next bar line (as today). If the queued level's block differs
  from the current one, a crossfade to `order[block]` starts on that bar; otherwise only the stage
  changes. Stage contents are cumulative: a part with `stage: s` plays at every stage ≥ s within its
  block. When the run starts above level 1 (only possible from tests), `startMusic` places the song
  and stage directly from that level.
- **Rationale**: FR-005, FR-010, FR-011, edge cases "level shorter than a bar" (the latest queued
  level wins; cumulative stages mean parts from skipped levels still join).
- **Alternatives**: Time-based blocks (every 4 minutes) — would break with the shortened-timer test
  setting and diverge from difficulty.

## M5 · Phrase cycle: fills and breakdowns

- **Decision**: Each song counts `songBar` from the bar it starts (crossfade bar 1 = song bar 0).
  `cycleBar = (songBar mod 32) + 1`. Parts have a `role`:
  - `drums`: play on cycle bars 1–28 except the second half (steps 8–15) of fill bars 8, 16, 24;
    silent on breakdown bars 29–32.
  - `fill`: plays only on bars 8, 16, 24 and 32, steps 8–15 (the validator rejects hits on steps 0–7).
  - `riser` (optional): plays only on bar 32 (a sweep into the drop); noise-only at stage 1, any voice
    from stage 2.
  - `bass`, `music` (pads, stabs, leads, atmosphere): play every bar, including breakdowns.
  - `incident`: like `music`, but only while an incident is active.
  Fill/riser parts are available from stage 1 (they are drums), so even stage 1 has fills.
- **Rationale**: FR-013a/b. A role-based rule keeps the songs' data small (no 32-bar drum patterns)
  and makes the structure identical and testable in every song.
- **Alternatives**: Writing every song as a literal 32-bar score — ~4× the data, error-prone, and the
  build-up stages would have to be repeated per section.

## M6 · Patterns, pitches and loop length

- **Decision**: A part's `pattern` is a list of 1, 2, 4 or 8 bar strings, each exactly 16 characters:
  `x` = hit, `o` = ghost hit (gain × `ghostGain`, default 0.35), `.` = rest. Pitched parts have
  `notes`: one entry per hit in pattern order (a semitone offset from the song's `rootHz`, or a list of
  offsets for a chord), restarting with the pattern. A part loops after its own bar count, counted
  from song bar 0, so a song repeats exactly after the longest part (validated: every song has at
  least one 8-bar part — FR-013).
- **Rationale**: Keeps the existing compact `x`/`.` notation from feature 002, adds ghost notes (needed
  for jungle/liquid breaks), and makes pitch content reviewable as music (semitones) rather than
  raw Hz. Tying pitches to hits (not to an independent cycle as the old `pitches` list did) makes the
  loop length exact.
- **Alternatives**: MIDI-like note events with start/duration — more flexible, much more verbose in
  JSON, and a new parser; not needed for loop-based dance music.

## M7 · Sounds needed for drum & bass, built from the existing Voice

- **Decision**: Extend the feature-002 Voice with optional fields (all validated, defaults keep old
  effects unchanged):
  - `unison` (1–3) and `detuneCents` (0–50): stacked detuned oscillators — the classic "reese" bass
    (Liquid, Neurofunk) and wide pads.
  - `filter.toHz` and `filter.q`: filter sweep over the note (plucks, risers, neuro "yoi" movement).
  - `lfo: { target: "filter" | "gain", steps, depth }`: tempo-synced modulation, period in 16th steps —
    the jump-up "wobble"/"talking" bass and gated pads. Synced to the grid so it never drifts.
  - `drive` (0–1): WaveShaper saturation — gritty neuro and mid-bass harmonics so bass is audible on
    small speakers.
  Music voices may last up to 2 bars (≈ 2759 ms) instead of one beat, for pads and long subs.
- **Rationale**: These five additions cover the five sub-styles (see M8) with nodes Web Audio already
  has (Oscillator, BiquadFilter, Gain, WaveShaper) — no samples, no audio files (FR-004).
- **Alternatives**: Sample-based drums/breaks — would need audio files (violates FR-004 and the
  "generated in the browser" decision of 002) and raise originality questions for breakbeats (C1).
  AudioWorklet synthesis — more power, but a separate module file per worklet, harder to test, and
  unnecessary for this palette.

## M8 · Sound design per sub-style (original compositions)

All five songs are written for this project. Roots and identities (rootHz is the sub's root):

| Song (id) | Style | Root | Bass audibility | Signature parts |
|-----------|-------|------|-----------------|-----------------|
| `liquid-uplink` "Uplink" | Liquid | F (43.65 Hz) | headphones-first | rolling two-step with ghost-note snares and shuffled hats; sine sub following the chords; 3-voice detuned saw pad (Fm9–D♭maj7–A♭–E♭) with slow attack; soft electric-piano-like triangle stabs; airy noise atmosphere |
| `jump-up-handshake` "Handshake" | Jump-up | G (49.00 Hz) | speakers | punchy two-step; sine sub + square "talking" mid-bass with a gain/filter LFO every 2 or 3 steps, call-and-response riff; short brassy stab; percussion shaker |
| `neuro-packet-storm` "Packet Storm" | Neurofunk | E (41.20 Hz) | speakers | tight snare with a body tone, precise 16th hats; 3-voice reese (detune 25 c) through drive and a filter LFO plus filter sweeps; dark minor-second atmosphere; metallic FM-like square hits |
| `jungle-backbone` "Backbone" | Jungle | A (55.00 Hz) | headphones-first | busy chopped break (kick, snare and hat parts with many ghost hits and rolls, plus a 4-bar variation); long sine sub with pitch slides; off-beat minor stabs (reggae skank); bar-32 tom roll fill |
| `dancefloor-uptime` "Uptime" | Dancefloor | D (36.71 Hz) | speakers | four-to-the-floor-free driving two-step with a big clap; sine sub + distorted saw mid-bass doubling the riff an octave up; supersaw-like stabs; catchy square lead hook at stage 4; riser into each drop |

- **User feedback after loop 1 (2026-11-19)**: overall "pretty good so far". Some ghost-note snares were
  not liked. Rule for the full songs: ghost snares (`o`) are a style tool, not a default — use them
  where the style needs them (Jungle's chopped break; light, sparse touches in Liquid's rolling break),
  keep them few and quiet, and leave Jump-up, Neurofunk and Dancefloor with clean, tight backbeats
  (no ghost snares; ghost hits only on hats/shakers if any).
- **Bass audibility (FR-002a)**: three "speakers" songs layer an upper bass part (wave ≠ sine, 150 Hz–
  1 kHz content via filter/drive, pitched +12 or +24 semitones over the sub) from stage 1. The two
  "headphones-first" songs lead with sub; any mid content they have is optional.
- **Snare on 2 and 4 (FR-002)**: every song has a stage-1 `drums` part with `instrument: "snare"` hitting
  steps 4 and 12 of every bar of its pattern; ghost notes may surround them.
- **Song titles** are network-themed (Uplink, Handshake, Packet Storm, Backbone, Uptime) but are not
  shown in the game (spec Assumptions); they appear in data and the preview page only.
- **Rationale**: FR-003, User Story 4 descriptions; distinct drum patterns, bass lines and keys make
  SC-007 achievable; titles keep the network theme for reviewers (C1).
- **Alternatives**: One shared kit and bass for all songs with different melodies — would fail the
  "no two songs share drum pattern and bass line" rule and the listening check.

## M9 · Crossfade with a DJ-style bass swap

- **Decision**: Each live song has two gain buses: `bassBus` (parts with role `bass`) and `mainBus`
  (everything else), both into the existing music → duck → master chain. At the crossfade's first bar
  time T (bar line) with bar length B:
  - outgoing `mainBus`: equal-power fade 1 → 0 over [T, T + 2B]; incoming `mainBus`: 0 → 1 over the
    same span (`setValueCurveAtTime` with a cos/sin curve);
  - outgoing `bassBus`: 1 until T + B, then a 20 ms ramp to 0; incoming `bassBus`: 0 until T + B, then a
    20 ms ramp to 1;
  - the arranger also does not schedule notes for a silent bass bus (outgoing bass in crossfade bar 2,
    incoming bass in bar 1) to save CPU; after T + 2B the outgoing song is removed and its buses are
    disconnected.
  If a new song change arrives during a crossfade (only possible with the shortened timer), the
  outgoing song is cut with a 20 ms ramp, the current incoming song becomes the outgoing one at its
  current gains, and a new crossfade starts on the next bar — never more than two songs (FR-009).
- **Rationale**: FR-008, FR-008a, FR-009, SC-004. Equal-power keeps loudness steady through the fade;
  the 20 ms ramps avoid clicks (same constant as 002's RAMP_S).
- **Implementation note (2026-11-19, found in the user's Firefox test)**: the fades are scheduled as
  24 `linearRampToValueAtTime` segments, not `setValueCurveAtTime`. Firefox rejects a value curve that
  touches another scheduled event at the same time; the error made the audio fail over to "unavailable"
  at the first song change, so the music stopped. Chrome accepted it, so the scripted checks missed it.
- **Alternatives**: Linear crossfade — a perceptible dip mid-fade. Filtering out the incoming bass
  with an EQ instead of muting it — closer to a real DJ mixer but adds filter nodes for no audible gain
  at this length.

## M10 · Scheduling robustness on slow devices

- **Decision**: Keep the 25 ms timer, raise the look-ahead from 120 ms to 200 ms (fewer gaps when a
  phone's main thread stalls), and skip — not play late — any step whose time is already more than one
  step in the past; the grid position still advances. Gain automation for crossfades is scheduled at
  bar times on the audio clock, so a stall cannot shift it.
- **Rationale**: Spec edge case "slow phone": notes may drop, the beat grid and tempo never shift.
- **Alternatives**: A worklet-driven clock — more robust, more code; not needed at this note density.

## M11 · CPU budget

- **Decision**: Budget per song at full arrangement: ≤ 14 parts, ≤ 3 unison voices per note, ≤ 4 chord
  notes; validated limits: `unison ≤ 3`, chord size ≤ 4, parts per song ≤ 14. During a crossfade two
  songs play but their bass parts never overlap (M9). Measured by the existing desktop and 4×-throttled
  phone frame-rate checks (SC-008) plus a new check that counts audio nodes started per second.
- **Rationale**: Each note is ~3–6 nodes and lives ≤ 2.8 s; at 174 BPM a dense song starts ~40 notes per
  bar, comfortably below what phones handle while the game draws 300 enemies.
- **Alternatives**: Pre-rendering each song stage into AudioBuffers with OfflineAudioContext — cheaper
  at play time but a multi-second startup cost on phones and complex invalidation on stage changes.

## M12 · Data shape and validation

- **Decision**: `data/audio.json` `schemaVersion` becomes 2; `music` is replaced by the shape in
  data-model.md (`bpm`, grid constants, `songs[]`). `audio/content.js` validates it and every error
  names the song id and part id (`music.songs[2].parts[5] (neuro-packet-storm/reese)`), like 002 (C6,
  FR-016). Old fields (`bpmStart`, `bpmEnd`, `layers`) become unknown-field errors.
- **Rationale**: A clean break is simpler than supporting two music shapes; the file has one consumer.
- **Alternatives**: Keeping schemaVersion 1 with optional new fields — two code paths for no benefit.

## M13 · Supporting local listening: a music preview page

- **Decision**: Add `tests/music-preview.html` (not linked from the game): pick a song and a stage,
  toggle the incident layer, jump to bar 25 (to hear a fill and breakdown soon), trigger "next song"
  to hear a crossfade, and read the current song, stage, cycle bar and crossfade state. It uses the same
  `createAudio` and data as the game.
- **Rationale**: The user wants to test locally before any push, and SC-004, SC-007, SC-007a are human
  listening checks; listening through 20 minutes of play to reach song 5 is impractical.
- **Alternatives**: URL test settings in the game (`?song=…&level=…`) — possible, but a dedicated page is
  faster for side-by-side listening and does not grow the game's test-setting list.

## M15 · Automated stand-in for speaker audibility

- **Decision**: Browser check B11 renders 16 bars of each song's stage-4 arrangement with an
  `OfflineAudioContext` and measures (a) the song's bass parts alone (drums and chords excluded) in the
  150 Hz–1 kHz band against the same parts' sub band (< 100 Hz) — every `speakers` song must be no more
  than 20 dB below — and (b) each song's RMS loudness, which must
  be within 3 dB of the median song (tuned with `Song.gain`).
- **Rationale**: SC-007a (phone speaker) and loudness matching get an objective first check; the
  thresholds are starting points and the human check M-H5 has the final say.
- **Alternatives**: Human listening only — slow to iterate on and easy to miss a quiet song.

## M14 · What stays the same (and what is superseded)

- Unchanged: effects and their data, mute/volumes/defaults, ducking (`duckFactor`), suspend on hidden,
  the `?audioFail=1` path, the director's event→effect mapping and incident counting, start/stop rules.
- Removed: `bpmForLevel`, `layersForLevel` (director.js) and their tests; the 002 rule "a layer joins
  at every enemy debut level"; the 002 browser check B5 (rising tempo) is rewritten for 174 BPM and
  song blocks.
- Docs: 002 spec FR-005/006/007 and 004's incident-layer requirement get "superseded by 007" notes;
  002 contracts/audio-data.md points to 007 contracts/music-data.md for `music`.

## Baseline (feature 002 music) — recorded 2026-11-19 by T002

Measured on the build machine (headless Chrome 157) before any feature-007 change, for SC-008:

| Check | Result |
|-------|--------|
| B7 (desktop, 300 enemies, music on) | avg 16.7 ms (60 fps), p95 16.7 ms |
| T9 (390×844, CPU 4× slower) | 162 enemies: avg 60 fps, p95 16.7 ms, max 17 ms; 312 enemies: avg 52 fps, p95 33.4 ms, max 33 ms |

**After feature 007 (T041, full suite 2026-11-19):** B7 avg 16.7 ms (60 fps), p95 16.7 ms — same as the
baseline, within the SC-008 limit of +1 ms. T9: 162 enemies avg 60 fps, p95 16.8 ms, max 17 ms, quality level
0; 312 enemies avg 60 fps, p95 16.7 ms, max 17 ms, but the adaptive quality stepped down to level 1 (baseline:
level 0 at 52 fps). Both runs meet the existing limits; the quality step suggests a little more main-thread
work from the music at the heaviest load and is worth watching on real phones (feature 003 H-checks).
