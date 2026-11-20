# Contract: Audio Modules — changes for feature 007

Extends [002 contracts/audio-api.md](../../002-procedural-audio/contracts/audio-api.md). Anything not
listed here is unchanged (effects, director event mapping, mute/volume/duck, suspend/resume,
error handling: every synth method still catches its own errors and degrades to `unavailable`).

## `audio/arrange.js` — NEW, pure, no browser APIs (unit-tested in jsc)

| Export | Contract |
|--------|----------|
| `songOrder(seed, songs) → string[]` | Permutation of the 5 song ids from a dedicated generator seeded `(seed ^ 0x5eed0174) >>> 0`. Same seed → same order. Never reads `run.rng`. |
| `blockForLevel(level) → 0..4` | `floor((clamp(level,1,20) − 1) / 4)` |
| `stageForLevel(level) → 1..4` | `((clamp(level,1,20) − 1) mod 4) + 1` |
| `cycleBarOf(songBar, music) → 1..32` | `(songBar mod cycleBars) + 1` |
| `partsForBar(song, songBar, stage, incident, music) → [{part, fromStep, toStep}]` | Parts that sound in this bar with the step range they may play (fills/breakdowns per research M5). Cumulative stages; incident part only when `incident`. |
| `hitsForStep(entries, songBar, step, music) → [{part, gainScale, semitones \| semitones[] \| null}]` | The hits of those parts on one step (`x` → 1, `o` → `ghostGain`), with the note entry for pitched parts. |
| `crossfadeGains(barInFade, fraction) → {outMain, inMain, outBass, inBass}` | Equal-power main fade over 2 bars; bass swap at the bar-2 line (research M9). |
| `createArrangement(music) → Arrangement` | Sequencer state machine (data-model.md › Arrangement state): `start(seed, level)`, `queueLevel(level)`, `queueIncident(bool)`, `advanceBar() → {ended, cut, crossfade, songStart}`, `barPlan()` (each live song's parts this bar, bass swap applied), `live()`, `state()`, and `jumpTo(cycleBar)` for the preview page |

## `audio/director.js` — changed

- **Removed**: `bpmForLevel`, `layersForLevel` (superseded; the tempo is fixed and parts come from
  `arrange.js`).
- Unchanged: `createDirector`, `consume` (still reports `level` and `incidentActive`), `reset`, `counts`.

## `audio/content.js` — changed

| Export | Contract |
|--------|----------|
| `validateAudioData(raw, gameData)` | Accepts `schemaVersion: 2` only. Validates `music` per [music-data.md](music-data.md) and the extended Voice. Errors name the song and part: `{path: "music.songs[2].parts[5].pattern", id: "neuro-packet-storm/reese", message}`. Effects validation unchanged (effect voices may use the new Voice fields). The 002 debut-level cross-check is removed. |
| `SONG_STYLES` | `['liquid', 'jump-up', 'neurofunk', 'jungle', 'dancefloor']` |
| `PART_ROLES` | `['drums', 'fill', 'riser', 'bass', 'music', 'incident']` |

## `audio/synth.js` — changed

| Method | Contract |
|--------|----------|
| `audio.startMusic(seed, level = 1)` | Starts the sequencer at 174 BPM on the run's song order, placing song and stage from `level`. Called by `main.js` with `run.seed` for every new run, Replay Seed and New Run. |
| `audio.stopMusic()` | Stops scheduling; live songs' buses ramp to 0 in 20 ms and are disconnected. |
| `audio.setLevel(level)` | Queued; applied on the next bar line (stage change, or a crossfade if the block changes). |
| `audio.setIncident(bool)` | Unchanged semantics: the current song's incident part joins/leaves on the next bar line. |
| `createAudio(audioData, settings, options?)` | `options.context`: use this context instead of creating one (an `OfflineAudioContext` for B11); `options.outputFilters`: `[{type, hz}]` filters between master and destination (B11 bands). The game passes no options. |
| `audio.previewSong(songId, stage)` | **Preview page only**: starts music on that song at that stage (that song first, the rest in data order). Not called by the game. |
| `audio.previewStage(stage)` / `audio.previewNext()` | **Preview page only**: change the stage of the current song / crossfade into the next song at the same stage (on the next bar line). |
| `audio.previewJump(cycleBar)` | **Preview page only**: moves the current song's position so the next bar is `cycleBar` (via `arrangement.jumpTo`). |
| `audio.renderOffline(songId, stage, bars, onlyRoles?)` | **B11 only**, with `options.context` an `OfflineAudioContext`: schedules `bars` bars of the song at that stage (optionally only the given part roles) and resolves the rendered `AudioBuffer`. |
| `audio.stats()` | 002 fields except `bpm`, `activeLayers`, `layerCounts` move into `music` (data-model.md › Statistics, including `stepTimes` for measuring the tempo); `incidentMusic` stays top-level. `level` stays. |

Graph per live song: `mainBus` and `bassBus` (GainNodes) → existing `music` → `duck` → `master`. Song
`gain` applies to both buses' base level.

## `main.js` — wiring change only

`audio.startMusic(run.seed)` replaces `audio.startMusic()`. Everything else in the frame loop is
unchanged (`setLevel`, `setIncident`, `setDucked`, `stopMusic` on run end).

## `tests/music-preview.html` — NEW human-check page (research M13)

Not linked from the game. Controls: Start (user gesture), song picker (5), stage 1–4, incident toggle,
"Jump to bar 25", "Next song (crossfade)", Music volume. Read-out: song name/style, stage, cycle bar,
crossfade state, bass audibility. Uses the shipped `data/audio.json`; shows validation errors instead
of playing if the data is invalid.
