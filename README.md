# Uptime Survivors

A browser survivors-like (auto-attacking horde survival) with a network-engineering theme. You
play the network engineer. Network problems — dropped packets, latency spikes, broadcast storms,
route flaps, DDoS botnets — swarm in from every side. You only steer; your tools (Ping, Firewall
Rules, Ansible Playbooks, Load Balancers, Traceroute, Rate Limiters, Null Routes — carry up to four) fire
on their own. Defeated problems drop telemetry,
which levels you up and lets you pick a new tool or upgrade. Difficulty climbs through 20
one-minute levels; keep the network's **Uptime** above 0% until the end of level 20 to win.

All names, art (code-drawn shapes), sound (synthesized in the browser), and text are original to
this project. The game needs no account, server, internet connection, or API key.

## Run it

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Or play the published version: **https://tjmohr.github.io/uptime-survivors/** (desktop or phone).

Open **http://127.0.0.1:8000/** (on Windows use `py` instead of `python3`). Opening `index.html`
directly with `file://` is not supported — the game loads `data/game.json` and `data/audio.json`
over HTTP.

Testing URLs:

- Fixed seed: `http://127.0.0.1:8000/?seed=12345`
- Fast full run (each level 2 s, 40 s total): `http://127.0.0.1:8000/?seed=12345&levelSeconds=2`
  — also the quickest way to hear the music speed up and gain layers
- Sound failure path: `http://127.0.0.1:8000/?audioFail=1` (game plays silently, HUD says "Sound unavailable")
- Frame-rate overlay (for measuring phones): `?fps=1`

## Test it

