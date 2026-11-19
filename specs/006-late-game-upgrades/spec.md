# Feature Specification: Late-Game Upgrades

**Feature Branch**: `006-late-game-upgrades`

**Created**: 2026-11-19

**Status**: Implemented — unit tests (L-U1–L-U8), balance (L-S1–L-S4), and browser checks (L-B1–L-B4) pass; human checks L-H1–L-H2 not run; tool floor and front-loaded passives added after the first balance results; feature 004's I-S1 re-run passes (see README Verification)

**Input**: User description: "Add more upgrades for the late game: 3 new tools (keep the 4-tool limit so
players choose a build), 3–4 new passives, and a repeatable upgrade offered once everything is maxed, so
level-ups past difficulty ~10 are never Failover-only. Every new item is tied to a real networking
concept."

## Overview

Today the engineer can learn 4 tools and 2 passives, 5 ranks each: 29 upgrades in all. A good run takes
them all by around difficulty 8–12, and from then on every level-up offers only **Failover** (a heal).
Because the tool limit (4) equals the number of tools (4), every run also ends with the same build.

This feature adds **3 new tools**, **4 new passives**, and one **repeatable upgrade**:

- With 7 tools and room for 4, choosing tools becomes a real build decision, and runs differ.
- With 6 passives the pool a single run can draw from grows from 29 to 49 upgrades.
- Once everything a run can still take is maxed, level-ups offer the repeatable upgrade, so a level-up is
  never Failover-only.

Every new item is themed on a real networking concept (constitution C1), its numbers live in the
validated game data (C6), and it appears in the Field Guide (feature 005) with an icon, concept,
description, and stats.

### New items (names and concepts)

| Kind | Name | Real concept | What it does |
|------|------|--------------|--------------|
| Tool | **Traceroute** | Traceroute (hop-by-hop path discovery) | A bolt hits the nearest problem, then hops to further problems one after another, like hops on a path |
| Tool | **Rate Limiter** | Traffic policing / rate limiting | A field around the engineer that slows problems inside it and wears them down |
| Tool | **Null Route** | Black-hole routing (RTBH) | Drops a black hole on a group of problems that damages everything in it for a few seconds |
| Passive | **QoS Policy** | Quality of Service | All tools recharge faster |
| Passive | **Link Aggregation** | Link aggregation (LACP) | All tools deal more damage |
| Passive | **Observability Stack** | Network monitoring and observability | More telemetry from every pickup |
| Passive | **Hardened Config** | Device hardening | Less Uptime lost when problems touch the engineer |
| Repeatable | **Capacity Planning** | Capacity planning | A small, stacking boost to all tools' damage; can be taken any number of times |

## Clarifications

### Session 2026-11-19

- Q: Should the 3 new tools be offered from the start of a run, or only later? → A: From the start, on the
  same terms as the original tools.
- Q: Once the pool is exhausted, Capacity Planning alone or alongside Failover? → A: Both, player chooses;
  and Failover's heal changes from 20% to 15% of maximum Uptime.
- Q: Should tool numbers on the level-up screen and in the Field Guide be rank values or values after
  passive and Capacity Planning bonuses? → A: Both: the rank value plus the effective value when a bonus
  changes it, e.g. "Damage 15 (21 with bonuses)".
- Q: Should every run still start with Ping, or should the starting tool vary? → A: Always start with
  Ping, as today.
- Q: Should Rate Limiter's slowing field also slow Major Incidents? → A: No; incidents take Rate Limiter's
  damage but are never slowed.

### Session 2026-11-19 (after implementation, balance follow-up)

