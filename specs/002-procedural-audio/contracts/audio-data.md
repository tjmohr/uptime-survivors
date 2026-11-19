# Contract: Sound Data File (`data/audio.json`)

Field meanings and rules: [data-model.md](../data-model.md). This file fixes the JSON shape.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "defaults": { "musicVolume": 60, "effectsVolume": 80, "muted": false },
  "mix": { "masterGain": 0.8, "duckFactor": 0.5, "maxConcurrentEffects": 8 },
  "effects": {
    "fire": { "minIntervalMs": 60, "voice": { /* Voice */ } },
    "pulse": { ... }, "damage": { ... }, "hit": { ... }, "defeat": { ... },
    "pickup": { ... }, "levelUp": { ... }, "newThreat": { ... }, "win": { ... }, "loss": { ... }
  },
  "music": {
    "bpmStart": 118,
    "bpmEnd": 156,
    "stepsPerBar": 16,
    "layers": [ /* Music Layer objects */ ]
  }
}
```

## Examples

A short downward blip (effect voice):

```json
{ "minIntervalMs": 60,
  "voice": { "wave": "square", "gain": 0.18, "attackMs": 1,
             "notes": [ { "freq": 1320, "toFreq": 880, "ms": 45 } ] } }
```

A noise burst (hat-like), filtered:

```json
{ "wave": "noise", "gain": 0.12, "attackMs": 0,
  "filter": { "type": "highpass", "hz": 7000 },
  "notes": [ { "freq": 8000, "ms": 30 } ] }
```

A music layer (bass line cycling through pitches on each hit):

```json
{ "id": "bass", "joinLevel": 1,
  "pattern": "..x...x...x...x.",
  "pitches": [55, 55, 65.41, 49],
  "voice": { "wave": "sawtooth", "gain": 0.22, "attackMs": 2,
             "filter": { "type": "lowpass", "hz": 420 },
             "notes": [ { "freq": 55, "ms": 110 } ] } }
```

## Validation output

`validateAudioData(raw, gameData)` returns `{ ok: true, data }` or `{ ok: false, errors }`, with the
same error shape as `validateGameData` (`{ path, id, message }`), e.g.:

```json
{ "path": "music.layers", "id": null, "message": "no music layer joins at debut level 12 (route-flap)" }
```

Unknown fields are errors. Both files are validated before Start; all errors from both are listed on
the existing "Game data has errors" screen.

## Feature 004 additions

Feature 004 (Major Incidents) adds two effects, `incidentAlarm` and `incidentResolved` (up to 3000 ms,
always played — never dropped by the repeat interval or concurrency cap), and one music layer with
`"trigger": "incident"` in place of `joinLevel`, which plays while any incident is active. See
[specs/004-major-incidents/contracts/ui-audio.md](../../004-major-incidents/contracts/ui-audio.md).
