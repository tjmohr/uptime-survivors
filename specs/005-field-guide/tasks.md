---

description: "Task list for feature 005 — Field Guide"
---

# Tasks: Field Guide

**Input**: Design documents from `specs/005-field-guide/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan and quickstart require unit tests G1–G6, scripted browser checks GB1–GB5,
and human checks GH1–GH3 (constitution C7).

**Organization**: US1 Look up a network problem (P1) · US2 Check my tools and passives (P1) · US3 Use
it anywhere, any way (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Paths are relative to the repository root.

## Global rules for every task

- Engine code stays pure and deterministic (no DOM, timers, or `Math.random` in `engine/`).
- `ui/guide.js`, `ui/icons.js`, and `ui/stattext.js` stay DOM-free so jsc can import them.
- The guide reads the run and never changes it (spec FR-015); all text comes from validated data
  (FR-010); no edits to `data/game.json` or `data/audio.json`.
- After each phase run `jsc -m tests/run.mjs` (all existing 133 tests stay green) and the existing
  browser checks (`python3 tests/browser/drive.py`).

---

## Phase 1: Setup

- [x] T001 Create `tests/guide.test.js` with the harness pattern used by `tests/incidents.test.js` and register it in `tests/files.js`
- [x] T002 [P] Create empty DOM-free modules `ui/guide.js`, `ui/icons.js`, `ui/stattext.js` with the exports named in [contracts/engine-api.md](./contracts/engine-api.md) (stubs that throw "not implemented")

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: the encounter record, the shared stat formatter, and the shared shape geometry.

- [x] T003 Add `encountered: []` to the run in `engine/run.js › createRun` (data-model.md › Encounter Record.`run.encountered`)
- [x] T004 In `engine/spawner.js › spawnEnemy`, append `typeId` to `run.encountered` if absent (data-model.md › Encounter Record.`run.encountered`; covers splits in `engine/combat.js` and Route Leak minions, which both call `spawnEnemy`)
- [x] T005 In `engine/incidents.js › arriveIncidents`, append the incident id to `run.encountered` if absent (data-model.md › Encounter Record.`run.encountered`)
- [x] T006 Add `run.encountered.join('|')` to `engine/hash.js › hashRun` (guard `?? []` for test fixtures that build runs by hand)
- [x] T007 [P] Move `STAT_LABELS`, `UNITS`, `PLUS`, `fmtValue`, and `describeStatChange` from `ui/screens.js` into `ui/stattext.js` and import them back into `ui/screens.js` (no behaviour change; research R3)
- [x] T008 [P] Implement `shapePoints(shape, r)` in `ui/icons.js` (vertices identical to `ui/render.js › shapePath` for square, triangle, hexagon, diamond, octagon; `null` for circle) and change `shapePath` in `ui/render.js` to draw from it; move `PROJECTILE_COLORS` and the barrier/pulse colours into `ui/icons.js › TOOL_COLORS` and import them in `ui/render.js` (research R5)
- [x] T009 Write G6 in `tests/determinism.test.js`: two identical seeded runs give identical `run.encountered` and hashes; changing `encountered` changes the hash; purity scan still passes
- [x] T010 Write the engine part of G2 in `tests/guide.test.js`: new run → `encountered` empty; first spawn of a type appends once; a Broadcast Storm split child and a Route Leak minion count; incident arrival appends; a second `createRun` starts empty

**Checkpoint**: `jsc -m tests/run.mjs` green; browser smoke checks still draw the same shapes.

---

## Phase 3: User Story 1 — Look up a network problem (P1) 🎯 MVP

**Goal**: Pause → Field Guide → "Network problems" lists the 5 enemies and 3 incidents with icons, names,
concepts, descriptions; unmet ones locked.

**Independent test**: GB1 + G1/G2/G4 — pause mid-run, open the guide, every entry matches the data or is
locked exactly as `run.encountered` says.

### Tests for User Story 1

- [x] T011 [P] [US1] Write G1 (problem part) in `tests/guide.test.js`: `problems` sorted by `debutLevel` (1, 4, 8, 12, 16), `incidents` by `arrivalLevel` (7, 12, 18); unlocked `name`/`concept`/`description`/`shape`/`color` equal the data; no health/speed/damage keys on any problem entry
- [x] T012 [P] [US1] Write G2 (model part) in `tests/guide.test.js`: locked entries have `name`, `concept`, `description`, `color` all `null`, keep `shape`, incidents keep `arrivalLevel`; an entry flips to unlocked after its id is in `run.encountered`
- [x] T013 [P] [US1] Write G4 in `tests/guide.test.js`: `shapePoints` matches the expected vertices for all 5 shapes; `problemIcon` uses the data colour when unlocked and only `LOCKED_COLOR` when locked; every icon string contains `aria-hidden="true"` and no `<animate`

### Implementation for User Story 1

- [x] T014 [US1] Implement `buildGuide(run)` problem part in `ui/guide.js`: `Guide.problems` and `Guide.incidents` (data-model.md › Guide.`problems`, Guide.`incidents`) with every Problem Entry field (data-model.md › Problem Entry.`id`, `.kind`, `.locked`, `.shape`, `.color`, `.name`, `.concept`, `.description`, `.arrivalLevel`); `loadout: []` until US2
- [x] T015 [US1] Implement `problemIcon(entry, size)` in `ui/icons.js` as an inline SVG polygon from `shapePoints` (outline + 20% fill + centre dot like the play-field sprite; locked: grey outline only), `aria-hidden="true" focusable="false"`
- [x] T016 [US1] Add the Field Guide button to `ui/screens.js › showPause` per [contracts/ui-guide.md](./contracts/ui-guide.md) › Pause screen (`id="open-guide"`, order Resume / Field Guide / Quit to Title, `focusGuide` option)
- [x] T017 [US1] Implement `showGuide(model, { onBack })` in `ui/screens.js`: overlay screen `guide` with Back, heading, tablist (two tabs, "Network problems" selected), `#guide-list` tabpanel; Network problems content per [contracts/ui-guide.md](./contracts/ui-guide.md) › Entry (enemy and incident rows, locked rows show "???" / "Not yet encountered" and no locked text anywhere in the DOM)
- [x] T018 [US1] Wire `main.js`: `openGuide()` (only while `run.phase === 'paused'`) calls `screens.showGuide(buildGuide(run), { onBack })`; `onBack` re-shows the pause screen with `focusGuide: true`; `togglePause` (Esc/P) when `screens.current === 'guide'` calls `onBack` instead of resuming
- [x] T019 [P] [US1] Add base guide styles in `style.css`: `.panel.guide` (≤ 720 px wide, fills the overlay height), fixed header, scrolling `#guide-list`, `.guide-entry` two-column grid (40 px icon | text, wrapping), group headings, locked styling, no transitions
- [x] T020 [US1] Create `tests/browser/smoke-guide.html` with mode `open` (GB1): pause via Esc, check button order, open guide, count 5 + 3 entries, compare locked/unlocked with `R().encountered` and SVG polygon points with `shapePoints`; add the `guide` entries to `CHECKS` and `--only guide` in `tests/browser/drive.py`

