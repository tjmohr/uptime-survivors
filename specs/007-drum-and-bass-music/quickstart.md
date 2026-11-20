# Quickstart: Validating the Drum & Bass Soundtrack (feature 007)

Everything runs locally on the `007-drum-and-bass-music` branch; nothing is pushed or merged until the
user has listened and asked for it.

## Prerequisites

- macOS with Google Chrome (browser checks) — Node is not required.
- From the repository root, serve the files: `python3 -m http.server 8000 --bind 127.0.0.1`

## 1 · Unit tests (rules, no browser)

```sh
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs
```

Expected: `RESULT: PASS`. The new `tests/music.test.js` and updated `tests/audio-content.test.js` cover:

| ID | Check | Spec |
|----|-------|------|
| M-U1 | Shipped data validates; `bpm` is 174; 5 songs, one per style; ≥ 3 `speakers` songs | FR-001, FR-003, FR-002a |
| M-U2 | `songOrder`: a permutation; same seed → same order; seeds 1–30 give ≥ 10 orders and every song first at least once | FR-006, SC-002, SC-003 |
| M-U3 | Block/stage mapping for levels 1–20; songs change exactly at 5, 9, 13, 17 | FR-005 |
| M-U4 | Stage 1 = drums + bass (+ fill/riser) only; part count never decreases across stages | FR-010, SC-005 |
| M-U5 | Phrase cycle: drums stop at step 8 on bars 8/16/24, silent on 29–32, back on 33; fills only on 8/16/24/32 | FR-013a/b |
| M-U6 | Crossfade gains: equal-power main over 2 bars; bass out after bar 1, in from bar 2; never both basses | FR-008, FR-008a |
| M-U7 | Arrangement: a level change mid-bar applies on the next bar; two levels in one bar both join; a song change during a crossfade cuts the outgoing song (≤ 2 live) | FR-009, FR-011, edge cases |
| M-U8 | Validation rejects each example in contracts/music-data.md with the right path and `song/part` id | FR-016, C6 |
| M-U9 | The arrangement never reads `run.rng`: a seeded run's hash is identical after `songOrder` calls; `arrange.js` contains no browser APIs | FR-007, SC-006, C5 |

## 2 · Browser checks (scripted, headless Chrome)

```sh
python3 tests/browser/drive.py --only audio      # sound checks incl. the rewritten music checks
python3 tests/browser/drive.py --only incidents  # incident layer still joins/leaves
python3 tests/browser/drive.py --only T9         # throttled phone frame rate with music on
python3 tests/browser/drive.py                   # full suite before any merge
```

| ID | Check | Spec |
|----|-------|------|
| B5 (rewritten) | Shortened-timer run (`?seed=7&levelSeconds=3`): gaps between consecutive `stats().music.stepTimes` (ignoring skipped steps) are 86.2 ± 0.2 ms (60/174/4) at every sample, including during song and stage changes; `songStarts` lists 5 different songs at levels 1, 5, 9, 13, 17 in `songOrder(7)` order; stage follows the level; every song started on a bar line | FR-001, FR-005, FR-006, SC-001, SC-002 |
| B9 (new) | Replay Seed twice with seed 7 → same `order` and same `songStarts` song ids | FR-006, SC-002 |
| B10 (new) | During a song change: crossfade lasts 2 bars (2.76 ± 0.1 s by the audio clock); `liveSongs` ≤ 2 at every sample; no bass part counted for the outgoing song after bar 1 or the incoming before bar 2 | FR-008, FR-008a, FR-009, SC-004 (scripted half) |
| B11 (new) | Render 16 bars of each song's stage-4 arrangement offline: (a) for every `speakers` song, its bass parts alone measure no more than 20 dB lower in the 150 Hz–1 kHz band than in the sub band (< 100 Hz); (b) each song's RMS loudness is within 3 dB of the median song | FR-002a, SC-007a (automated stand-in, research M15) |
| B12 (new) | `?seed=7&levelSeconds=3`: (a) mute before difficulty 5, unmute after difficulty 6 starts → `songStarts` already lists block 2's song and `stage` is 2; (b) `pagehide`/`pageshow` mid-crossfade → `liveSongs` is 1 within 2 bars after return and the song is not recorded in `songStarts` twice | Edge cases: muted, tab hidden mid-crossfade |
| B1–B4, B6–B8 (002) | Effects, mute, volumes, ducking, hidden tab, audio failure, no audio files fetched — still pass | FR-014, FR-015, SC-009 |
| B7 / T9 | Frame rate with music on, desktop and 4× throttled phone — within the existing limits | SC-008 |
| incidents B1–B4 | `incidentMusic` true while an incident is active | FR-012 |

## 3 · Listen locally (human checks)

Open the preview page: **http://127.0.0.1:8000/tests/music-preview.html** → press Start.

| ID | How | Pass when | Spec |
|----|-----|-----------|------|
| M-H1 | Play each song at stage 4 for 30 s | You can tell all five apart and match ≥ 4 to Liquid / Jump-up / Neurofunk / Jungle / Dancefloor | SC-007 |
| M-H2 | For one song, step through stages 1 → 4 | Stage 1 is drums + bass; each stage adds something; nothing drops out | FR-010 |
| M-H3 | "Jump to bar 25" | Fill at bar 32's lead-in is preceded by a fill at bar 24; drums drop out for bars 29–32 and slam back in on the drop | FR-013a |
| M-H4 | "Next song (crossfade)" several times | Smooth 2-bar blend on the beat; old bass stops and new bass enters cleanly at the bar line; no click or gap | SC-004 |
| M-H5 | On a phone speaker (or the laptop speaker), play each song | The bass line is easy to follow in at least 3 songs | SC-007a |
| M-H6 | Incident toggle on/off | The incident layer fits the song's key and beat; joins/leaves on a bar line | FR-012 |

Then play the game itself: **http://127.0.0.1:8000/?levelSeconds=10** (each level 10 s, so a song
lasts 40 s and the whole soundtrack ~3.5 min). Check that music starts with the run, ducks on pause and
level-up, follows M / the Sound button / Music volume, and stops at the end screen; Replay Seed should
replay the same song order.

## 4 · Record results

Record every check as pass / fail / not run in the README's verification table (C7), including the
human checks M-H1…M-H6.
