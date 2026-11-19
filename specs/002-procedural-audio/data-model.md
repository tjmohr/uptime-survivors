# Data Model: Procedural Audio

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Two kinds of data, as in feature 001:

1. **Authored sound data** — `data/audio.json`, validated before Start, then read-only. File shape:
   [contracts/audio-data.md](./contracts/audio-data.md).
2. **Session and runtime state** — in memory only; reset on page reload (no persistence).

**Units**: frequency in Hz, time in milliseconds (ms) unless named `bpm`, volume in percent (0–100),
gain as a linear multiplier (0–1).

## Authored sound data

### Audio Settings Defaults

| Field | Type | Rule |
|-------|------|------|
| `schemaVersion` | integer | Must equal `1` |
| `defaults.musicVolume` | integer | 0–100, multiple of 10 (spec: 60) |
| `defaults.effectsVolume` | integer | 0–100, multiple of 10 (spec: 80) |
| `defaults.muted` | boolean | Spec: `false` |
| `mix.masterGain` | number | > 0 and ≤ 1 |
| `mix.duckFactor` | number | > 0 and < 1 (spec: 0.5, FR-008) |
| `mix.maxConcurrentEffects` | integer | ≥ 1 (spec: 8, FR-003) |

### Voice

A synthesized sound shape, used by effects and by music layers.

| Field | Type | Rule |
|-------|------|------|
| `wave` | `sine` \| `square` \| `sawtooth` \| `triangle` \| `noise` | — |
| `notes` | array of Note | ≥ 1 entry; played one after another |
| `gain` | number | > 0 and ≤ 1 |
| `attackMs` | number | ≥ 0 |
| `filter` | optional `{type, hz}` | `type` is `lowpass`, `highpass`, or `bandpass`; `hz` > 0 |

**Note**: `{ "freq": number > 0, "toFreq": optional number > 0, "ms": number > 0 }` — a pitch that
optionally slides to `toFreq` over `ms`. For `noise` voices `freq` sets the filter centre if no
`filter` is given. A voice's total duration is the sum of its notes' `ms`.

### Sound Effect Definition

`effects` is an object with exactly these 10 keys (FR-001, clarifications Q2–Q3):
`fire`, `pulse`, `damage`, `hit`, `defeat`, `pickup`, `levelUp`, `newThreat`, `win`, `loss`.

| Field | Type | Rule |
|-------|------|------|
| `voice` | Voice | Total duration ≤ 1000 ms; ≤ 3000 ms for `win` and `loss` (FR-002) |
| `minIntervalMs` | number | ≥ 0 (spec: 60 for `fire`, `hit`, `defeat`, `pickup`, FR-003; shipped data also limits `damage` to 150 and `pulse` to 100 because `player-hit` can arrive every step) |

`win` and `loss` always play once at the end of a run and are not counted against
`mix.maxConcurrentEffects`.

### Music Definition

| Field | Type | Rule |
|-------|------|------|
| `music.bpmStart` | number | > 0 (plan: 118) |
| `music.bpmEnd` | number | ≥ 1.3 × `bpmStart` (FR-006; plan: 156) |
| `music.stepsPerBar` | integer | Must equal 16 |
| `music.layers` | array of Music Layer | ≥ 1; unique `id` |

**Music Layer**

| Field | Type | Rule |
|-------|------|------|
| `id` | kebab-case string | Unique among layers |
| `joinLevel` | integer | 1–20; difficulty level at which the layer starts playing |
| `pattern` | string | Exactly `stepsPerBar` characters, each `x` (play) or `.` (rest); at least one `x` |
| `voice` | Voice | Total duration ≤ 4 steps (one beat) at `bpmStart` — about 508 ms at 118 BPM (keeps hits short) |
| `pitches` | optional array of numbers > 0 | If present, successive hits cycle through these frequencies (bass line) |

Cross-file rules (checked with `data/game.json`):

- At least one layer has `joinLevel` 1 (music is audible from the start).
- For every enemy `debutLevel` in `data/game.json`, at least one layer has that `joinLevel` (FR-007).

## Session and runtime state (in memory)

### Audio Settings (page session)

`muted` (boolean), `musicVolume` (0–100), `effectsVolume` (0–100). Starts from `defaults`; changed by
M and the pause-screen controls; kept across runs; reset on reload (FR-011–FR-014).

### Audio State

| Field | Description |
|-------|-------------|
| `status` | `idle` (before first Start) → `running` \| `unavailable`; `suspended` while the page is hidden or unfocused |
| `ducked` | true while the game is paused or the level-up screen is open |
| `level` | Current difficulty level the music follows |
| `bpm` | `bpmStart + (bpmEnd − bpmStart) × (level − 1) / 19` |
| `activeLayers` | Layers with `joinLevel` ≤ `level` |
| `lastPlayed` | Per effect: time last played (for `minIntervalMs`) |
| `playing` | End times of effects currently sounding (for `maxConcurrentEffects`) |
| `counts` | Per effect and per layer: how many times played (for automated checks) |

### State transitions

```text
idle ──Start click──▶ running (music from bar 1, level 1)        [or unavailable on failure]
running ──run ends──▶ running, music stopped, win/loss effect played
running ──New Run / Replay Seed──▶ music restarts at bar 1, level 1
running ──page hidden / window blur──▶ suspended ──page visible / focus──▶ running (ducked: game is paused)
any ──M──▶ muted toggled (master gain 0 ↔ masterGain)
```

## Engine event additions (feature 001 contract)

| Event | Payload | When |
|-------|---------|------|
| `fire` | `{toolId}` | Once per volley when Ping or Load Balancer fires (not per projectile) |
| `pickup` | `{value}` | Each time a telemetry pickup is collected |

Existing events used: `pulse` (Ansible), `player-hit` (damage), `hit`, `enemy-defeated`, `level-up`,
`difficulty-up` (with `debuts` → new-threat sound when non-empty), `run-ended` (outcome).

## Event → sound mapping

| Engine event | Sound | Notes |
|--------------|-------|-------|
| `fire` | `fire` | Ping and Load Balancer share it |
| `pulse` | `pulse` | Ansible Playbook |
| `player-hit` | `damage` | Every Uptime loss |
| `hit` | `hit` | Includes Firewall Rule contacts |
| `enemy-defeated` | `defeat` | |
| `pickup` | `pickup` | |
| `level-up` | `levelUp` | Once per frame, however many level-ups |
| `difficulty-up` with debuts | `newThreat` | Also updates music level |
| `difficulty-up` | — | Updates music level only |
| `run-ended` | `win` or `loss` | Music stops first |
