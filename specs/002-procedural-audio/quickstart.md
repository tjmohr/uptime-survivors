# Quickstart & Validation Guide: Procedural Audio

How to hear and check the audio feature. Files and commands below are created during
implementation; until then this is the agreed checklist.

## Run and test

Same as feature 001 ([../001-survivors-first-playable/quickstart.md](../001-survivors-first-playable/quickstart.md)):

```sh
python3 -m http.server 8000 --bind 127.0.0.1    # then open http://127.0.0.1:8000/
node tests/run.mjs                                # or: jsc -m tests/run.mjs (macOS)
python3 tests/browser/drive.py                    # scripted headless checks (Chrome)
```

Useful URLs: `?levelSeconds=2` to hear the tempo climb in 40 s; `?seed=12345` to repeat a run.

## Validation scenarios

Record each as **pass / fail / not run** with date and environment in the README (constitution C7).

### Automated (unit tests)

| # | Check | Expected |
|---|-------|----------|
| A1 | `data/audio.json` validation | Shipped file passes; broken copies (missing effect, bad wave, pattern length ≠ 16, `bpmEnd` < 1.3 × `bpmStart`, no layer at a debut level, unknown field) fail naming the path |
| A2 | Director mapping | Each engine event maps to the right effect; several `level-up` in one frame → one `levelUp` |
| A3 | Director limiting | A flood of `hit` events → at most one per 60 ms; never more than 8 effects sounding |
| A4 | Tempo and layers | Tempo never decreases across levels 1–20 and is ≥ 30% faster at 20; a layer joins at each debut level |
| A5 | Determinism | Same seed and inputs give the same state hash with the new `fire`/`pickup` events, and the director never changes `run` |
| A6 | No audio files | Repository contains no audio files; `audio/` source fetches nothing |

### Scripted browser (headless Chrome)

| # | Check | Expected |
|---|-------|----------|
| B1 | Title screen | Audio status `idle`; nothing scheduled |
| B2 | Press Start | Status `running` within 0.5 s (SC-001); music layers playing; effects counted during play |
| B3 | Press M twice | Muted then unmuted; volumes unchanged (SC-002) |
| B4 | Pause screen | Sound toggle and Music/Effects sliders present; changing them changes the gains; music ducked while paused and on level-up screens |
| B5 | Fast run (`levelSeconds=2`) | `bpm` rises each level; layers added at 4, 8, 12, 16; music stops and `win`/`loss` plays at the end |
| B6 | Audio unavailable (context creation forced to fail) | Game plays; HUD shows "Sound unavailable" |
| B7 | 300 enemies with sound on | Frame pacing as feature 001 F5 (SC-005) |
| B8 | Network | No requests to other origins (SC-007) |

### Human

| # | Check | Expected |
|---|-------|----------|
| H1 | Listening test (SC-003) | A listener matches the 10 effects to their events ≥ 9 of 10 |
| H2 | Feel (SC-008) | 3 of 5 playtesters say sound adds to the game; none call it harsh after 5 minutes |
| H3 | Music character (clarification Q1) | Heard as a minimal techno pulse that builds with difficulty |