- Q: Players who keep taking passives early end up with only Ping and lose early; how should the game
  prevent that? → A: A **tool floor**: from difficulty 5 the engineer must have 2 tools, from 10 three, from
  15 four; below the floor a level-up offers only new tools, with a short note. (An earlier "one new tool
  in every offer" rule was tried and replaced.)
- Q: Random-picking players still did worse because early picks spread over many weak passives; what
  then? → A: Make early passives stronger: the four new passives are front-loaded (higher rank 1–2
  values, same rank-5 maximum).
- Q: (User request) Should the Major Incident notification disappear after a few seconds? → A: No: it stays
  on screen as pulsing red text until the incident is defeated, then shows "RESOLVED" in green.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a build (Priority: P1)

A player levels up early in a run and is offered tools beyond the original four. Because only 4 tools fit,
picking Traceroute or Null Route means some other tool will not be in this run. Two runs can end with
different builds that feel different to play.

**Why this priority**: Choice is the core of the genre's level-up loop; today the outcome is fixed.

**Independent Test**: Start several seeded runs and take different tools; each run shows a different
4-tool loadout, and every new tool fires visibly and resolves problems.

**Acceptance Scenarios**:

1. **Given** a run in which the engineer has fewer than 4 tools, **When** a level-up is offered,
   **Then** any of the 7 tools the engineer does not yet own can appear as a "New" choice, from the
   first level-up of the run onward (no difficulty or level gate).
2. **Given** the engineer owns 4 tools, **When** a level-up is offered, **Then** no new tool is offered;
   only ranks of owned tools and passives (and later the repeatable upgrade) appear.
3. **Given** the engineer owns Traceroute, **When** problems are in range, **Then** each firing hits the
   nearest problem and then hops to further problems up to its hop count, each hop within its hop range.
4. **Given** the engineer owns Rate Limiter, **When** ordinary problems are inside its field, **Then**
   they move slower by its slow percentage and take its damage over time; they return to normal speed when
   they leave the field. A Major Incident inside the field takes the damage but is not slowed.
5. **Given** the engineer owns Null Route, **When** it fires, **Then** a black hole appears on a problem
   (on the problem in range with the most other problems around it), damages every problem inside it for its
   duration, and then disappears.
6. **Given** any new tool, **When** a Major Incident takes tools offline (feature 004), **Then** the new
   tool can be taken offline and stops working for that time, exactly like the original tools.

---

### User Story 2 - Stronger passives (Priority: P1)

A player can shape a build with passives that change how all tools behave: faster recharge, more damage,
more telemetry, or less damage taken.

**Why this priority**: Passives are the cheapest way to deepen every build, and they extend the upgrade
pool by 20 ranks.

**Independent Test**: Take each new passive in a seeded run; the effect is measurable (cooldowns,
damage dealt, telemetry gained, Uptime lost) and matches the numbers shown on the level-up screen.

**Acceptance Scenarios**:

1. **Given** QoS Policy at rank r, **When** any tool recharges, **Then** its cooldown is shortened by the
   rank's percentage (for the orbiting tool: its hit cooldown).
2. **Given** Link Aggregation at rank r, **When** any tool hits, **Then** its damage is increased by the
   rank's percentage.
3. **Given** Observability Stack at rank r, **When** the engineer collects telemetry (including an
   incident reward), **Then** the amount gained is increased by the rank's percentage.
4. **Given** Hardened Config at rank r, **When** a problem's contact damage applies, **Then** the
   Uptime lost is reduced by the rank's percentage.
5. **Given** any of these, **When** it is offered or shown in the Field Guide, **Then** the numbers shown
   are exactly the numbers the game applies (constitution C6).
6. **Given** Link Aggregation or QoS Policy is owned, **When** a tool's stats are shown on the level-up
   screen or in the Field Guide, **Then** each affected stat shows its rank value and the effective value,
   e.g. "Damage 15 (21 with bonuses)".

---

### User Story 3 - Level-ups never go dead (Priority: P1)

A strong player who has maxed every tool and passive their run can still take keeps getting a level-up
choice that makes them stronger, instead of only Failover.

**Why this priority**: This is the problem the user reported.

**Independent Test**: In a seeded run with everything maxed, each level-up offers Capacity Planning;
taking it several times increases all tools' damage by the stated amount each time.

**Acceptance Scenarios**:

1. **Given** every upgrade the run can still take is at rank 5 (owned tools, all passives; no tool slot
   free), **When** a level-up is offered, **Then** it offers exactly two choices, Capacity Planning and
   Failover, and the player picks one (power or heal).
5. **Given** Failover is offered (only once everything else is exhausted), **When** it is taken, **Then**
   it restores 15% of maximum Uptime (changed from 20%), never above the maximum.
2. **Given** Capacity Planning taken n times, **When** any tool hits, **Then** its damage includes the
   stacked bonus (n × the per-take amount), combined with Link Aggregation as stated in the data.
3. **Given** Capacity Planning, **When** it is offered, **Then** the choice shows how many times it has
   been taken and the bonus after this one (e.g. "Taken 3× · All tool damage +15% → +20%").
4. **Given** the run is not yet exhausted, **When** a level-up is offered, **Then** Capacity Planning
   does not appear.

---

### User Story 4 - The new items fit the game (Priority: P2)

New items look and sound like part of the game, appear in the Field Guide, and keep difficulty fair.

**Why this priority**: Without this the content works but feels bolted on, or makes the game too easy.

**Independent Test**: Open the Field Guide's "Tools & passives" section: all 7 tools, 6 passives, and
Capacity Planning are listed with icons, concepts, descriptions, and stats. Run the balance simulation
and compare with the current game.

**Acceptance Scenarios**:

1. **Given** the Field Guide, **When** "Tools & passives" is shown, **Then** it lists every tool and
   passive including the new ones, with rank, stats, and next-rank line (feature 005 rules), plus
   Capacity Planning with the number of times taken and its total bonus.
2. **Given** each new tool, **When** it fires, **Then** it has its own visible effect drawn in the game's
   style and uses existing sound effects (or new ones) consistent with feature 002; reduced motion
   tones its effects down like the other tools.
3. **Given** the HUD loadout, **When** the engineer owns new tools or passives, **Then** they are listed
   with their ranks like the existing ones (and OFFLINE when taken offline).
4. **Given** the seeded balance simulation, **When** runs are compared with the current game, **Then**
   difficulty stays in the ranges in Success Criteria.

---

### Edge Cases

- **Tool limit reached early**: once 4 tools are owned, unowned tools are never offered again in that
  run; their entries in the Field Guide stay "Not owned".
- **Fewer than 3 choices available**: a level-up shows as many distinct choices as exist (as today),
  never duplicates.
- **Every owned tool offline**: impossible — feature 004 never takes the last working tool; new tools
  follow the same rule.
- **Rate Limiter and incidents**: Major Incidents inside the field take its damage but are never slowed
  (feature 004 tuning and the entry dash are unchanged); Route Leak's minions and infected enemies are
  ordinary problems and are slowed.
- **Rate Limiter and infection**: infected enemies (feature 004) are slowed from their infected speed.
- **Null Route with no problems in range**: it does not fire and its cooldown waits until a problem is in
  range (like Ping).
- **Traceroute hops**: a hop never hits the same problem twice in one firing; it stops early when no
  other problem is within hop range.
- **Very long runs with Capacity Planning**: the stacked bonus has no cap; numbers stay finite and
  readable (e.g. "+150%").
- **Determinism**: all new choices (targets, hop order, black-hole placement) are seeded; the same seed
  and inputs give the same run (C5).
- **Bad data**: a new tool or passive with missing or invalid fields fails validation before Start,
  naming the item.

## Requirements *(mandatory)*

### Functional Requirements

**Upgrade pool**

- **FR-001**: The game MUST have 7 tools (the 4 existing plus Traceroute, Rate Limiter, Null Route) and 6
  passives (the 2 existing plus QoS Policy, Link Aggregation, Observability Stack, Hardened Config), each
  with 5 ranks.
- **FR-002**: The engineer MUST still carry at most 4 tools; once 4 are owned, no new tool is offered.
  Every run still starts with Ping at rank 1, so the player chooses the other 3 tools from the remaining
  6.
- **FR-003**: The new tools MUST be offered on the same terms as the original tools: from the first
  level-up of a run, whenever a tool slot is free; there is no difficulty or level gate.
- **FR-004**: Level-up offers MUST keep the existing rules: up to 3 distinct choices drawn with the
  run's seeded randomness from all upgrades currently available, except as FR-004a requires.
- **FR-004a**: **Tool floor.** From difficulty 5 the engineer needs 2 tools, from difficulty 10 three, and
  from difficulty 15 four (values in the game data). While the engineer has fewer tools than the floor
  and a new tool can be taken, a level-up MUST offer only new tools (up to 3) and show "Your network
  needs more tools: choose one." Above the floor, offers follow FR-004.

**New tools**

- **FR-005**: Traceroute MUST hit the nearest problem in range, then hop to the nearest not-yet-hit
  problem within its hop range, up to its hop count, dealing its damage to each.
- **FR-006**: Rate Limiter MUST continuously slow ordinary problems inside its radius by its slow
  percentage and deal its damage per second to every problem inside, including Major Incidents; Major
  Incidents are never slowed. Problems regain their speed on leaving.
- **FR-007**: Null Route MUST, when a problem is within its range, place a black hole of its radius centred on
  the problem with the most other problems within that radius (ties → the earliest-spawned problem;
  deterministic, no randomness needed), damaging every problem inside each tick for its duration.
- **FR-008**: All new tools MUST obey feature 004's offline rules and the existing targeting of Major
  Incidents (they are problems like any other).

**New passives**

- **FR-009**: QoS Policy MUST reduce every tool's cooldown (orbiting tool: hit cooldown) by its rank
  percentage (Rate Limiter has no cooldown; its tick interval is unaffected); Link Aggregation MUST increase every tool's damage by its rank percentage; Observability
  Stack MUST increase telemetry gained by its rank percentage; Hardened Config MUST reduce contact damage
  taken by its rank percentage.
- **FR-010a**: The new passives' early ranks MUST be strong enough that an early passive pick is not
  wasted (tuned so that random-choosing and first-choice players stay within SC-004's ±2 levels).
- **FR-010**: Passive percentages MUST be capped by data validation so no stat reaches zero or below
  (e.g. cooldown reduction and damage reduction at most 50% at rank 5).

**Repeatable upgrade**

- **FR-011**: When no tool, passive, or tool slot upgrade remains available in the run, every level-up
  MUST offer exactly two choices: Capacity Planning and Failover.
- **FR-011a**: Failover MUST restore 15% of maximum Uptime (previously 20%), capped at the maximum; the
  value lives in the game data and the level-up screen shows "Restore Uptime +15%".
- **FR-012**: Each time Capacity Planning is taken, all tools' damage MUST increase by its per-take
  percentage (from data), stacking without limit; it MUST NOT be offered while other upgrades remain.
- **FR-013**: The level-up choice for Capacity Planning MUST show times taken and the bonus before and
  after, using the level-up screen's wording.

**Presentation**

- **FR-014**: Each new tool MUST have a distinct play-field effect in the existing visual style, honour
  reduced motion, and produce sound through the feature 002 sound system.
- **FR-015**: The HUD loadout, level-up screen, end screen, and Field Guide (feature 005) MUST show the
  new tools, passives, and Capacity Planning with numbers identical to those the game applies (C6),
  including icons in the Field Guide.
- **FR-015a**: Wherever a tool stat is shown (level-up screen, Field Guide), it MUST show the rank value
  and, when passives or Capacity Planning change it, the effective value the game uses, e.g. "Damage 15
  (21 with bonuses)" or "Cooldown 0.6 s (0.48 s with bonuses)"; with no bonus in effect only the rank value
  is shown. Effective values are rounded for display only (at most 2 decimals) and computed by the same
  rules the game applies.
- **FR-016**: All new names, concepts, descriptions, and numbers MUST live in the validated game data;
  invalid entries MUST block Start with an error naming the item.

**Major Incident alerts (user request, changes feature 004's banners)**

- **FR-018**: Each active Major Incident MUST show a standing alert line, "MAJOR INCIDENT — {name} —
  {concept}", in pulsing red text until it is resolved (steady red with reduced motion), placed below the
  HUD and inside the safe area, clear of the touch buttons; two active incidents show two lines. When an
  incident is resolved its line MUST turn green, "RESOLVED — {name}", for about 3 seconds and then
  disappear. Each message is announced once to screen readers. Alerts clear when the run ends.

**Rules**

- **FR-017**: All new behaviour MUST be deterministic under the run's seed (C5) and work on desktop and
  touch devices without new controls.

### Non-Goals

- No tool evolutions or combinations (a possible later feature).
- No change to the 4-tool limit (Failover's heal amount is the only change to an existing upgrade), the 5-rank structure, the 20 difficulty levels, or enemies/incidents.
- No meta-progression or unlocks between runs.
- No rerolls, banishing, or skipping of level-up choices.

### Key Entities

- **Tool definition** (existing, extended): name, concept, description, kind (adds three kinds: chain,
  aura, zone), 5 ranks of stats for its kind.
- **Passive definition** (existing, extended): name, concept, description, 5 ranks; adds four stats
  (cooldown reduction %, damage %, telemetry gain %, damage reduction %).
- **Repeatable upgrade**: name, concept, description, per-take damage percentage; the engineer's count
  of times taken.
- **Level-up offer item** (existing, extended): adds a repeatable kind with times taken.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the seeded balance bot, in at least 8 of 10 runs that reach difficulty 15, the
  engineer still has non-repeatable upgrades available at difficulty 12 (today: exhausted around 8–12).
- **SC-002**: 0% of level-ups in any test run offer Failover as the only choice; every exhausted-pool
  level-up offers exactly Capacity Planning and Failover.
- **SC-003**: Across 20 seeded runs where the bot picks choices at random, at least 10 different 4-tool
  builds occur.
- **SC-004**: Difficulty stays fair: with the same bot, the median difficulty reached changes by at most
  2 levels from the current game, and the win rate does not rise by more than 20 percentage points. Checked
  for three player bots: tools-first, random choices, and always the first choice.
- **SC-005**: A reviewer can name the real networking concept behind each new tool, passive, and Capacity
  Planning from its in-game name and description (C1).
- **SC-006**: In a playtest, at least 4 of 5 players who reach difficulty 12 say their late-game
  level-up choices still felt worth making.

## Assumptions

- Numbers (damage, cooldowns, percentages) are tuned with the existing seeded balance simulation; the
  spec fixes the effects, not the exact values.
- Link Aggregation and Capacity Planning bonuses add together (e.g. +20% and +15% → +35% damage).
- Failover is otherwise unchanged; only its heal drops from 20% to 15% of maximum Uptime.
- New tool visuals are drawn in code like the existing ones; no image or audio files are added.
- The Field Guide (feature 005) needs only small additions (new icons, Capacity Planning entry); its
  "4 tools and 2 passives" wording becomes "every tool and passive".