**Checkpoint**: US1 usable on desktop; G1/G2/G4 and GB1 pass.

---

## Phase 4: User Story 2 — Check my tools and passives (P1)

**Goal**: "Tools & passives" tab with all 4 tools and 2 passives, rank, stats, next rank, Not owned,
OFFLINE.

**Independent test**: G3 + GB3 — with a few upgrades taken (one tool offline), every number matches the
engine's rank tables and the level-up wording.

### Tests for User Story 2

- [x] T021 [P] [US2] Write G3 in `tests/guide.test.js`: for every tool and passive at ranks 1–5, `stats` equals the rank table fields the engine reads (`TOOL_KIND_FIELDS[kind]` for tools, all fields for passives); `next` equals `describeChange` for rank → rank+1 and is `null` at rank 5 and when not owned; unowned shows rank 1; `offline` true exactly when `offlineUntil > elapsed`; `describeStatChange` text for `next` equals the level-up offer's text for the same item
- [x] T022 [P] [US2] Write G1 (loadout part) in `tests/guide.test.js`: `loadout` lists tools in data order then passives; `name`/`concept`/`description` equal the data

### Implementation for User Story 2

- [x] T023 [US2] Implement the loadout part of `buildGuide` in `ui/guide.js`: `Guide.loadout` (data-model.md › Guide.`loadout`) with every Loadout Entry field (data-model.md › Loadout Entry.`id`, `.kind`, `.name`, `.concept`, `.description`, `.owned`, `.rank`, `.stats`, `.next`, `.offline`), using `describeChange` from `engine/progression.js` and `TOOL_KIND_FIELDS` from `engine/content.js`
- [x] T024 [P] [US2] Implement `loadoutIcon(def, size)` in `ui/icons.js`: tool icons by `def.kind` in `TOOL_COLORS` (projectile dot, barriers on an orbit ring, pulse ring, three fanned projectiles); passive glyphs by id (double chevron, stacked PSU bars) with a circle fallback; `aria-hidden="true"`
- [x] T025 [US2] Render the "Tools & passives" tab in `ui/screens.js › showGuide` per [contracts/ui-guide.md](./contracts/ui-guide.md) › Entry (rank line "Rank r / 5" + " · OFFLINE", "Not owned", stats line and "Next rank: …" line built with `describeStatChange` joined by " · "); clicking/tapping a tab switches content and resets scroll
- [x] T026 [P] [US2] Add stats / next-rank / offline / not-owned styles in `style.css` (reuse the level-up `.changes` look; OFFLINE uses the HUD offline colour)
- [x] T027 [US2] Add mode `loadout` (GB3) to `tests/browser/smoke-guide.html`: give the engineer Ping rank 3, Load Balancer rank 1 (offline), Bandwidth Upgrade rank 5; open the guide, switch tab, compare every entry's text with `buildGuide` + `describeStatChange`; register it in `tests/browser/drive.py`

