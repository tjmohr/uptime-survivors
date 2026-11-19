# Contract: Audio Modules (`audio/`) and Engine Event Additions

## Engine (feature 001) — event additions only

`engine/weapons.js` and `engine/combat.js` push two new events to `run.events`. No state, timing, or
randomness changes; `hashRun` is unaffected (events are not hashed).

| Event | Payload | Emitted |
|-------|---------|---------|
| `fire` | `{toolId}` | Once per volley of a `projectile-nearest` or `spread` tool |
| `pickup` | `{value}` | Once per collected telemetry pickup |

Feature 001's `contracts/engine-api.md` event table is updated accordingly.

## `audio/content.js` — pure, no browser APIs

| Export | Contract |
|--------|----------|
| `validateAudioData(raw, gameData) → {ok, data} \| {ok:false, errors}` | Never throws. Rules in [data-model.md](../data-model.md), including the debut-level cross-check against `gameData.enemies`. |
| `EFFECT_NAMES` | The 10 effect keys, in a fixed order |

## `audio/director.js` — pure, no browser APIs

Decides *what* should sound; knows nothing about how sound is made. Unit-tested in Node/jsc.

| Export | Contract |
|--------|----------|
| `bpmForLevel(audioData, level) → number` | Linear from `bpmStart` (level 1) to `bpmEnd` (level 20) |
| `layersForLevel(audioData, level) → Layer[]` | Layers with `joinLevel ≤ level`, in data order |
| `createDirector(audioData)` | Returns a director with the methods below |
| `director.consume(events, nowMs) → Plan` | Maps one frame's events to `{effects: string[], level: number \| null, runEnded: 'win' \| 'loss' \| null}`. Applies `minIntervalMs` per effect, at most one request per effect per call, at most `maxConcurrentEffects` sounding at `nowMs` (uses each effect's voice duration), and drops the excess. The end-of-run sound is reported only in `runEnded` (not in `effects`) and is always accepted. Never mutates `events`. |
| `director.reset()` | Forget timing state (new run) |
| `director.counts` | Requests accepted per effect name |

## `audio/synth.js` — browser only (Web Audio)

| Export | Contract |
|--------|----------|
| `createAudio(audioData, settings) → Audio` | Creates nothing yet; status `idle`. |
| `audio.start() → Promise<status>` | Must be called from a user gesture. Creates the context and gain chain; resolves `running` or `unavailable` (never rejects). |
| `audio.play(effectName)` | Schedules that effect's voice now; no-op unless `running`. |
| `audio.startMusic()`, `audio.stopMusic()` | Start the sequencer from bar 1 at level 1 / stop it. |
| `audio.setLevel(level)` | Tempo and layers change at the next bar boundary. |
| `audio.setDucked(bool)`, `audio.setMuted(bool)`, `audio.setMusicVolume(pct)`, `audio.setEffectsVolume(pct)` | 20 ms gain ramps. |
| `audio.suspend()`, `audio.resume()` | Page hidden/unfocused and back. |
| `audio.stats() → {status, muted, musicVolume, effectsVolume, ducked, level, bpm, activeLayers, effectCounts, layerCounts}` | For the debug handle and browser checks. |

Every method catches its own errors; an exception turns `status` into `unavailable` and the game
continues (FR-020).

## Wiring (`main.js`)

Each frame, after stepping: `plan = director.consume(run.events, now)`; play `plan.effects`; apply
`plan.level` with `audio.setLevel`; on `plan.runEnded` call `stopMusic()` then play `win`/`loss`.
`setDucked(run.phase === 'paused' || run.phase === 'levelup')` every frame.
