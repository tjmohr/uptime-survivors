# Quickstart & Validation Guide: Uptime Survivors — First Playable

How to run the game and prove each part of the spec works. The files and commands below are
created during implementation; until then this is the agreed checklist, not a record of results.

## Prerequisites

- A desktop browser (current Chrome, Firefox, Edge, or Safari).
- Python 3 (to serve the files). Node.js 18+ is optional, for the terminal test runner.
- No install step, account, API key, or internet connection.

## Run the game

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/**. (On Windows, use `py` instead of `python3`.) Opening
`index.html` directly with `file://` is not supported — the game loads its data over HTTP.

Testing URLs (see [contracts/ui-controls.md](./contracts/ui-controls.md#url-parameters-testing-only)):

- Fixed seed: `http://127.0.0.1:8000/?seed=12345`
- Fast full run (40 s, usually a loss): `http://127.0.0.1:8000/?seed=12345&levelSeconds=2`
- Very fast run to see the win screen (10 s): `http://127.0.0.1:8000/?seed=12345&levelSeconds=0.5`
- Terminal tests without Node (macOS): `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs`

## Run the automated tests

- Browser: with the server running, open **http://127.0.0.1:8000/tests/**. The page shows total
  passed/failed and the names of failed tests. Zero tests found counts as a failure.
- Terminal: `node tests/run.mjs` — same tests; exits with code 0 only if all pass.
- Scripted browser checks (needs Google Chrome): `python3 tests/browser/drive.py` runs M2–M9, F2, F3,
  F5, F6, F7, F9 in headless Chrome against its own local server; add `--full-run` for the real-time
  20-minute F4 check. These use synthetic key presses (and test-only invincibility for long runs), so
  they complement — not replace — a human playthrough.

## Validation scenarios

Record each as **pass / fail / not run** with date, browser, and notes in the README's
verification table (C7). Unrun checks stay visible as "not run".

### Core-loop milestone (FR-029, SC-012) — must pass before building the remaining roster

| # | Scenario | Expected |
|---|----------|----------|
| M1 | Automated tests | All pass in browser and terminal |
| M2 | Fresh load → press Start | Run starts within 2 inputs (SC-001); Uptime 100%, Ping equipped |
| M3 | Move with WASD and arrows, including diagonals | Smooth 8-way movement; diagonal not faster |
| M4 | Stand still near Dropped Packets | Ping fires on its own; enemies drop telemetry |
| M5 | Collect telemetry until the bar fills | Game pauses; 3 distinct choices with exact numbers; chosen effect visible after resume (SC-002: within 60 s) |
| M6 | Let enemies reach the engineer | Uptime drops; loss screen with all stats and seed |
| M7 | `?seed=12345&levelSeconds=0.5`, survive | "Difficulty N / 20" advances every 0.5 s; Latency Spike banner at 4; win screen after 10 s. (With `levelSeconds=2` difficulty climbs 30× faster than levelling, so that 40 s run usually ends in a loss — use it for loss/banner checks.) |
| M8 | End screen → Replay Seed | Opening spawns match the previous run with the same seed |
| M9 | Break `data/game.json` (duplicate ID, missing field) | Error screen names the item; no Start (SC-009) |

### Full first playable (FR-030 and the rest of the spec)

| # | Scenario | Expected |
|---|----------|----------|
| F1 | Automated tests incl. all 5 enemies, 4 tools, 2 passives | All pass |
| F2 | Fast run with fixed seed | New-threat banners at levels 4, 8, 12, 16; Broadcast Storm splits; Route Flap blinks; DDoS Botnet is large and slow |
| F3 | Level up repeatedly | All 4 tools and 2 passives can be offered; max 4 tools; maxed items never offered; fallback heal when nothing is left |
| F4 | Normal-speed full run (20 min) | Run length 20 min ± 5 s (SC-003); win screen |
| F5 | Late difficulty with ~300 enemies on screen | No visible stutter or input lag (SC-005); note device |
| F6 | Pause with Esc/P; switch tabs | Nothing advances while paused or hidden |
| F7 | Developer tools → Network, play a run | Only same-origin requests (SC-008) |
| F8 | Reviewer reads every enemy/tool/passive description | Names the real networking concept for each (SC-007) |
| F9 | Reduced-motion setting on | No flashes, shake, or particle bursts |
| F10 | Playtest with 5 first-time players | SC-010 (3 of 5 want another run) and SC-011 (3 of 5 first runs end at levels 8–14; 3 of 5 win within 3 runs) |
| F11 | Originality review of names, descriptions, drawn shapes, UI text, and repository files | No third-party game names, characters, or assets (FR-025, constitution C1) |
