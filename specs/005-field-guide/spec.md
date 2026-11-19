# Feature Specification: Field Guide

**Feature Branch**: `005-field-guide`

**Created**: 2026-11-19

**Status**: Implemented — automated (G1–G6) and scripted browser checks (GB1–GB5) pass; human checks GH1–GH3 not run (see README Verification)

**Input**: User description: "Add a Field Guide to the pause menu: an index of the network problems
(enemies, and Major Incidents) with their icons, names, real networking concepts, and descriptions, and
of the tools and passives with icons, descriptions, and the player's current rank and stats."

## Overview

Uptime Survivors ties every enemy, incident, tool, and passive to a real networking concept
(constitution C1), but the only place players read about them is a banner that disappears after a few
seconds or a level-up choice made under pressure. This feature adds a **Field Guide**, opened from the
pause screen: an index of the network problems (ordinary enemies and Major Incidents) and of the
engineer's tools and passives. Each entry shows the same icon the player sees on the play field, its
name, the real concept behind it, and its description; tool and passive entries also show the player's
current rank and the exact numbers the game is using.

The Field Guide changes no gameplay: it is opened only while the game is paused and adds no content.

## Clarifications

### Session 2026-11-19

- Q: Should owned tool and passive entries also show what the next rank would change, as well as the
  current rank's stats? → A: Yes: a "Next rank" line listing only the stats that change (current →
  next), hidden at rank 5.
- Q: When should a locked problem count as "met": as soon as it enters the game, or only once visible on
  screen? → A: As soon as it enters the game (an enemy of that type spawns or the incident arrives, even
  off-screen).
- Q: Should enemy and Major Incident entries show combat numbers (health, speed, contact damage)? → A:
  No: icon, name, concept, and description only (plus arrival level for incidents).
- Q: Should the guide show every entry fully expanded in one scrolling list, or a compact list where
  choosing an entry shows its details? → A: One scrolling list per section, every entry shown in full.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Look up a network problem (Priority: P1)

A player pauses the game and opens the Field Guide to find out what the purple diamond blinking toward them is.
They see a list of network problems, each with its icon, name, real networking concept, and a short
description, and recognise the one on screen by its icon.

**Why this priority**: Identifying what is attacking you — and what real problem it represents — is
the main reason to open a guide, and the core of the game's networking theme.

**Independent Test**: Pause during a run, open the Field Guide, and check that every network problem
the guide shows has an icon matching its look on the play field, plus its name, concept, and
description.

**Acceptance Scenarios**:

1. **Given** the pause screen, **When** it is shown, **Then** it offers a "Field Guide" control
   alongside Resume and Quit to Title.
2. **Given** the player opens the Field Guide, **When** it appears, **Then** it shows a "Network
   problems" section listing each enemy type with its icon, name, real networking concept, and
   description.
3. **Given** an enemy type's entry, **When** the player compares its icon with that enemy on the play
   field, **Then** the shape and colour match.
4. **Given** Major Incidents are part of the game, **When** the "Network problems" section is shown,
   **Then** the Major Incidents appear in their own group (marked as Major Incidents, with their
   arrival level) using their own icons.
5. **Given** the player has not yet met a problem (enemy type or Major Incident) this run, **When** the
   guide is shown, **Then** that entry appears as a locked "???" entry in its usual position: a
   silhouette of its icon (shape only, no colour), "Not yet encountered", and no name, concept, or
   description (for a Major Incident, its arrival level is still shown).
6. **Given** a locked entry, **When** that problem first enters the game (an enemy of that type spawns,
   or the incident arrives, even off-screen), **Then** the next time the guide is opened its entry is shown
   in full for the rest of the run.

---

### User Story 2 - Check my tools and passives (Priority: P1)

A player pauses and opens the Field Guide's "Tools & passives" section to see what each of their tools
and passives does, which real concept it represents, what rank it is at, and its current numbers
(damage, cooldown, range, and so on).

**Why this priority**: Knowing the build's exact numbers helps the next level-up choice, and the
concepts are the other half of the networking theme.

**Independent Test**: Pause with a few upgrades taken; the guide lists every tool and passive with its
icon, name, concept, and description; owned ones show the current rank and stats, and those numbers
match the game's own values.

**Acceptance Scenarios**:

