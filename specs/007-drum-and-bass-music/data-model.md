# Data Model: Drum & Bass Soundtrack (feature 007)

Content lives in `data/audio.json` (schemaVersion 2), validated by `audio/content.js` before any run
(C6, FR-016). Runtime state lives in `audio/arrange.js` (pure) and `audio/synth.js` (Web Audio).
Unchanged entities from feature 002 (Audio Settings, Mix, Effect, Note) are not repeated.

## Music (`audio.json › music`)

| Field | Type | Rule |
|-------|------|------|
| `bpm` | number | > 0; shipped value 174 (pinned by a test) |
| `stepsPerBar` | integer | exactly 16 |
| `levelsPerSong` | integer | exactly 4 (blocks 1–4, 5–8, 9–12, 13–16, 17–20) |
| `crossfadeBars` | integer | exactly 2 |
| `cycleBars` | integer | exactly 32 |
| `fillBars` | integer[] | exactly `[8, 16, 24, 32]` |
| `breakdownBars` | integer[] | exactly `[29, 30, 31, 32]` |
| `ghostGain` | number | > 0 and < 1 (gain multiplier for `o` hits) |
| `songs` | Song[] | exactly 5; one per style (see below) |

The fixed-value fields are kept in data (not code) so that the rules are visible to a reviewer and
the arranger reads one source; the validator pins them to the agreed values.

## Song (`music.songs[i]`)

