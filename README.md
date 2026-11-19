# Uptime Survivors

A browser survivors-like (auto-attacking horde survival) with a network-engineering theme. You
play the network engineer. Network problems — dropped packets, latency spikes, broadcast storms,
route flaps, DDoS botnets — swarm in from every side. You only steer; your tools (Ping, Firewall
Rules, Ansible Playbooks, Load Balancers) fire on their own. Defeated problems drop telemetry,
which levels you up and lets you pick a new tool or upgrade. Difficulty climbs through 20
one-minute levels; keep the network's **Uptime** above 0% until the end of level 20 to win.

All names, art (code-drawn shapes), and text are original to this project. The game needs no
account, server, internet connection, or API key.

## Run it

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/** (on Windows use `py` instead of `python3`). Opening `index.html`
directly with `file://` is not supported — the game loads `data/game.json` over HTTP.

Testing URLs:

- Fixed seed: `http://127.0.0.1:8000/?seed=12345`
- Fast full run (each level 2 s, 40 s total): `http://127.0.0.1:8000/?seed=12345&levelSeconds=2`

## Test it

- **Browser**: with the server running, open **http://127.0.0.1:8000/tests/**.
- **Terminal**: `node tests/run.mjs` (Node 18+), or on macOS without Node:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs`.
  Both exit with code 0 only if every test passes; zero tests found counts as a failure.
- **Scripted browser checks** (needs Google Chrome): `python3 tests/browser/drive.py` runs the
  milestone and full-roster checks in headless Chrome against its own local server; add
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

## Status

First playable is built: all 5 enemies, 4 tools, 2 passives, and 20 difficulty levels. Automated and
scripted-browser checks pass (see Verification). **Still outstanding:** a human playthrough, the
5-player playtest (F10: SC-010, SC-011), a human review of the networking descriptions (SC-007), and
checks in browsers other than Chrome.

### Known limits

- Verification so far is automated or scripted (headless Chrome, synthetic key presses); no human
  has played it end to end yet.
- `node tests/run.mjs` has not been run (no Node on the verifying machine); the same tests pass in
  JavaScriptCore and in the browser.
- Only Chrome was tested; Firefox, Safari, and Edge are untested.
- With `?levelSeconds=2`, difficulty rises 30× faster than levelling, so those runs usually end in a
  loss; use `?levelSeconds=0.5` to see the win screen quickly.
- Not published to GitHub Pages. Serving the repo from a subpath (`/uptime-survivors/`) locally loads
  the game correctly.

## Verification

Scenarios are defined in
[`specs/001-survivors-first-playable/quickstart.md`](specs/001-survivors-first-playable/quickstart.md).
A checked task box is not evidence; this table is. Unrun checks stay visible as "not run".

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

## Project layout

```text
index.html, style.css, main.js   Page shell, styles, game loop and wiring
engine/                          Pure game rules (no DOM, seeded randomness)
ui/                              Canvas rendering, HUD, screens, input, URL params
data/game.json                   All enemies, tools, passives, difficulty, tuning
tests/                           Test harness, browser + terminal runners, tests
specs/001-survivors-first-playable/   Spec, plan, tasks, contracts, quickstart
```
