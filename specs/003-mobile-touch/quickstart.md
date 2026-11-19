# Quickstart & Validation Guide: Mobile and Touch Play

Files and commands below are created during implementation; until then this is the agreed checklist.

## Run and test

```sh
python3 -m http.server 8000 --bind 127.0.0.1    # desktop: http://127.0.0.1:8000/
node tests/run.mjs                                # or: jsc -m tests/run.mjs (macOS)
python3 tests/browser/drive.py                    # all scripted checks, desktop + touch (Chrome)
python3 tests/browser/drive.py --only touch       # just the touch/mobile checks
```

On a phone: open the published GitHub Pages URL (or the laptop's LAN address with
`--bind 0.0.0.0`). Useful URLs: `?levelSeconds=2` (40 s run), `?seed=12345`.

## Validation scenarios

Record each as **pass / fail / not run** with date and environment in the README (constitution C7).

### Automated (unit tests)

| # | Check | Expected |
|---|-------|----------|
| U1 | Engine analog input | Any angle moves at full speed; values beyond ±1 clamp; NaN → 0; keyboard inputs give the same state hash as before (existing determinism tests unchanged) |
| U2 | Touch replay determinism | A recorded sequence of arbitrary-angle inputs replays to an identical hash |
| U3 | `joystickStep` | Dead zone → {0, 0}; unit direction beyond it; base follows past the radius ([contracts/input.md](./contracts/input.md)) |
| U4 | Tap guard | Rejects taps while a held-at-open pointer is down or before 500 ms; accepts a new tap after both ([data-model.md](./data-model.md) › Tap Guard) |
| U5 | `viewScale` | Short side always shows ≥ 330 units; 1400 × 1000 desktop value unchanged; 390 × 844 → 0.59 |

### Scripted browser (headless Chrome via DevTools Protocol, trusted touches)

| # | Check | Expected |
|---|-------|----------|
| T1 | Touch mode | Phone emulation: buttons and touch reminder shown on load; desktop: hidden until first touch, then shown; never-touched desktop shows none |
| T2 | Steering | Touch + drag at 30° → engineer heads ≈ 30° at full speed within 100 ms; release → stops within 100 ms; joystick shown/hidden; second finger ignored; touch on a button does not steer |
| T3 | Every action by tap | Sound running after the Start tap (FR-019); Start, choose 3 upgrades, pause/resume, mute/unmute, both sliders, quit to title, New Run, Replay Seed — touch only |
| T4 | Tap guard | Finger held when level-up opens → lift over a choice selects nothing; tap at < 500 ms ignored; tap after → chosen. Same on pause screen |
| T5 | Page stays put | Drags, double taps, long press, pull-down: `scrollY` 0, visual viewport scale 1, no reload, no selection, no context menu |
| T6 | Fit and safe area | 360 × 640, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768: every screen's content and buttons inside the viewport (and inside simulated safe-area insets); no overflow |
| T7 | Rotation | 390 × 844 → 844 × 390 mid-run: re-fit < 1 s, run phase and tick continuity preserved |
| T8 | View distance | Every size in T6: short side shows ≥ 330 game units; desktop 1400 × 1000 scale unchanged |
| T9 | Mid-range proxy (SC-004) | CPU throttled 4×, phone size: ≥ 50 fps avg with 150 enemies, ≥ 30 with 300, no frame > 250 ms; quality level reported |
| T10 | Hidden page | `visibilitychange` hidden / `pagehide` → paused and sound suspended |
| T11 | Desktop unchanged | All feature 001 and 002 checks pass (SC-006) |

### Real devices (current iPhone with Safari, current Android phone with Chrome)

| # | Check | Expected |
|---|-------|----------|
| H1 | Full run by touch | Title to end screen and a second run with touch only (SC-001) |
| H2 | Page stays put | 5 minutes of vigorous play: no scroll, zoom, refresh, menu (SC-003) |
| H3 | Fit, notch, rotation | Both orientations; nothing behind the notch/corners; rotation keeps the run |
| H4 | Performance | Open the Pages URL with `?fps=1&seed=99`, play until ~300 enemies are on screen, read the overlay: ≥ 55 fps avg, no freeze > 0.25 s (SC-004) |
| H5 | Sound | Starts on Start tap; Sound button mutes; note iPhone silent-switch behaviour |
| H6 | Playtest (SC-008) | 3 of 5 finish a first run without instructions and rate controls comfortable; no accidental choices |