**Checkpoint**: US1 + US2 complete on desktop; G1–G5 relevant parts and GB1, GB3 pass.

---

## Phase 5: User Story 3 — Use it anywhere, any way (P2)

**Goal**: keyboard, screen reader, phones in both orientations, touch tap guard, run unchanged.

**Independent test**: GB2, GB4, GB5, G5.

### Tests for User Story 3

- [x] T028 [P] [US3] Write G5 in `tests/guide.test.js`: on a mid-run state with two incidents, an offline tool, and infected enemies, `hashRun` is identical before and after `buildGuide` (called twice)
- [x] T029 [US3] Add modes `keys` (GB2) and `aria` (GB4) to `tests/browser/smoke-guide.html`: Left/Right/Home/End switch tabs with `aria-selected`; Tab reaches every `.guide-entry` (SC-001: from the pause screen, Enter on Field Guide, Right arrow to "Tools & passives", then Tab until the last entry is focused, passing no other control); Esc and P each return to the pause screen with focus on `#open-guide`; `run.phase` stays `paused` and `hashRun` unchanged after 3 s open; roles tablist/tab/tabpanel, entries `aria-labelledby` their name, icons `aria-hidden`, no locked names in `document.body.innerHTML`; register in `tests/browser/drive.py`
- [x] T030 [US3] Add `check_guide_mobile` (GB5) to `tests/browser/touch_checks.py`: 360 × 640 portrait and 640 × 360 landscape with safe-area insets; panel inside the safe area and no clipped entry; a CDP touch-drag on `#guide-list` scrolls it, `scrollY` of the page stays 0, and nothing changes; a tap on Back within 500 ms of opening (or with a finger still down) is ignored, after lifting and 500 ms it works; Back and tabs ≥ 44 × 44; also open the pause screen at 360 × 640 and 640 × 360 and check Resume, Field Guide, Quit to Title, and the sound controls are inside the safe area and unclipped; with 4× CPU throttling (feature 003 profile) time from the Field Guide tap until `#guide-list` has its entries and require < 100 ms (plan performance goal), recording the value; register it in the touch run