- **Browser**: with the server running, open **http://127.0.0.1:8000/tests/**.
- **Terminal**: `node tests/run.mjs` (Node 18+), or on macOS without Node:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs`.
  Both exit with code 0 only if every test passes; zero tests found counts as a failure.
- **Late-game upgrade balance** (feature 006): `python3 tests/balance/parallel.py upgrades s1` (also `s2`, `s3`,
  `s4`) runs the seeds in parallel; `jsc -m tests/balance/upgrades.mjs -- s1 23` runs one seed.
- **Incident balance simulation** (slow: 10 full seeded runs): `jsc -m tests/balance/incidents.mjs -- s1`
  (resolve times and rewards) or `-- s2` (difficulty with vs. without incidents); add a seed (`-- s1 83`)
  to run one seed, e.g. several in parallel.
- **Scripted browser checks** (needs Google Chrome): `python3 tests/browser/drive.py` runs the
  milestone, full-roster, and sound checks in headless Chrome against its own local server
  (`--only audio` for just the sound checks, `--only touch` for the touch/mobile checks, which drive
  Chrome over its DevTools Protocol with real touch input and phone-sized screens); add
  `--full-run` for the real-time 20-minute run; `--only guide` runs the Field Guide checks. They use synthetic key presses and, for long runs,
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
| Paused | **Field Guide** button: an index of every network problem, tool, and passive (Esc, P, or **Back** returns to the pause screen) |
| Field Guide | **←/→** (or click / tap) to switch between *Network problems* and *Tools & passives*; **Tab** moves through the entries |
| Paused | **Sound** on/off button, **Music** and **Effects** volume sliders (0–100% in 10% steps; arrow keys, mouse, or touch) |

**Touch (phones and tablets):** touch anywhere and drag to steer — a joystick appears under your
finger, the engineer runs at full speed in that direction, and lifting your finger stops it. Use the
**❚❚** button to pause and **♪** to mute. On the level-up and pause screens, lift your finger first
and then tap: a finger that was already on the screen when the screen opened never selects
anything, and taps in the first half second are ignored, so upgrades are never picked by accident.

## Play on a phone

Open **https://tjmohr.github.io/uptime-survivors/** in Safari (iPhone) or Chrome (Android). Portrait
and landscape both work; on phones the view zooms out so you always see at least 330 game units in
every direction. The page does not scroll, zoom, or refresh while you play, and switching apps or
locking the screen pauses the game. On iPhone, the ring/silent switch can keep browser audio silent
even when the game's sound is on. Touch controls appear automatically on phones and tablets, and on
any other device as soon as its screen is touched; desktops that are never touched look unchanged.

## Major Incidents

Three times per run a **Major Incident** — a single, much larger enemy themed on a real network
incident — arrives with an alarm, a health bar in the HUD, an arrow at the screen edge while it is
off-screen, and a pulsing red "MAJOR INCIDENT" alert that stays on screen until you resolve it; then the
alert turns green ("RESOLVED") for a few seconds:

| Level | Incident | Real concept | What it does |
|-------|----------|--------------|--------------|
| 7 | **Route Leak** | BGP route leak | Releases bursts of small, fast enemies |
| 12 | **Core Switch Failure** | Single point of failure in the network core | Very tough; warns, then knocks one of your tools offline for 4 s (never your last one) |
| 18 | **Ransomware Outbreak** | Malware spreading laterally | Infects nearby enemies, making them tougher and faster until resolved |

Ordinary enemies spawn at half rate while an incident is active during its arrival level (after that
level the horde is back to full strength, even if the incident is still around). Resolve it and it drops one large,
glowing telemetry pickup worth about a level-up. An incident you don't resolve stays — into later
levels, even alongside the next one. The end screen lists each incident as resolved, unresolved, or
not reached. All incident numbers live in `data/game.json` and are validated before Start.

## Field Guide

Pause (Esc, P, or ❚❚) and choose **Field Guide** for an index of everything in the game, with the same
icons you see on the play field:

- **Network problems**: the five enemy types in the order they appear (levels 1, 4, 8, 12, 16), then the
  three Major Incidents with their arrival level — each with its name, the real networking concept
  behind it, and a description. Problems you have not met yet in this run are **locked** ("???", a grey
  outline, "Not yet encountered"); an entry unlocks as soon as that problem enters the game (even
  off-screen), and every new run starts locked again. Nothing is saved between runs.
- **Tools & passives**: every tool and passive (7 and 6) plus Capacity Planning, with their concept and description. Owned ones
  show their rank (of 5), the exact stats the game is using at that rank, and a **Next rank** line with
  only the stats that would change — the same numbers and wording as the level-up screen. Unowned ones
  say "Not owned" and show rank 1; a tool knocked out by Core Switch Failure says **OFFLINE**.

The game stays paused the whole time, and opening the guide changes nothing in the run.

## Late-game upgrades

You can carry **4 tools** out of 7, so each run is a build choice (every run starts with Ping). Six
passives shape the build, and once everything your run can still take is maxed, every level-up offers
**Capacity Planning** or **Failover** — never a dead level-up.

| Kind | Name | Real concept | What it does |
|------|------|--------------|--------------|
| Tool | **Traceroute** | Hop-by-hop path discovery | A bolt hits the nearest problem, then hops to further ones |
| Tool | **Rate Limiter** | Traffic policing | A field around you that slows problems (never Major Incidents) and wears them down |
| Tool | **Null Route** | Black-hole routing (RTBH) | A black hole on the densest cluster that damages everything inside for a few seconds |
| Passive | **QoS Policy** | Quality of Service | Shorter cooldowns for every tool (10–25%) |
| Passive | **Link Aggregation** | Link aggregation (LACP) | More damage from every tool (12–30%) |
| Passive | **Observability Stack** | Monitoring and observability | More telemetry from every pickup (15–40%) |
| Passive | **Hardened Config** | Device hardening | Less Uptime lost on contact (10–25%) |
| Repeatable | **Capacity Planning** | Capacity planning | +5% damage to all tools each time, no limit |

**Tool floor:** from difficulty 5 you need 2 tools, from 10 three, and from 15 four. If you are below
that, the level-up offers only new tools ("Your network needs more tools: choose one."), so a run never
drifts into passives with only Ping. The new passives are strongest early on (e.g. Link Aggregation
+12% at rank 1), so an early passive pick still pays off.

Failover now restores 15% of maximum Uptime (was 20%). Wherever a tool's numbers are shown (level-up,
Field Guide) a bonus from passives or Capacity Planning appears next to the rank value, e.g.
"Damage 12 (13.92 with bonuses)" — the same number the game uses.

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

First playable is built: all 5 enemies, 7 tools, 6 passives, Capacity Planning, and 20 difficulty levels, plus
synthesized sound effects and music (feature 002). Automated and scripted-browser checks pass (see
Verification), and touch play on phones and tablets (feature 003) is checked in emulated phones with
real touch input. **Still outstanding:** a human playthrough, checks on real phones (feature 003
H1–H5) and a phone playtest (H6), the 5-player playtest (F10: SC-010, SC-011), a human review of the networking descriptions (SC-007), human listening tests for the sound
(H1–H3), Field Guide checks with a real screen reader, on real phones, and a playtest (GH1–GH3), and
checks in browsers other than Chrome. The Field Guide (feature 005) passes its automated and scripted
checks.

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
- Late-game upgrades (feature 006): balance was tuned with scripted bots only (tool floor and front-loaded passives
  came out of that); whether the tool floor feels forced, and whether the game is now too easy for strong
  players, needs the playtest (L-H2).
- Major Incidents balance: in simulation, incidents make strong late-game runs much harder (I-S2) — an
  open balance question. (An ignored incident used to halve spawning for as long as it lived; since
  2026-11-19 the half rate applies only during its arrival level.)
- Touch checks run in headless Chrome emulating phones; that is not Safari and not a real phone.
  Real-device checks (H1–H5) and the phone playtest (H6) have not been run. Performance on older or
  mid-range phones is only approximated (CPU throttled 4× on the dev Mac) and is unverified.
- On a touchscreen laptop, after the screen has been touched, the level-up and pause screens also
  ignore mouse clicks for their first half second (the touch guard applies to the whole screen).
  Keyboard selection is never delayed.

## Verification

Scenarios are defined in
[`specs/001-survivors-first-playable/quickstart.md`](specs/001-survivors-first-playable/quickstart.md)
(M, F, SC rows) and [`specs/002-procedural-audio/quickstart.md`](specs/002-procedural-audio/quickstart.md)
(A, B, H rows: sound), and [`specs/003-mobile-touch/quickstart.md`](specs/003-mobile-touch/quickstart.md)
(U, T, and "Phone H" rows: touch and mobile), and [`specs/004-major-incidents/quickstart.md`](specs/004-major-incidents/quickstart.md)
("I-" rows: Major Incidents), and [`specs/005-field-guide/quickstart.md`](specs/005-field-guide/quickstart.md)
(G, GB, GH rows: Field Guide), and [`specs/006-late-game-upgrades/quickstart.md`](specs/006-late-game-upgrades/quickstart.md)
("L-" rows: late-game upgrades). A checked task box is not evidence; this table is. Unrun checks stay visible
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
| U1 | Any-angle movement input | pass | 2026-11-19 | jsc + Chrome 157 headless | 0°, 30°, 45°, 137°, 300° move exactly `moveSpeed` in that direction; short drags still full speed; values beyond ±1 clamp; NaN/Infinity/strings count as 0. Keyboard inputs give identical state hashes (existing determinism tests unchanged). 113/113 tests pass. |
| U2 | Touch replay determinism | pass | 2026-11-19 | jsc + Chrome 157 headless | A recorded 1,800-step sequence of arbitrary-angle inputs replays to an identical hash (SC-007). |
| U3 | Joystick math | pass | 2026-11-19 | jsc + Chrome 157 headless | Dead zone (10% of 56 px) → no movement; unit direction beyond it; base follows the finger past the edge; no NaN when finger = base. |
| U4 | Tap guard timing | pass | 2026-11-19 | jsc + Chrome 157 headless | Held-at-open finger blocks until lifted; nothing before 500 ms; exactly 500 ms arms; unrelated fingers do not block. |
| U5 | View distance | pass | 2026-11-19 | jsc + Chrome 157 headless | Short side always shows ≥ 330 game units (320×480 to 2560×1440); 1400×1000 desktop scale unchanged (1.3034); 390×844 → 0.591 in either orientation. |
| T1 | Touch mode | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol (emulated 390×844 phone, real touch events) | Phone: touch mode on at load, touch reminder on title, Pause/Sound buttons ≥ 44 px. Desktop (no touch): no touch UI during a run; first touch turns it on. |
| T2 | Touch steering | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | Drag at 30° → heading 30.0° at exactly 160 u/s (`moveSpeed`), moving on the first frame after the drag; stops ~30 ms after lifting (SC-002 ≤ 100 ms); joystick shown/hidden; second finger ignored; touch on HUD text steers; Pause button pauses without steering. |
| T3 | Everything by tap | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | Sound running ~150 ms after the Start tap (FR-019); Sound button mutes/unmutes; 3 upgrades chosen; pause, both sliders set by touch (30% / 50%), Sound toggle, Resume, Quit to Title, New Run, Replay Seed (same seed) — all by tap. Every control has visible text or a label; no hover-only tooltips (FR-021). |
| T4 | Tap guard | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | Finger held when level-up opened, lifted over a choice → nothing chosen; tap 50 ms after opening ignored, tap after 500 ms chose and play resumed within ~90 ms; pause screen: Resume ignored while the held finger stays down, dragging it across the Music slider changed nothing; keyboard 1 not delayed. |
| T5 | Page stays put | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | Vigorous drags, double tap, 1.2 s long press, pull-down from the top, pinch: no scroll, zoom 1, no reload, no selection, no context menu. Desktop without touch: text still selectable. Headless Chrome is not iOS Safari — see Phone H2. |
| T6 | Fit and safe area | pass | 2026-11-19 | Chrome 157 headless, emulated safe-area insets (47/34 px portrait, 47/47/21 px landscape) | 360×640, 390×844, 844×390, 768×1024, 1024×768: title, HUD, level-up, pause, and end screens all inside the viewport and safe area, no panel scrolling, no page overflow. Landscape phones show level-up choices side by side. |
| T7 | Rotation | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | 390×844 → 844×390 mid-run: re-fit within ~70 ms including protocol round-trips; same run (seed, phase playing, ticks continuing); view 330 units. |
| T8 | View distance on screen | pass | 2026-11-19 | Chrome 157 headless | Phones 330 units, tablets 384 units each way; desktop 1400×1000 scale 1.3034 = feature 001. |
| T9 | Slow-device proxy (SC-004) | pass (proxy) | 2026-11-19 | Chrome 157 headless, 390×844, CPU throttled 4× on the dev Mac | ~160 enemies: avg 60 fps, max 17 ms; ~310 enemies: avg ~55 fps, p95 ~33 ms, max ~33 ms; quality governor stayed at level 0 (never needed). Throttling slows scripts only, not drawing, so this is a weak stand-in for a real mid-range phone. |
| T10 | Hidden page | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol | `pagehide` → game paused, sound suspended. `visibilitychange`/`blur` share the same handler (001 F6, 002 B3). |
| T11 | Desktop unchanged | pass | 2026-11-19 | Chrome 157 headless; jsc | All 001 checks (M2–M9, F2–F9) and 002 checks (A1, A6, B1–B8) pass after feature 003; desktop render scale unchanged. |
| FR-021 | No hover-only information | pass | 2026-11-19 | T3 + inspection | Every button and slider has visible text or an accessible label; no `title` tooltips. |
| Phone H1 | Full run by touch on real phones | not run |  |  | Needs the current iPhone (Safari) and Android phone (Chrome): title to end screen and a second run, touch only (SC-001). |
| Phone H2 | Page stays put on real phones | not run |  |  | 5 minutes of vigorous play: no scroll, zoom, refresh, or menu (SC-003). iOS pinch/double-tap handling is the main risk. |
| Phone H3 | Fit, notch, rotation on real phones | not run |  |  | Both orientations; nothing behind the notch; rotation keeps the run. |
| Phone H4 | Frame rate on real phones | not run |  |  | Open `?fps=1&seed=99`, play until ~300 enemies: ≥ 55 fps avg, no freeze > 0.25 s (SC-004). Older/mid-range phones: unverified. |
| Phone H5 | Sound on real phones | not run |  |  | Starts on the Start tap; ♪ button mutes; note iPhone silent-switch behaviour. |
| Phone H6 | Phone playtest (SC-008) | not run |  |  | 5 people on their own phones: ≥ 3 finish a first run without instructions and find the controls comfortable; no accidental choices. |
| I-U1 | Incident data validation | pass | 2026-11-19 | jsc + Chrome 157 headless | Shipped incidents valid (levels 7/12/18); 19 broken copies rejected naming the incident and path, incl. duplicate arrival level, id clash with an enemy/tool, unknown behaviour kind/field/minion, link-down timing, radius not larger than every enemy, contact damage not above the strongest enemy at the arrival level (FR-007). |
| I-U2 | Arrival | pass | 2026-11-19 | jsc | Arrive on the first step of levels 7/12/18 (also with `levelSeconds`), 720 u away, within 330 u by 2 s; records active; one event each; seeded direction. |
| I-U3 | Behaviours | pass | 2026-11-19 | jsc | Route Leak bursts of 6, ≤ 18 alive, none at the enemy cap; Core Switch Failure warns 1.5 s ahead, 4 s outage, warnings ≥ 12 s apart, never the last tool, offline tools don't fire, restored on resolution; Ransomware ×1.5 health / ×1.3 speed once per enemy, cleared on resolution. |
| I-U4 | Resolution and reward | pass | 2026-11-19 | jsc | One reward pickup with `rewardTelemetry` at the incident's position, no ordinary drop; collecting adds exactly its value; reward pickups survive the pickup cap; contact drains at the incident's rate. |
| I-U5 | Lingering and overlap | pass | 2026-11-19 | jsc | Unresolved incident keeps its arrival strength; two active at once; ordinary spawning × 0.5 only while an incident is active during its arrival level (not compounded); full rate once that level ends or it is resolved. |
| I-U6 | Run integrity | pass | 2026-11-19 | jsc | Full 20-level run (short levels) still ends in a win at `runLength` with all incidents reached; same seed + inputs → identical hash; pause/level-up freeze incidents. 133/133 tests pass. |
| I-U7 | Incident sound | pass | 2026-11-19 | jsc | 12 effects validated; incident layer rules (`trigger` xor `joinLevel`, exactly one); alarm/resolution always play even with 8 effects sounding; incident-active flag. |
| I-S1 | Resolve time and reward (SC-002) | pass (re-run 2026-11-19) | 2026-11-19 | `tests/balance/incidents.mjs`, 10 seeds, "focused play" bot (circles ~150 u from the incident), invincible, first upgrade each level-up | Route Leak 28–67 s, 8/10 in 30–60 s, reward ≈ 0.77–0.89 level-ups; Core Switch Failure 32–49 s, 10/10, ≈ 0.90–1.05; Ransomware Outbreak 46–55 s, 10/10, ≈ 1.00–1.13. Data: health 1200 / 2600 / 3400, rewards 72 / 160 / 260; softened 2026-11-19 (contact damage 30 / 35 / 45 per s; Ransomware infection radius 140, ×1.25 health, ×1.15 speed). A plain circling bot outran the incidents and resolved none, so "focused play" is part of this measurement. **Re-run 2026-11-19 with feature 006 content (final: tool floor + front-loaded passives): pass** — Route Leak 10/10, Core Switch Failure 8/10, Ransomware Outbreak 7/10 resolved in 30–60 s; rewards ≈ 0.68–1.07 level-ups. (With the starting feature 006 values Core Switch Failure fell to 4/10; the balance changes recorded under L-S4 fixed it.) |
| I-S2 | Difficulty with incidents (SC-003 proxy) | **fail** | 2026-11-19 | Same simulation, not invincible | Median end level unchanged (7 vs 7), but the 4 seeds that win without incidents all lose with them (end levels 18, 5, 7, 12, 18, 18, 6, 5, 6, 7 vs 20, 5, 7, 20, 20, 20, 6, 5, 6, 7). Tracing a loss showed the bot dying to the ordinary (partly infected) horde while circling the incident at close range with a fully maxed build — not to the incident itself: softening the incidents changed no outcome, a wider 260 u orbit stopped the bot resolving incidents at all (tools aim at the nearest enemy, so the horde shields the incident), and making projectile tools aim at incidents first (tried, then reverted) did not restore any win. So this proxy mostly measures the bot's tactics; the ≥ 7/10-in-7–14 rule also fails for the baseline (2/10). Needs a human playtest (I-H2). **Re-run 2026-11-19 with feature 006 content:** still fail — with incidents 18, 7, 7, 12, 20, 3, 5, 4, 8, 12 (median 7.5, 5/10 in 7–14) vs without 20, 7, 17, 10, 14, 3, 5, 4, 8, 13 (median 9). |
| I-B1 | Arrival in the browser | pass | 2026-11-19 | Chrome 157 headless, `?levelSeconds=4` | Banner "MAJOR INCIDENT — Route Leak — BGP route leak", live-region announcement, alarm, HUD bar, edge pointer while off-screen, fully on screen ~1.7 s after arrival, incident music layer on. **2026-11-19 (feature 006):** now a standing red pulsing alert line, still up 6 s after arrival; announcement no longer overwritten by the same-step "Difficulty 7" banner. |
| I-B2 | Behaviours in the browser | pass | 2026-11-19 | Chrome 157 headless | Leak bursts seen; Core Switch Failure warning shown twice and a tool shown OFFLINE; infected enemies seen. |
| I-B3 | Resolution in the browser | pass | 2026-11-19 | Chrome 157 headless | "RESOLVED — Route Leak", resolution sound, one reward worth 72 drawn 2.5× size, collecting it raises telemetry, its pointer disappears. **2026-11-19 (feature 006):** the alert line turns green "RESOLVED — Route Leak" (steady) and is removed after 3.0 s. |
| I-B4 | Overlap | pass | 2026-11-19 | Chrome 157 headless | Route Leak kept alive: two incidents, two HUD bars, pointer for the second, both behaviours running, incident music on. |
| I-B5 | End summary | pass | 2026-11-19 | Chrome 157 headless | "Route Leak ✓ resolved · Core Switch Failure ✗ unresolved · Ransomware Outbreak — not reached". |
| I-B6 | Phones and performance | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol, emulated safe areas | 390×844 and 844×390: incident panel and pointers inside the safe area, clear of the touch buttons; incident + ~300 enemies: 60 fps (p95 16.7 ms), CPU 4× slower: 60 fps. **2026-11-19 (feature 006):** also 360×640 and 640×360; the standing alert sits below the HUD, inside the safe area, clear of the incident panel and touch buttons (first try overlapped the touch buttons at 360×640; fixed by placing it under the measured HUD bottom). |
| I-B7 | Regression | pass | 2026-11-19 | Chrome 157 headless; jsc | All feature 001–003 checks pass after two fixes found by this run: the roster check now ignores incidents when counting enemy types, and the end screen got a compact layout for small phones (the new Incidents row made it scroll at 360×640). |
| I-B8 | Standing alerts: two incidents, reduced motion | pass | 2026-11-19 | Chrome 157 headless (B4, B7) | Two active incidents → two red alert lines; with reduced motion the line is red without pulsing. |
| I-H1 | Concepts recognisable (SC-006) | not run |  |  | Needs a reviewer to name each incident's concept from its banner. |
| I-H2 | Incident playtest (SC-003, SC-007) | not run |  |  | Needs 5 players; especially to judge I-S2's finding that strong runs now tend to end at an incident. |
| G1–G6 | Field Guide unit tests (content, locking, stats for every rank, icons, no change, determinism) | pass | 2026-11-19 | jsc | 146/146 tests pass, including 12 new guide tests and the G6 determinism test: every tool and passive at ranks 1–5 matches the engine's rank tables and the level-up wording; building the guide leaves `hashRun` unchanged mid-run with two incidents and an offline tool. |
| GB1 | Guide opens with problems and locking | pass | 2026-11-19 | Chrome 157 headless, `?levelSeconds=4` | Pause shows Resume / Field Guide / Quit to Title; at level 8 the guide shows 5 enemies + 3 incidents, 8/8 matching the data or locked exactly as `run.encountered` says (met: Dropped Packet, Latency Spike, Route Leak); SVG shapes match the play-field vertices. |
| GB2 | Keyboard, Esc / P / Back, nothing changes | pass | 2026-11-19 | Chrome 157 headless | Arrows / Home / End switch tabs; Tab reaches all 8 entries with nothing else after the tabs (SC-001); Esc, P, and Back each return to the pause screen with focus on Field Guide; tick and `hashRun` unchanged after 3 s open and three open/close cycles. |
| GB3 | Tools & passives numbers | pass | 2026-11-19 | Chrome 157 headless | Ping rank 3, Load Balancer rank 1 OFFLINE, Bandwidth Upgrade rank 5 (no next line), three "Not owned" at rank 1 — every line equals the model and level-up wording, e.g. "Next rank: Damage 15 → 18 · Cooldown 0.6 s → 0.5 s". |
| GB4 | Accessibility attributes | pass | 2026-11-19 | Chrome 157 headless | tablist / 2 tabs / tabpanel with aria-controls, aria-selected, aria-labelledby; entries labelled by name; icons aria-hidden; no locked names or descriptions in the guide's DOM. |
| GB5 | Phones | pass | 2026-11-19 | Chrome 157 headless via DevTools Protocol, emulated safe areas, real touch input | 360×640 and 640×360: pause screen (three buttons + sound) and guide fit inside the safe area, no clipped entry, Back/tabs ≥ 44×44; a drag scrolls the list (145 px) while the page stays put and selects nothing; Back ignored within 500 ms and while another finger is down, works after lifting; run unchanged. CPU 4× slower: entries shown 4 ms after the tap registers. |
| GB6 | Regression (all features) | pass | 2026-11-19 | Chrome 157 headless; jsc | Full `python3 tests/browser/drive.py`: 46/46 checks pass (features 001–005, sound, touch, incidents, guide) after the pause-screen button and the shared shape code; `jsc -m tests/run.mjs` 146/146. |
| GH1 | Screen reader (VoiceOver) | not run |  |  | Needs a person with VoiceOver on macOS or iOS. |
| GH2 | Real phones | not run |  |  | Needs the feature 003 iPhone and Android. |
| GH3 | Field Guide playtest (SC-006) | not run |  |  | Needs 5 players. |
| L-U1–L-U8 | Late-game upgrade unit tests (data, effective stats, Traceroute, Rate Limiter, Null Route, passives, offers incl. tool floor, determinism) | pass | 2026-11-19 | jsc | 165/165 tests pass (19 new): every broken-data case named (incl. tool floor rules); bonuses add (Link Aggregation + Capacity Planning) and QoS shortens cooldown/hit cooldown only; measured hit amounts and fire timing match `effectiveToolStats`; Traceroute hop count/range; Rate Limiter slows ordinary enemies, never incidents, damages both; Null Route on the densest problem, 5 ticks over 2.5 s, ≤ 8 zones; passives change values by exactly their data %; below the tool floor offers are only new tools, above it unrestricted; exhausted pool → exactly [Capacity Planning, Failover], Failover 15%; hashes cover zones, slow field, Capacity Planning. |
| L-S1 | Pool lasts (SC-001) | pass | 2026-11-19 | `python3 tests/balance/parallel.py upgrades s1`, 10 seeds, invincible, tools-first bot | 10/10 runs still have upgrades at difficulty 12; most run out at 18–20 or never (was ~8–12 before this feature). |
| L-S2 | Never Failover-only (SC-002) | pass | 2026-11-19 | Same runs, 5 level-ups past exhaustion | 22 offers after the pool ran out, all exactly [Capacity Planning, Failover]. |
| L-S3 | Build variety (SC-003) | pass | 2026-11-19 | 20 seeds, random choices | 14 distinct 4-tool builds. |
| L-S4 | Fair difficulty (SC-004) | pass | 2026-11-19 | 10 seeds, not invincible, three player bots, each vs. a baseline without the new content, tool floor, or 15% heal | Median end level: tools-first 5.5 vs 4.5; random choices 5.5 vs 7; always choice 1 7.5 vs 7; 0 wins in every case. Reached after two balance changes the first results called for: the **tool floor** (5/10/15) and **front-loaded passives** (with the starting values, random and first-choice players were 2.5–3 levels worse). History in `specs/006-late-game-upgrades/contracts/game-data.md`. |
| L-B1 | New tools in the browser | pass | 2026-11-19 | Chrome 157 headless | Traceroute path, Rate Limiter ring, and Null Route zone drawn; 12 problems resolved by the new tools alone in ~5 s; sounds: fire, pulse, hit all counted. |
| L-B2 | Level-up text | pass | 2026-11-19 | Chrome 157 headless | Tool choices show the rank value plus "(X with bonuses)" equal to `effectiveToolStats` (e.g. "Damage 15 (17.55 with bonuses) · Cooldown 3 s (2.7 s with bonuses)"); below the tool floor the note "Your network needs more tools: choose one." and three new tools; maxed run → exactly [1] Capacity Planning "Taken 0× … All tool damage +0% → +5%" and [2] Failover "Restore Uptime +15%"; key 1 takes Capacity Planning. |
| L-B3 | Field Guide and HUD | pass | 2026-11-19 | Chrome 157 headless | Guide lists 7 tools, 6 passives, and Capacity Planning ("Taken 2× · All tool damage +10%"), each with an icon; Ping stats show "(13.92 with bonuses)"; HUD shows "Capacity Planning ×2". |
| L-B4 | Regression and performance | pass | 2026-11-19 | Chrome 157 headless (incl. DevTools-driven phones); jsc | Final run (with the tool floor, front-loaded passives, and standing incident alerts): full `python3 tests/browser/drive.py` 51/51 checks pass (features 001–006) in 709 s; `jsc -m tests/run.mjs` 165/165. 300 enemies with all three new tools at rank 5: 60 fps (p95 16.8 ms); phone fit T6 passes at 360×640 to 1024×768 with the longer level-up text; throttled phone T9 55–60 fps. The first full run found a real bug (stat lines built with `.map(describeStatChange)` showed "(0 with bonuses)"; fixed by a separate `describeStatWithBonus`) and three Major Incident checks that timed out once; they pass alone, as a group, and in the full re-run. |
| L-H1 | Concepts recognisable (SC-005) | not run |  |  | Needs a reviewer to name each new item's concept from its name and description. |
| L-H2 | Late-game playtest (SC-006) | not run |  |  | Needs 5 players; also judge whether the tool floor feels forced. |

## Project layout

```text
index.html, style.css, main.js   Page shell, styles, game loop and wiring
engine/                          Pure game rules (no DOM, seeded randomness); incidents.js = Major Incidents;
                                 stats.js = tool stats after passive / Capacity Planning bonuses
