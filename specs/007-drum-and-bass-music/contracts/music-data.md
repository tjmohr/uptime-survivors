# Contract: Music Data (`data/audio.json › music`, schemaVersion 2)

Field rules: [data-model.md](../data-model.md). Replaces the `music` section of
[002 contracts/audio-data.md](../../002-procedural-audio/contracts/audio-data.md); the `defaults`,
`mix` and `effects` sections are unchanged apart from the optional new Voice fields.

## Shape (abridged example — one song, some parts)

```json
{
  "schemaVersion": 2,
  "defaults": { "musicVolume": 60, "effectsVolume": 80, "muted": false },
  "mix": { "masterGain": 0.8, "duckFactor": 0.5, "maxConcurrentEffects": 8 },
  "effects": { "...": "unchanged from feature 002/004" },
  "music": {
    "bpm": 174,
    "stepsPerBar": 16,
    "levelsPerSong": 4,
    "crossfadeBars": 2,
    "cycleBars": 32,
    "fillBars": [8, 16, 24, 32],
    "breakdownBars": [29, 30, 31, 32],
    "ghostGain": 0.35,
    "songs": [
      {
        "id": "jump-up-handshake",
        "name": "Handshake",
        "style": "jump-up",
        "rootHz": 49.0,
        "bassAudibility": "speakers",
        "gain": 1.0,
        "parts": [
          { "id": "kick", "role": "drums", "instrument": "kick", "stage": 1,
            "pattern": ["x.........x....."],
            "voice": { "wave": "sine", "gain": 0.6, "attackMs": 1, "notes": [{ "freq": 160, "toFreq": 45, "ms": 140 }] } },
          { "id": "snare", "role": "drums", "instrument": "snare", "stage": 1,
            "pattern": ["....x.......x..."],
            "voice": { "wave": "noise", "gain": 0.3, "attackMs": 1, "filter": { "type": "bandpass", "hz": 1800, "q": 0.8 },
                       "notes": [{ "freq": 1800, "ms": 120 }] } },
          { "id": "sub", "role": "bass", "register": "sub", "stage": 1,
            "pattern": ["x.....x...x.....", "x.....x...x...x."],
            "notes": [0, 0, 3, 0, 0, -2, 5],
            "voice": { "wave": "sine", "gain": 0.5, "attackMs": 4, "notes": [{ "freq": 49, "ms": 300 }] } },
          { "id": "talker", "role": "bass", "register": "upper", "stage": 1,
            "pattern": ["x.....x...x.....", "x.....x...x...x."],
            "notes": [12, 12, 15, 12, 12, 10, 17],
            "voice": { "wave": "square", "gain": 0.22, "attackMs": 3, "drive": 0.4,
                       "filter": { "type": "lowpass", "hz": 700, "q": 6 },
                       "lfo": { "target": "filter", "steps": 2, "depth": 500 },
                       "notes": [{ "freq": 98, "ms": 300 }] } },
          { "id": "fill", "role": "fill", "stage": 1,
            "pattern": ["........x.x.xxxx"],
            "voice": { "wave": "noise", "gain": 0.22, "attackMs": 1, "filter": { "type": "bandpass", "hz": 1500 },
                       "notes": [{ "freq": 1500, "ms": 70 }] } },
          { "id": "hat", "role": "drums", "instrument": "hat", "stage": 2, "pattern": ["x.x.x.x.x.x.x.x."], "voice": { "...": "..." } },
          { "id": "stab", "role": "music", "stage": 3, "pattern": ["..x.....", "..."], "notes": [[0, 3, 7]], "voice": { "...": "..." } },
          { "id": "lead", "role": "music", "stage": 4, "pattern": ["...8 bars..."], "notes": ["..."], "voice": { "...": "..." } },
          { "id": "alarm", "role": "incident", "pattern": ["x.......x......."], "notes": [24, 23], "voice": { "...": "..." } }
        ]
      }
    ]
  }
}
```

## Validation error format

Same `{path, id, message}` objects as features 001/002, shown on the start screen instead of a run
(C6). For music, `id` is `"<songId>"` or `"<songId>/<partId>"`:

| Example input problem | Error |
|-----------------------|-------|
| `"bpmStart": 118` left over | `music.bpmStart` — unknown field 'bpmStart' |
| only 4 songs | `music.songs` — exactly 5 songs required (found 4) |
| two `jungle` songs | `music.songs[4].style` (`dancefloor-uptime`) — style 'jungle' is already used by 'jungle-backbone' |
| a pad at stage 1 | `music.songs[0].parts[6].stage` (`liquid-uplink/pad`) — stage 1 may only contain drums, fill, riser and bass parts |
| snare misses beat 4 | `music.songs[1].parts[1].pattern` (`jump-up-handshake/snare`) — the stage-1 snare or clap must hit steps 4 and 12 of every bar |
| 3 bars in a pattern | `…parts[3].pattern` (`…/sub`) — pattern must be 1, 2, 4 or 8 bars |
| 7 notes for 6 hits | `…parts[3].notes` (`…/sub`) — 7 notes for 6 hits |
| fill hit on step 2 | `…parts[4].pattern` (`…/fill`) — fill parts may only hit steps 8–15 |
| only 2 `speakers` songs | `music.songs` — at least 3 songs must have bassAudibility 'speakers' (found 2) |
| `speakers` song with sine-only bass | `music.songs[2]` (`neuro-packet-storm`) — a 'speakers' song needs a stage-1 upper bass part (not sine, ≥ 12 semitones above root or filter ≥ 300 Hz) |
| no 8-bar part | `music.songs[3]` (`jungle-backbone`) — at least one part must have an 8-bar pattern |
| `unison: 5` | `…voice.unison` — 'unison' must be at most 3 |
