# Uptime Survivors

A browser survivors-like (auto-attacking horde survival) with a network-engineering theme. You
play the network engineer. Network problems — dropped packets, latency spikes, broadcast storms,
route flaps, DDoS botnets — swarm in from every side. You only steer; your tools (Ping, Firewall
Rules, Ansible Playbooks, Load Balancers) fire on their own. Defeated problems drop telemetry,
which levels you up and lets you pick a new tool or upgrade. Difficulty climbs through 20
one-minute levels; keep the network's **Uptime** above 0% until the end of level 20 to win.

All names, art (code-drawn shapes), sound (synthesized in the browser), and text are original to
this project. The game needs no account, server, internet connection, or API key.

## Run it

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/** (on Windows use `py` instead of `python3`). Opening `index.html`
directly with `file://` is not supported — the game loads `data/game.json` and `data/audio.json`
over HTTP.

Testing URLs:

- Fixed seed: `http://127.0.0.1:8000/?seed=12345`
- Fast full run (each level 2 s, 40 s total): `http://127.0.0.1:8000/?seed=12345&levelSeconds=2`
  — also the quickest way to hear the music speed up and gain layers
- Sound failure path: `http://127.0.0.1:8000/?audioFail=1` (game plays silently, HUD says "Sound unavailable")

## Test it

- **Browser**: with the server running, open **http://127.0.0.1:8000/tests/**.
- **Terminal**: `node tests/run.mjs` (Node 18+), or on macOS without Node:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs`.
  Both exit with code 0 only if every test passes; zero tests found counts as a failure.
- **Scripted browser checks** (needs Google Chrome): `python3 tests/browser/drive.py` runs the
  milestone, full-roster, and sound checks in headless Chrome against its own local server
  (`--only audio` for just the sound checks); add
  `--full-run` for the real-time 20-minute run. They use synthetic key presses and, for long runs,
  test-only invincibility — they complement, not replace, a human playthrough.

## Controls

| Context | Keys |
|---------|------|
| Title | Enter / Space on **Start** |
| Playing | **WASD** or **arrow keys** to move (8 directions) |
| Playing | **Esc** or **P** to pause (also pauses automatically when the tab loses focus) |
| Level-up | **1**, **2**, **3**, or click / Tab + Enter |
| End screen | **New Run** (new seed) or **Replay Seed** (same seed) |
| Any screen | **M** to mute / unmute all sound |
| Paused | **Sound** on/off button, **Music** and **Effects** volume sliders (0–100% in 10% steps; arrow keys or mouse) |

## Sound

Nothing plays until you press **Start**. Then a minimal techno pulse plays behind the action: it
starts at 118 BPM with kick and bass, speeds up every difficulty level (156 BPM at level 20), and adds
a layer each time a new threat arrives (hats at 4, clap at 8, open hat and percussion at 12, a
filtered stab at 16). It is quieter while paused or choosing an upgrade, stops at the end of a run,
and restarts from the beginning for every new run.

Ten short effects mark the main events: Ping / Load Balancer firing (shared), the Ansible Playbook
pulse, the engineer taking damage, a hit (Firewall Rule contacts use it too), a defeat, telemetry
collected, level-up, a new threat, a win, and a loss. Repeats are rate-limited and at most 8 effects
sound at once, so a big horde never turns into a buzz.

Every sound is generated in code with the browser's Web Audio API — the repository contains no audio
files and nothing is downloaded. All sound design (voices, patterns, tempos, volumes, limits) is in
[`data/audio.json`](data/audio.json) and is validated with the game data before Start. Default
volumes are Music 60% and Effects 80%; settings last until you reload the page (nothing is saved).
Sound never changes gameplay: runs with the same seed and inputs are identical with sound on, muted,
or unavailable. Every sounded event keeps its visual feedback.

## Status

First playable is built: all 5 enemies, 4 tools, 2 passives, and 20 difficulty levels, plus
synthesized sound effects and music (feature 002). Automated and scripted-browser checks pass (see
Verification). **Still outstanding:** a human playthrough, the 5-player playtest (F10: SC-010,
SC-011), a human review of the networking descriptions (SC-007), human listening tests for the sound
(H1–H3), and checks in browsers other than Chrome.

### Known limits

- Verification so far is automated or scripted (headless Chrome, synthetic key presses); no human
  has played it end to end yet.
- `node tests/run.mjs` has not been run (no Node on the verifying machine); the same tests pass in
  JavaScriptCore and in the browser.
- Only Chrome was tested; Firefox, Safari, and Edge are untested — including their Web Audio output.
- Sound checks run in headless Chrome, which can report what is scheduled and the gain levels but
  cannot judge how it sounds. Nobody has listened to the sound yet (H1–H3 not run).
- With `?levelSeconds=2`, difficulty rises 30× faster than levelling, so those runs usually end in a
  loss; use `?levelSeconds=0.5` to see the win screen quickly.
- Not published to GitHub Pages. Serving the repo from a subpath (`/uptime-survivors/`) locally loads
  the game correctly.

## Verification

Scenarios are defined in
[`specs/001-survivors-first-playable/quickstart.md`](specs/001-survivors-first-playable/quickstart.md)
(M, F, SC rows) and [`specs/002-procedural-audio/quickstart.md`](specs/002-procedural-audio/quickstart.md)
(A, B, H rows: sound). A checked task box is not evidence; this table is. Unrun checks stay visible
as "not run". M1/F1 record the test count when feature 001 was verified; the current count is in A1–A5.

| # | Check | Result | Date | Environment | Evidence / notes |
|---|-------|--------|------|-------------|------------------|
| M1 | Automated tests | pass | 2026-11-19 | jsc (macOS JavaScriptCore) + Chrome 157 headless | 73/73 tests pass in `jsc -m tests/run.mjs` and at `/tests/`; zero-test guard reports failure. **`node tests/run.mjs` not executed** — Node is not installed on the verifying machine. |
| M2 | Start within 2 inputs | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Title shows with Start focused; run starts after 1 input. |
| M3 | 8-way movement | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Straight ≈ 160.0 u/s, diagonal ≈ 160.0 u/s; opposite keys cancel (unit test). |
| M4 | Ping auto-fires, telemetry drops | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Tools fired on their own: 11 problems resolved before the first level-up; telemetry collected. |
| M5 | Level-up with 3 choices | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) + engine simulation | 3 distinct choices with exact numbers; choice [1] applied. SC-002: first level-up at 17.7–53.4 s in 10/10 simulated seeded runs. |
| M6 | Loss screen | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Loss screen (`levelSeconds=2`, 30.2 s) shows outcome, time, difficulty, problems resolved, level, loadout, seed. |
| M7 | Fast run to win | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | `?seed=12345&levelSeconds=0.5`: win at 10.00 s; "New threat" banners shown; test-setting label shown. |
| M8 | Replay Seed | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Replay Seed reuses seed 12345; at tick 240 all 5 enemies match an independent replay of the seed exactly (original and replayed run). An earlier, looser version of this check passed by luck and was replaced. |
| M9 | Broken data rejected | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Duplicate id + missing field → "Game data has errors" naming `enemies[1].id` and `tools[0].ranks[0].damage`; no Start button. |
| SC-012 | Milestone playthrough | pass | 2026-11-18 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Core-loop milestone verified before the full roster was built: level-up with 3 choices, a loss, and a win via the test timer. Scripted, not yet played by a human. |
| F1 | Automated tests, full roster | pass | 2026-11-19 | jsc + Chrome 157 headless | 73/73 including split, blink, pulse, spread, regen, roster and debut-level tests. |
| F2 | New threats and behaviors | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | All 5 "New threat" banners (levels 1/4/8/12/16); all 5 enemy types seen; Broadcast Storm split into 3 copies; Route Flap blink observed. |
| F3 | All tools/passives offered | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | 30 level-ups chosen with keys 1–3: all 4 tools and 2 passives offered, never more than 4 tools owned, everything reached rank 5, then only Failover (fallback heal) offered. |
| F4 | 20-minute run | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`); test-only invincibility | Win at game time 1200 s; 1198.8 s of wall-clock play (70 level-up screens excluded; 1202.4 s total). SC-003 ±5 s met. |
| F5 | Smooth with ~300 enemies | pass | 2026-11-19 | Chrome 157 headless (software rendering) on the dev Mac | 300 enemies on screen: avg 16.7 ms/frame (60 fps), p95 16.7 ms, max 16.8 ms. Not yet checked on a typical workshop laptop or in a visible window. |
| F6 | Pause / tab switch | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | Esc paused (tick frozen for 1 s), P resumed, window blur auto-paused, Resume button resumed. Tab switching uses the same pause path; not separately exercised. |
| F7 | Same-origin requests only | pass | 2026-11-19 | Chrome 157 headless, macOS; scripted inputs (`tests/browser/drive.py`) | 18 resource requests during a run, 0 to other origins. |
| F8 | Networking concepts recognisable | pass (AI review) | 2026-11-19 | Claude (AI agent) review of data/game.json | All 11 names/concepts/descriptions map to real concepts (packet loss, latency/jitter, L2 broadcast storm, BGP flapping, DDoS, ICMP echo, ACLs, configuration automation, load balancing, link capacity, N+1 power). One misleading description (Redundant Power Supply) fixed. **A human reviewer has not yet confirmed SC-007.** |
| F9 | Reduced motion | pass | 2026-11-19 | Chrome 157 headless with/without `--force-prefers-reduced-motion` | Reduced motion on: 0 particles, 0 flash; off: particles and flash appear. |
| F10 | 5-player playtest | not run |  |  | Needs 5 first-time human players (SC-010, SC-011). Proxy only: a simple circling bot's runs end at difficulty 7–14 in 10 seeded simulations. |
| F11 | Originality review | pass | 2026-11-19 | Claude (AI agent) review | No image/audio/font files in the repo; all visuals are code-drawn shapes; no external URLs in shipped code; no third-party game names. "Ansible" is a real automation tool named deliberately (FR-022). |
| A1 | Sound data validation | pass | 2026-11-19 | jsc + Chrome 157 headless | Shipped `data/audio.json` passes; broken copies fail naming the path (missing/unknown effect, bad wave/filter, empty notes, effect > 1 s, win/loss > 3 s, pattern ≠ 16 steps or no `x`, layer voice > one beat, `bpmEnd` < 1.3 × `bpmStart`, no layer at level 1 or at a debut level, duplicate layer id, unknown fields, bad defaults/mix). In the browser, errors from both data files are listed together and Start is not offered. |
| A2 | Event → sound mapping | pass | 2026-11-19 | jsc + Chrome 157 headless | Each engine event maps to its effect; 3 level-ups in one frame → 1 `levelUp`; `run-ended` → one win/loss; events never mutated. |
| A3 | Effect limiting | pass | 2026-11-19 | jsc + Chrome 157 headless | Hit flood (9 per frame for 1 s): ≥ 60 ms between hit sounds; never more than 8 effects sounding; excess dropped, not queued; damage stream limited to 1 per 150 ms. |
| A4 | Tempo and layers | pass | 2026-11-19 | jsc + Chrome 157 headless | Tempo non-decreasing, 118 → 156 BPM (+32%); a new layer at each debut level 4, 8, 12, 16. |
| A5 | Determinism with sound | pass | 2026-11-19 | jsc + Chrome 157 headless | `fire` (once per volley, projectile tools only) and `pickup` events reported; identical `hashRun` with and without a director consuming events (the engine never sees mute/volume/availability, so this covers SC-006's on/muted/unavailable cases). 98/98 tests pass. |
| A6 | No audio files | pass | 2026-11-19 | `tests/browser/drive.py` file scan + source scan test | 0 audio files in the repository; `audio/*.js` contains no `fetch`, dynamic import, URLs, or `Audio` elements. |
| B1 | Silent title screen | pass | 2026-11-19 | Chrome 157 headless, autoplay allowed; scripted (`tests/browser/drive.py --only audio`) | Status `idle`, no audio context, nothing counted after 1 s on the title. |
| B2 | Sound on Start | pass | 2026-11-19 | Chrome 157 headless, autoplay allowed; scripted | Running ~105–135 ms after Start (SC-001 ≤ 500 ms); kick + bass playing; fire, hit, defeat, newThreat, pickup, levelUp and damage sounds counted; HUD "♪ Sound on (M)". Pulse is covered by A2 only (Ansible was not picked in that run). |
| B3 | Mute (M) | pass | 2026-11-19 | Chrome 157 headless, autoplay allowed; scripted | M on the title → run starts muted; M mid-run silences the master gain in ~65 ms (SC-002 ≤ 100 ms); unmute restores 60/80 volumes; window blur suspends sound and pauses, focus resumes with music ducked. |
| B4 | Pause-screen controls and ducking | pass | 2026-11-19 | Chrome 157 headless, autoplay allowed; scripted | Music ducked to 0.5 while paused and on level-up screens, back to 1 after; Sound button and Music/Effects sliders (0–100, step 10, labelled with %); arrow keys on a slider are left to it; Music 30% → gain 0.09; Effects 0% → effects silent while music continues; settings kept across Quit to Title and a new run, which restarts music at level 1. Slider values were set by script, not dragged. |
| B5 | Music builds through a run | pass | 2026-11-19 | Chrome 157 headless, autoplay allowed; scripted, `?levelSeconds=2`, test-only invincibility | Music heard at all levels 1–20; BPM 118 → 156 (×1.32), never decreasing; layers 2 → 3 → 4 → 6 → 7 at levels 4, 8, 12, 16; every layer played; music stopped at the end and exactly one win sound played. |
| B6 | Sound unavailable | pass | 2026-11-19 | Chrome 157 headless, `?audioFail=1` | Game keeps playing (120 ticks in 2 s); HUD and live region say "Sound unavailable"; no error screen. |
| B7 | Smooth with sound and ~300 enemies | pass | 2026-11-19 | Chrome 157 headless (software rendering) on the dev Mac | 300 enemies with sound on: avg 16.7 ms/frame (60 fps), p95 16.7 ms; hit sounds limited to a handful per 5 s. Same machine caveat as F5. |
| B8 | Same-origin, no audio downloads | pass | 2026-11-19 | Chrome 157 headless; scripted | 22 requests during a run, 0 to other origins, 0 audio files (`data/audio.json` is the only sound-related request). |
| Audio originality | Asset review (C1) | pass (AI review) | 2026-11-19 | Claude (AI agent) review of `data/audio.json` and `audio/synth.js` | All sound is oscillators, code-generated noise, envelopes and filters from data authored for this project; the patterns are generic four-on-the-floor techno figures and short blips, not taken from any game. A human has not reviewed this. |
| H1 | Listening test (SC-003) | not run |  |  | Needs a listener to match the 10 effects to their events (≥ 9 of 10). |
| H2 | Sound adds to the game (SC-008) | not run |  |  | Needs 5 playtesters (≥ 3 positive, none "harsh" after 5 minutes). Default volumes and effect voices are untuned starting values. |
| H3 | Music character | not run |  |  | Needs a listener to confirm a minimal techno pulse that builds with difficulty. |

## Project layout

```text
index.html, style.css, main.js   Page shell, styles, game loop and wiring
engine/                          Pure game rules (no DOM, seeded randomness)
ui/                              Canvas rendering, HUD, screens, input, URL params
audio/                           Sound: data validation and event→sound decisions (pure), Web Audio synth
data/game.json                   All enemies, tools, passives, difficulty, tuning
data/audio.json                  All sound design: effects, music layers, tempos, volumes, limits
tests/                           Test harness, browser + terminal runners, tests
specs/001-survivors-first-playable/   Spec, plan, tasks, contracts, quickstart
specs/002-procedural-audio/      Sound feature: spec, plan, tasks, contracts, quickstart
```