| Field | Type | Rule |
|-------|------|------|
| `id` | string | kebab-case, unique among songs |
| `name` | string | non-empty (not shown in game; preview page only) |
| `style` | enum | `liquid` \| `jump-up` \| `neurofunk` \| `jungle` \| `dancefloor`; each used by exactly one song |
| `rootHz` | number | 30–110 (the sub's root note) |
| `bassAudibility` | enum | `speakers` \| `headphones`; at least 3 songs are `speakers` (FR-002a) |
| `gain` | number | > 0 and ≤ 1.5; per-song loudness trim applied to both song buses |
| `parts` | Part[] | 4–14 parts; ids unique within the song |

Song-level rules (each error names the song id):

- **Stage 1 is drums and bass only** (FR-010): every part with `stage: 1` has role `drums`, `fill`,
  `riser` or `bass`; at least one `drums` part with `instrument: "kick"`, one with `instrument:
  "snare"` or `"clap"`, and one `bass` part have `stage: 1`. A `riser` part with `stage: 1` must use
  `wave: "noise"`; risers built from pitched oscillators need `stage ≥ 2`.
- **Each later stage adds something**: for s = 2, 3, 4 at least one part has `stage: s`.
- **Backbeat on 2 and 4** (FR-002): a stage-1 `drums` part with `instrument` `snare` or `clap` hits
  (`x`) steps 4 and 12 of every bar.
- **Hats**: at least one `drums` part with `instrument: "hat"` has `stage ≤ 2`.
- **Fills**: at least one `fill` part with `stage: 1`.
- **Incident**: exactly one part with role `incident` (it has no `stage`).
- **Loop length** (FR-013): at least one part has an 8-bar pattern.
- **Bass is the loudest pitched part** (FR-002): the largest `voice.gain` among `bass` parts ≥ the
  `voice.gain` of every `music` and `incident` part.
- **Speaker-audible bass** (FR-002a): a `speakers` song has a `stage: 1` `bass` part with
  `register: "upper"`, whose wave is not `sine`, and whose lowest played pitch is ≥ 12 semitones above
  the root or whose filter cutoff (`hz`, or `toHz` if lower) is ≥ 300 Hz.
- **Distinct songs** (User Story 4 scenario 2): no two songs have identical (stage-1 kick pattern +
  snare pattern) **and** identical (stage-1 sub bass pattern + notes).

## Part (`songs[i].parts[j]`)

| Field | Type | Rule |
|-------|------|------|
| `id` | string | kebab-case, unique within the song |
| `role` | enum | `drums` \| `fill` \| `riser` \| `bass` \| `music` \| `incident` (behaviour: research M5) |
| `instrument` | enum | required for `drums`: `kick` \| `snare` \| `clap` \| `hat` \| `perc`; optional otherwise |
| `register` | enum | `bass` parts only, optional: `sub` \| `upper` |
| `stage` | integer | 1–4; required for all roles except `incident` (forbidden there) |
| `pattern` | string[] | 1, 2, 4 or 8 bars; each exactly 16 chars of `x`, `o`, `.`; at least one `x` or `o` overall |
| `notes` | (number \| number[])[] | required for `bass`, `music`, `incident`; optional for others. One entry per hit (count must equal the number of `x`/`o` in the pattern); each entry a semitone offset from `rootHz` (−24…+48) or a chord of 2–4 offsets |
| `voice` | Voice | see below; duration ≤ 2 bars at `bpm` (≈ 2759 ms at 174) |

- `fill` parts: hits only on steps 8–15 of each bar string.
- Pitched playback: hit k plays at `rootHz × 2^(notes[k]/12)`; the voice's notes are transposed so its
  first note lands there (same transposition rule as feature 002's `pitches`). Unpitched parts play
  the voice as written.

## Voice (extended from feature 002)

Existing fields `wave`, `gain`, `attackMs`, `filter {type, hz}`, `notes [{freq, toFreq?, ms}]` are
unchanged. New optional fields (defaults reproduce the 002 sound exactly, so effects are unaffected):

| Field | Type | Rule / default |
|-------|------|----------------|
| `unison` | integer | 1–3, default 1; extra oscillators detuned ±`detuneCents`; not allowed with `noise` |
| `detuneCents` | number | 0–50, default 0 |
| `filter.toHz` | number | > 0; filter cutoff glides from `hz` to `toHz` over the voice duration |
| `filter.q` | number | 0.1–20, default 1 (Web Audio default) |
| `lfo` | object | `{ target: "filter" \| "gain", steps: 1–32 (period in 16th steps), depth }`; `depth` is Hz for `filter` (0–4000) and a 0–1 fraction for `gain`; needs `filter` when target is `filter` |
| `drive` | number | 0–1, default 0 (no shaper node is created at 0) |

## Runtime state (not in data)

### Soundtrack order — `arrange.songOrder(seed, songs)`
A permutation of the 5 song ids from a dedicated generator seeded by `(seed ^ 0x5eed0174) >>> 0`
(research M3). Never touches `run.rng`.

### Arrangement state — `arrange.js`, owned by synth's sequencer

| Field | Meaning |
|-------|---------|
| `order` | the run's song order (5 ids) |
| `bar` | global bar counter since `startMusic` (0-based) |
| `step` | 0–15 within the bar |
| `level` / `pendingLevel` | current level and the one queued for the next bar line |
| `block` | `floor((level − 1) / 4)`, 0–4 |
| `stage` | `((level − 1) mod 4) + 1` |
| `incident` / `pendingIncident` | incident layer on/off, applied at the next bar line |
| `live` | 1 or 2 live songs: `{ songId, startBar, role: 'current' \| 'outgoing' }` |
| `crossfade` | `null` or `{ from, to, startBar }` (2 bars from `startBar`) |

State transitions (all on bar lines):

```text
startMusic(seed, level=1)  → order = songOrder(seed); live = [order[block(level)] @ bar 0]; stage = stage(level)
bar line, pendingLevel set:
   same block      → stage = stage(pendingLevel)
   new block       → crossfade = {from: current, to: order[newBlock], startBar: bar}; stage = stage(pendingLevel)
                     (if a crossfade is already running: cut its 'from' song, its 'to' becomes 'from')
bar == crossfade.startBar + 2 → remove outgoing song; crossfade = null
stopMusic / run ended → everything stops; next startMusic starts fresh (FR-014)
```

### Per-bar part selection — `arrange.partsForBar(song, songBar, stage, incident)`
Returns the parts that may sound in this bar and, for `drums` on fill bars, that they stop at step 8
(research M5). `songBar` is `bar − startBar` of that song; `cycleBar = (songBar mod 32) + 1`.

### Bus gains — `arrange.crossfadeGains(barInFade, fraction)`
Pure function returning `{ outMain, inMain, outBass, inBass }` for a position in the 2-bar crossfade:
equal-power for main (`cos`/`sin` of `fraction·π/2` over both bars), step for bass (out = 1, in = 0 in
bar 1; out = 0, in = 1 in bar 2). synth.js turns these into scheduled gain automation (research M9).

### Statistics exposed for tests — `audio.stats().music`
`{ bpm, order, songId, stage, block, bar, cycleBar, crossfade, liveSongs, activeParts, partCounts,
songStarts: [{songId, bar, level}], skippedSteps, stepTimes }` — `stepTimes` holds the last 64
scheduled step times on the audio clock (seconds), so tests measure the real tempo — read by the browser checks; replaces the 002
`bpm`/`activeLayers`/`layerCounts` fields (`incidentMusic` stays).