1. **Given** the Field Guide is open, **When** the player switches to "Tools & passives", **Then** each
   of the 4 tools and 2 passives is listed with an icon, name, real networking concept, and description.
   (Feature 006 note: now every tool and passive — 7 and 6 — plus a Capacity Planning entry; owned tools also
   show values after bonuses. See `specs/006-late-game-upgrades/spec.md` FR-015, FR-015a.)
2. **Given** the player owns a tool or passive, **When** its entry is shown, **Then** it shows the
   current rank (out of 5) and every stat at that rank, using the same numbers and wording as the
   level-up screen.
3. **Given** an owned tool or passive below rank 5, **When** its entry is shown, **Then** a "Next rank"
   line lists only the stats that change at the next rank, as current → next (e.g. "Damage 12 → 15");
   at rank 5 there is no "Next rank" line.
4. **Given** a tool or passive the player does not own, **When** its entry is shown, **Then** it is
   marked "Not owned" and shows its rank-1 stats, so the player knows what it would do (no "Next rank"
   line).
5. **Given** a tool currently taken offline by a Major Incident, **When** its entry is shown, **Then**
   it is marked "Offline" in addition to its stats.

---

### User Story 3 - Use it anywhere, any way (Priority: P2)

The Field Guide works with keyboard, mouse, and touch, on desktop and phones in either orientation, and
with screen readers; closing it returns to the pause screen exactly as it was.

**Why this priority**: The game already supports these inputs and devices (features 001–003); the
guide must not be the one screen that breaks them.

**Independent Test**: Open, browse, and close the Field Guide using only the keyboard; then only touch
on a phone-sized screen in portrait and landscape; then with a screen reader announcing entries.

**Acceptance Scenarios**:

1. **Given** the Field Guide is open, **When** the player presses Esc or P, or uses a Back control, **Then** it
   closes and the pause screen is shown again with focus on the Field Guide control.
2. **Given** the keyboard only, **When** the player tabs through the guide, **Then** the two sections
   can be switched and every entry can be reached and read.
3. **Given** a phone (360 × 640 CSS pixels or larger, either orientation), **When** the guide is open,
   **Then** it fits within the screen and safe area; long lists scroll inside the guide only, and the
   page itself does not scroll or zoom.
4. **Given** touch, **When** the guide opens from the pause screen, **Then** the feature 003 tap guard
   rules apply to its controls, and scrolling the list never selects anything by accident.
5. **Given** a screen reader, **When** an entry is reached, **Then** its name, concept, description,
   and (for tools and passives) rank and stats are announced; icons are decorative and not announced.
6. **Given** the guide is open, **When** time passes, **Then** the game stays paused and nothing
   changes in the run.

---

### Edge Cases

- **Opened during a level-up screen**: not possible — the guide opens only from the pause screen.
- **Tab hidden or window loses focus while the guide is open**: the game stays paused; returning shows
  the guide as it was.
- **M (mute) while the guide is open**: works as everywhere else.
- **Reduced motion**: the guide has no animation (icons are static).
- **Very long descriptions**: wrap within the entry; no text is cut off.
- **Two incidents active** (feature 004): no special handling; incident entries are static reference.
- **Problem met while the guide is closed, then a new run starts**: the new run starts with every
  problem locked again.
- **Route Leak minions**: a Latency Spike released by Route Leak counts as meeting Latency Spike.
- **Bad game data**: impossible at this point — data is validated before Start, and the guide only
  shows validated data.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: The pause screen MUST offer a "Field Guide" control; activating it MUST open the guide.
- **FR-002**: The guide MUST be closable with Esc, with P, and with a visible Back control, returning to
  the pause screen with focus on the Field Guide control; neither key resumes the game from the guide,
  and the game MUST remain paused throughout.
- **FR-003**: The guide MUST be available only from the pause screen (not from the title, level-up, or
  end screens).

**Content**

- **FR-004**: The guide MUST have two sections, "Network problems" and "Tools & passives", switchable
  with keyboard, mouse, and touch. Each section is one scrolling list with every entry shown in full
  (no select-to-expand or detail view); the guide opens on "Network problems".
- **FR-005**: Each network problem entry MUST show an icon matching that enemy's shape and colour on
  the play field, its name, its real networking concept, and its description, in the order the enemies
  debut (level 1, 4, 8, 12, 16). Network problem entries MUST NOT show combat numbers (health, speed,
  contact damage), since those scale with difficulty.