### Implementation for User Story 3

- [x] T031 [US3] Keyboard behaviour in `ui/screens.js › showGuide`: roving tabindex on the tabs with Left/Right/Home/End, `aria-selected`/`aria-controls`, `#guide-list` `aria-labelledby` the selected tab, entries `tabindex="0"` with `aria-labelledby` their name, initial focus on the selected tab (research R6)
- [x] T032 [US3] Add `'guide'` to the tap-guarded screens (`GUARDED`) in `ui/screens.js` so Back and the tabs follow the feature 003 guard; confirm a scroll gesture ending on an entry triggers nothing (entries are not buttons)
- [x] T033 [US3] Phone layout in `style.css`: guide panel within `--sat/--sar/--sab/--sal`, `#guide-list` `overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y`; `body.touch` Back and tabs ≥ 44 × 44; compact rules for heights ≤ 400 px (landscape) so the header stays one row; if the pause panel overflows with the third button, add compact pause styles for heights ≤ 400 px (single button row, tighter sound-control spacing) as feature 003 did for level-up
- [x] T034 [US3] Confirm focus loss and mute while the guide is open in `main.js`: `onFocusLost` does nothing to the guide (run already paused) and M toggles sound without leaving the guide; fix if not

**Checkpoint**: all stories complete; G1–G6 and GB1–GB5 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T035 [P] Add a "Field Guide" section to `README.md` (how to open it, locking, what the numbers mean) and verification rows G1–G6, GB1–GB5, GH1–GH3 with recorded pass / fail / not run
- [x] T036 [P] Add a note to `specs/001-survivors-first-playable/contracts/ui-controls.md` (pause screen) and `specs/003-mobile-touch/contracts/ui-controls.md` (tap-guarded screens) that the pause screen now has a Field Guide button and that `guide` is a guarded screen
- [x] T037 Run the full suites (`jsc -m tests/run.mjs`, `python3 tests/browser/drive.py`) and record results in `README.md`; GH1–GH3 stay "not run" until a human does them
- [x] T038 Update `specs/005-field-guide/spec.md` Status to reflect the recorded results (constitution C7)

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T010)** → stories.
- **US1 (T011–T020)** needs Foundational. It creates the guide screen and wiring that US2 and US3 extend.
- **US2 (T021–T027)** needs US1's `showGuide` (T017) and `buildGuide` (T014); its model and tests
  (T021–T024) can start right after Foundational.
- **US3 (T028–T034)** needs US1's screen; T028 can start after T014.
- **Polish (T035–T038)** after the stories it documents.

Inside a story: tests first (they fail), then model → icons → screen → wiring → browser check.

## Parallel examples

- Foundational: T007 (stattext) ∥ T008 (icons/render) while T003–T006 run in sequence.
- US1: T011 ∥ T012 ∥ T013 (one test file, separate test blocks; write them in one pass if editing
  conflicts), and T019 (CSS) ∥ T015 (icons).
- US2: T021 ∥ T022, then T024 (icons) ∥ T026 (CSS) ∥ T023 (model).
- US3: T028 ∥ T030 (different files).

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: the guide opens from pause and identifies every problem, with
   locking. Validate with G1/G2/G4/G6 and GB1, then stop and demo if needed.
2. **+ US2**: the build reference with exact numbers (G3, GB3). The plan's hardest behaviour, so write
   G3 first.
3. **+ US3**: keyboard, screen reader, phone, tap guard (GB2, GB4, GB5, G5).
4. **Polish**: README rows and spec status. If time runs short, record GB5 as "not run" rather than
   cutting US1/US2.
