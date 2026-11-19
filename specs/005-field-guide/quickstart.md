# Quickstart & Validation Guide: Field Guide

## Run and test

```sh
python3 -m http.server 8000 --bind 127.0.0.1      # http://127.0.0.1:8000/?levelSeconds=4
jsc -m tests/run.mjs                                # unit tests (G1–G6 plus all earlier ones)
python3 tests/browser/drive.py --only guide        # scripted browser checks (GB1–GB4)
python3 tests/browser/drive.py --only touch        # includes the phone guide check (GB5)
python3 tests/browser/drive.py                      # everything
```

Pause with Esc, P, or the ❚❚ button, then choose **Field Guide**.

## Validation scenarios

Record each as **pass / fail / not run** in the README (constitution C7).

### Unit tests (`tests/guide.test.js`, `tests/determinism.test.js`)

| # | Check | Expected |
|---|-------|----------|
| G1 | Content | Problems in debut order (1, 4, 8, 12, 16), incidents by arrival (7, 12, 18), then 4 tools + 2 passives; unlocked text equals data exactly; no health/speed/damage in problem entries |
| G2 | Locking | New run: all problems locked except types already spawned; a type unlocks on its first `spawnEnemy` (including a split child and a Route Leak minion), an incident on arrival; locked entries have null name/concept/description and colour, incidents keep `arrivalLevel`; a new run starts empty again |
| G3 | Stats | Owned tool/passive: rank, stats equal `ranks[rank-1]` fields the engine reads; `next` equals `describeChange` for rank → rank+1 and lists only changed stats; none at rank 5; unowned shows rank-1 stats, no `next`; offline tool flagged; text from `describeStatChange` matches the level-up screen's text for the same change |
| G4 | Icons | `shapePoints` gives the vertices render.js draws for all 5 shapes; problem icons use the data colour, locked ones `LOCKED_COLOR` only; every icon has `aria-hidden="true"`; tool icons use `TOOL_COLORS` |
| G5 | No change | `hashRun` identical before and after `buildGuide` on a mid-run state with incidents and offline tools |
| G6 | Determinism | `run.encountered` is in the hash; two identical seeded runs give identical `encountered` lists; engine source scan still passes |

### Scripted browser checks (`tests/browser/smoke-guide.html`, `touch_checks.py`)

| # | Check | Expected |
|---|-------|----------|
| GB1 | Open and content | Pause shows Resume / Field Guide / Quit; opening shows "Network problems" with 5 enemies + 3 incidents, locked/unlocked as the run's `encountered`; icon SVG shapes match data |
| GB2 | Keyboard | Arrow keys switch tabs; Tab reaches every entry; Esc and P return to the pause screen with focus on Field Guide; the run phase stays `paused` and `hashRun` is unchanged after 3 s open |
| GB3 | Tools & passives | With two tools (one offline) and a passive: ranks, stats, next-rank lines, "Not owned", and OFFLINE match the model |
| GB4 | Accessibility attributes | tablist/tab/tabpanel roles and `aria-selected`; entries labelled by name; icons `aria-hidden`; no locked name text in the DOM |
| GB5 | Phone (CDP emulation) | 360 × 640 portrait and landscape with safe-area insets: panel inside the safe area, nothing clipped; a touch-drag scrolls the list, not the page, and selects nothing; Back obeys the 500 ms / lift-finger tap guard; controls ≥ 44 × 44; the pause screen (now with three buttons) still fits unclipped in both orientations; with 4× CPU throttling the guide's entries appear < 100 ms after the tap |

### Human checks

| # | Check | Expected |
|---|-------|----------|
| GH1 | Screen reader (VoiceOver on macOS or iOS) | Tabs announced as tabs; each entry's name, concept, description, and rank/stats read; icons silent |
| GH2 | Real phones (the 003 iPhone and Android) | Guide opens, scrolls, and closes by touch in both orientations; nothing hidden by the notch or system bars |
| GH3 | Playtest (SC-006) | ≥ 3 of 5 players open the guide unprompted and find what they wanted |