- **FR-006**: Major Incidents MUST appear in their own group within "Network problems", each with its
  own icon, name, concept, description, and arrival level (and no combat numbers).
- **FR-007**: Each tool and passive entry MUST show an icon, name, real networking concept, and
  description.
- **FR-008**: Owned tools and passives MUST show the current rank (of 5) and every stat at that rank,
  with numbers identical to those the game uses and wording consistent with the level-up screen
  (constitution C6). Owned ones below rank 5 MUST also show a "Next rank" line listing only the stats
  that change at the next rank, as current → next; there is no such line at rank 5. Unowned ones MUST
  be marked "Not owned" and show rank-1 stats.
- **FR-009**: A tool currently offline because of a Major Incident MUST be marked "Offline".
- **FR-010**: All text in the guide MUST come from the validated game data; the guide MUST NOT contain
  any names, concepts, descriptions, or numbers of its own.
- **FR-011**: A network problem (enemy type or Major Incident) not yet met this run MUST be shown as a
  locked entry: icon silhouette (shape only), "Not yet encountered", no name, concept, or description;
  Major Incidents keep their arrival level. An entry unlocks for the rest of the run once that problem
  has entered the game (an enemy of that type has spawned or the incident has arrived, whether or not it
  was on screen), so the result is the same on every screen size. Encounter tracking resets with each new run and is never saved. Tools
  and passives are never locked.

**Accessibility and devices**

- **FR-012**: Every control and entry MUST be reachable and readable with the keyboard alone; the
  sections MUST be announced as a tab list (or equivalent) to assistive technology; icons MUST be
  decorative (hidden from screen readers).
- **FR-013**: On touch devices, controls MUST be at least 44 × 44 CSS pixels and follow the feature 003
  tap guard; lists MUST scroll inside the guide without scrolling or zooming the page.
- **FR-014**: The guide MUST fit screens from 360 × 640 CSS pixels upward in both orientations, inside
  the safe area.
- **FR-015**: Opening, browsing, and closing the guide MUST NOT change the run in any way (the run
  state is identical before and after; constitution C5).

### Non-Goals

- No new content (enemies, tools, passives, or incidents).
- No persistence (e.g. remembering which entries were seen across page loads).
- No search, filters, or sorting controls.
- No animated previews or videos of enemies or tools.
- No external links or downloadable material.

### Key Entities

- **Guide Entry**: icon (shape and colour), name, concept, description; for network problems also
  met / not yet met this run (locked); for tools and passives also owned/not owned, rank, stats at
  that rank, next-rank changes, and offline status; for Major Incidents, arrival level.
- **Encounter record**: the set of enemy types and Major Incidents that have entered the game (spawned or arrived) this run; starts
  empty, only grows, and is discarded when the run ends.
- **Guide Section**: "Network problems" (enemies, then Major Incidents) and "Tools & passives".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a paused game, a player reaches any entry in at most 3 steps (open the guide, choose
  its section, scroll or Tab to the entry) with keyboard, mouse, or touch, with no other screen, menu,
  or selection in between.
- **SC-002**: 100% of the guide's unlocked entries match the game data exactly (name, concept,
  description, icon shape and colour), 100% of displayed stats match the values the game is using at
  that moment, and 100% of problems not yet met this run are shown locked.
- **SC-003**: On every tested screen size (360 × 640 up to desktop, both orientations), the guide is
  fully usable with nothing hidden behind the screen edge, notch, or system bars.
- **SC-004**: The run state is identical before opening and after closing the guide in 100% of tests.
- **SC-005**: After a run that has met every problem, a reviewer can name the real networking concept
  behind every enemy, incident, tool, and passive using only the guide (this also strengthens
  constitution C1's evidence).
- **SC-006**: In a playtest, at least 3 of 5 players open the guide at least once without being told
  to, and find what they were looking for.

## Assumptions

- The guide reuses the existing names, concepts, descriptions, and stats from `data/game.json`; no new
  text is authored for it.
- Stat wording follows the level-up screen's existing labels and units.
- The pause screen keeps its existing Resume, Quit to Title, and sound controls; the Field Guide control
  is added beside them.
- The Field Guide is reference only; it never pauses or resumes the game itself (the game is already
  paused when it opens).