ui/                              Canvas rendering, HUD, screens, keyboard + touch input, URL params;
                                 pure helpers joystick.js, tapguard.js, view.js; touchmode.js;
                                 Field Guide model guide.js, icons.js, stattext.js (pure)
audio/                           Sound: data validation and event→sound decisions (pure), Web Audio synth
data/game.json                   All enemies, tools, passives, difficulty, tuning
data/audio.json                  All sound design: effects, music layers, tempos, volumes, limits
tests/                           Test harness, browser + terminal runners, tests; balance/ = incident simulation
specs/001-survivors-first-playable/   Spec, plan, tasks, contracts, quickstart
specs/002-procedural-audio/      Sound feature: spec, plan, tasks, contracts, quickstart
specs/003-mobile-touch/          Touch and mobile feature: spec, plan, tasks, contracts, quickstart
specs/004-major-incidents/       Major Incidents feature: spec, plan, tasks, contracts, quickstart
specs/005-field-guide/           Field Guide feature: spec, plan, tasks, contracts, quickstart
specs/006-late-game-upgrades/    Late-game upgrades feature: spec, plan, tasks, contracts, quickstart
```

## License

Copyright (c) 2026 TJ M. All rights reserved. No permission is granted to use, copy, modify, or
distribute this work without written permission — see [LICENSE](LICENSE).
