# Feature Specification: Major Incident Boss Encounters

**Feature Branch**: `004-major-incidents`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Add Major Incident boss encounters at difficulty levels 7, 12, and 18."

## Overview

A run of Uptime Survivors climbs steadily through 20 difficulty levels, but nothing marks a turning
point. This feature adds three **Major Incidents**: single, much larger enemies that arrive at the
start of difficulty levels 7, 12, and 18, each themed on a real large-scale network incident and each
with one signature behaviour the player must deal with. A Major Incident is announced with a banner,
shows a health bar while active, changes the music, and rewards the player when resolved.

The run's structure stays the same: 20 levels of 60 seconds, surviving level 20 wins (constitution
First Release Scope). Major Incidents are authored in the game data like every other enemy (C6),
tied to a real networking concept (C1), and fully deterministic (C5).

## Clarifications

### Session 2026-11-19

- Q: What happens to an unresolved incident when its level ends? → A: It stays until resolved, even
  into later levels; if it is still active when the next incident arrives, both are active at once.
- Q: What does resolving an incident give the player? → A: One large telemetry drop (about one level-up),
  visibly bigger than normal telemetry and pulsing with a glow until collected.
- Q: Is knocking one tool offline the right behaviour for Core Switch Failure? → A: Yes, but warned and
  bounded: a HUD warning names the tool about 1.5 s ahead, it is offline for 4 s, at most once every
  12 s, never the last working tool.
- Q: How strong should each Major Incident be? → A: Medium — a typical build resolves it in about
  30–60 s; its health and damage stay fixed if it lingers into later levels.
- Q: How much should ordinary spawning slow while a Major Incident is active? → A: To half the
  level's normal rate while any incident is active (not reduced further if two are active).
  *Revised 2026-11-19 after the balance simulation:* only during the incident's **arrival level**; once
  that level ends, spawning returns to full rate even if the incident is still active, so ignoring an
  incident never makes the run easier.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Face a Major Incident (Priority: P1)

When difficulty level 7 begins, the player sees a "MAJOR INCIDENT" banner naming the incident and its
real-world concept, hears an alarm, and a large enemy enters from off-screen. A health bar shows how
much is left. The player keeps moving and their tools damage it like any enemy; when its health
reaches zero, the incident is resolved, a "RESOLVED" banner appears, and the player is rewarded.

**Why this priority**: The encounter itself — arrival, fight, resolution — is the feature; it works
with even one incident.

**Independent Test**: Start a run with the shortened-timer setting; at level 7 the incident arrives
with banner, alarm, and health bar; damage it to zero and see it resolve and the reward applied.

**Acceptance Scenarios**:

1. **Given** a run reaching the start of difficulty level 7, **When** the level begins, **Then** a
   banner announces the Major Incident with its name and networking concept, a distinct alarm sound
   plays, and the incident enters from off-screen within 2 seconds.
2. **Given** an active Major Incident, **When** it is on or off screen, **Then** a health bar with
   its name is visible in the HUD, and an on-screen pointer shows its direction when it is
   off-screen.
3. **Given** an active Major Incident, **When** the player's tools hit it, **Then** it takes damage
   like other enemies, and its health bar updates.
4. **Given** the incident's health reaches zero, **When** it is resolved, **Then** a "RESOLVED"
   banner appears, a resolution sound plays, and a large, glowing, pulsing telemetry pickup drops
   where it was resolved; collecting it gives about one level-up.
5. **Given** the incident touches the engineer, **When** contact continues, **Then** it drains
   Uptime faster than any ordinary enemy at its arrival level.
6. **Given** normal enemies are spawning, **When** an incident is active during its arrival level,
   **Then** the regular horde continues at half rate, so the incident is the focus without the screen
   going empty; if it is still active after that level, the horde returns to full rate.

---

### User Story 2 - Three different incidents (Priority: P1)

Each of the three Major Incidents behaves differently, so each feels like a new problem to solve,
and each teaches a real networking concept:

| Level | Major Incident | Real concept | Signature behaviour |
|-------|----------------|--------------|---------------------|
| 7 | **Route Leak** | BGP route leak: routes advertised beyond their intended scope, pulling traffic the wrong way | Every few seconds it "leaks routes": a burst of small fast enemies is released around it |
| 12 | **Core Switch Failure** | Single point of failure in the network core | Very tough and slow; at most once every 12 s it warns, then knocks one of the engineer's tools offline ("link down") for 4 s |
| 18 | **Ransomware Outbreak** | Malware spreading laterally across a network | Infects nearby enemies, making them tougher and faster until the outbreak is resolved |

**Why this priority**: Three copies of one boss would not justify the feature; distinct behaviour is
what makes each incident memorable and ties it to its concept.

**Independent Test**: Using the test settings, reach each incident; observe its signature behaviour
at least twice; resolve it.

**Acceptance Scenarios**:

1. **Given** Route Leak is active, **When** its interval passes, **Then** it releases a burst of
   small enemies around itself, at most a fixed number alive at once.
2. **Given** Core Switch Failure is active and the engineer owns two or more tools, **When** its
   interval passes, **Then** the HUD first warns which tool is about to go down (about 1.5 s ahead),
   then that tool stops firing for 4 s with its HUD entry shown as offline, and comes back
   automatically; this happens at most once every 12 s, and the engineer always keeps at least one
   working tool.
3. **Given** Ransomware Outbreak is active, **When** ordinary enemies come near it, **Then** they
   become "infected" (visibly marked), tougher, and faster; infection ends when the outbreak is
   resolved.
4. **Given** any incident, **When** the player reads its banner, **Then** the name and concept are
   recognisable to a network engineer (constitution C1).

---

### User Story 3 - The run still flows (Priority: P1)

Major Incidents raise the stakes without breaking the run: the 20-minute structure, pausing, level-up
choices, sound, touch controls, and determinism all behave as before.

**Why this priority**: A boss that freezes the timer, stacks unfairly, or breaks replays would undo
the existing features.

**Independent Test**: Play a fast run through level 20 with the same seed twice; incidents appear at
7, 12, and 18 both times with identical outcomes; pause and level-up screens work during incidents.

**Acceptance Scenarios**:

1. **Given** a Major Incident is active, **When** the difficulty level ends, **Then** the run moves to
   the next level on time, as always (difficulty timing is never paused by an incident).
2. **Given** an incident has not been resolved when its level ends, **When** play continues, **Then**
   it stays until resolved — even into later levels — and if it is still active when the next
   incident arrives, both are active at once, each with its own health bar and pointer.
3. **Given** the same seed and inputs, **When** a run is replayed, **Then** incidents arrive at the
   same moments, behave identically, and the run ends the same way.
4. **Given** an active incident, **When** the game is paused or a level-up screen is open, **Then**
   the incident freezes like everything else.
5. **Given** the run ends (win or loss) during an incident, **When** the end screen shows, **Then**
   the summary lists which incidents were resolved.

---

### Edge Cases

- **Level 12 also debuts a new enemy type** (Route Flap): both banners show, the incident banner
  first; the regular debut still happens.
- **Engineer owns only one tool when Core Switch Failure strikes**: no tool is taken offline.
- **A tool taken offline when the incident is resolved**: it comes back immediately.
- **Many infected enemies when Ransomware Outbreak is resolved**: they return to normal at once.
- **Route Leak's burst at the enemy cap**: the burst is reduced to fit under the existing enemy cap;
  the incident itself never counts against the cap.
- **Fast-run test setting** (very short levels): incidents still arrive at levels 7, 12, and 18.
- **Reduced motion**: incident visuals avoid flashing/shaking, as with other effects.
- **Touch play**: the health bar and pointer stay inside the safe area and do not overlap the Pause
  and Sound buttons.
- **Incident lingering several levels**: it keeps its arrival-level strength, so the player's growing
  build eventually overtakes it.
- **Two incidents at once** (an earlier one never resolved): both stay active with separate health bars
  stacked in the HUD and separate pointers; the music's incident layer plays once.
- **An incident still active when the run is won at the end of level 20**: the run is still won; the
  summary lists it as unresolved.
- **The reward pickup off-screen or far away**: it stays until collected (it does not expire), keeps
  pulsing, and gets its own edge pointer (styled like telemetry, distinct from incident pointers),
  shown alongside any active incidents' pointers until collected.
- **Muted or unavailable sound**: incidents work the same; nothing is conveyed only by sound.

## Requirements *(mandatory)*

### Functional Requirements

**Arrival and presence**

- **FR-001**: Exactly three Major Incidents MUST occur per run, arriving at the start of difficulty
  levels 7, 12, and 18, each entering from off-screen within 2 seconds of its level beginning.
- **FR-002**: On arrival, a banner MUST show "MAJOR INCIDENT", the incident's name, and its
  networking concept, and MUST be announced to assistive technology.
- **FR-003**: While an incident is active, the HUD MUST show its name and a health bar, and an
  on-screen pointer MUST indicate its direction whenever it is off-screen.
- **FR-004**: A Major Incident MUST be visibly larger than ordinary enemies and use the game's
  network-diagram visual style with its own distinct shape or colour.
- **FR-005**: While an incident is active **during its own arrival level**, ordinary enemy spawning MUST
  continue at half the current level's normal rate (authored in data; default 0.5). It returns to the
  full rate when that incident is resolved or when its arrival level ends — a lingering incident does
  not slow spawning in later levels. Enemies released by Route Leak are not ordinary spawns and do not count
  toward this rate.

**Combat and behaviour**

- **FR-006**: All of the engineer's tools MUST be able to damage a Major Incident; its health MUST be
  set so that a typical build at its arrival level resolves it in 30–60 seconds of focused play. An
  incident's health, speed, and contact damage are fixed at arrival and MUST NOT grow if it lingers
  into later levels (later difficulty multipliers do not apply to it).
- **FR-007**: Contact with an incident MUST drain Uptime faster than contact with any ordinary enemy at
  the incident's **arrival** level. Its strength is fixed after arrival (FR-006), so a lingering
  incident may later be matched or outpaced by scaled ordinary enemies.
- **FR-008**: Route Leak MUST periodically release a burst of small, fast enemies around itself, with
  a cap on how many of its released enemies are alive at once.
- **FR-009**: Core Switch Failure MUST take one owned tool offline at most once every 12 s (default):
  the HUD MUST name the tool about 1.5 s before it goes down, the tool MUST stay offline for 4 s
  (default), it MUST never be the last working tool, it MUST be shown as offline in the HUD, and it
  MUST come back automatically — immediately if the incident is resolved. The tool chosen comes from
  the seeded generator (FR-015).
- **FR-010**: Ransomware Outbreak MUST infect ordinary enemies within a radius, making them visibly
  marked, tougher, and faster; all infections MUST end when it is resolved.
- **FR-011**: Behaviour intervals, burst sizes, offline durations, infection radius and strength,
  health, speed, and contact damage MUST be authored in the game data and validated before play
  (constitution C6).

**Resolution and reward**

- **FR-012**: When an incident's health reaches zero, a "RESOLVED" banner and a resolution sound MUST
  play, and the incident MUST drop one large telemetry pickup where it was resolved, worth about one
  engineer level-up at that point in the run. The pickup MUST be visibly bigger than ordinary
  telemetry and pulse with a glow until collected (no glow pulse under reduced motion: a steady glow
  instead). It is collected like any telemetry and is never merged or removed by the pickup cap.
- **FR-013**: The end-of-run summary MUST list each incident as resolved, unresolved, or not reached.

**Run integrity**

- **FR-018**: An unresolved incident MUST stay active until resolved or the run ends; if two incidents
  are active at once, each MUST keep its own health bar and pointer, both signature behaviours MUST
  run, and ordinary spawning MUST NOT be reduced further (FR-005: only an incident in its
  arrival level slows spawning).
- **FR-014**: Incidents MUST NOT pause or change difficulty-level timing; a full winning run MUST still
  last 20 minutes ± 5 seconds (feature 001 SC-003).
- **FR-015**: Incident arrival, behaviour, and resolution MUST be fully deterministic from the seed
  and input sequence (constitution C5).
- **FR-016**: Pause, level-up screens, sound ducking, touch controls, and reduced motion MUST work
  during incidents exactly as at other times.

**Sound**

- **FR-017**: Incident arrival MUST play a distinct alarm, resolution MUST play a distinct sound, and
  the music MUST add an "incident" layer while an incident is active *(feature 007: now one incident part
  per song, in that song's key — see [007 FR-012](../007-drum-and-bass-music/spec.md))*; these sounds are added to the
  sound data and validated with it (feature 002).

### Non-Goals

- No new ordinary enemy types, tools, or passives.
- No incidents at levels other than 7, 12, and 18; no random or optional incidents.
- No multi-phase boss fights, cutscenes, or dialogue.
- No achievements, unlocks, or saved records of resolved incidents (no persistence).
- No change to run length or the win condition.

### Key Entities

- **Major Incident Definition**: id, name, concept, description, arrival level, health, speed,
  size, contact damage, look, signature behaviour and its parameters, reward.
- **Reward Pickup**: one large telemetry pickup per resolved incident; value, position, and glow; not
  subject to merging or the pickup cap.
- **Active Incident**: which incident, current health, position, behaviour timers, state (arriving,
  active, resolved; may stay active across later levels; up to three at once), and any tools taken offline or enemies infected.
- **Incident Record**: per run, each incident's outcome (resolved, unresolved, not reached), shown in
  the end-of-run summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of runs that reach them, incidents arrive at the start of difficulty levels 7, 12,
  and 18, each visible within 2 seconds of its banner.
- **SC-002**: In simulated runs with a scripted player using a typical build, each incident is
  resolved within 30–60 seconds of focused play in at least 7 of 10 seeds.
- **SC-003**: Overall difficulty stays moderate (feature 001 SC-011 still met): in playtesting, at least
  3 of 5 first-time players' first runs still end between difficulty levels 8 and 14.
- **SC-004**: A full winning run still lasts 20 minutes ± 5 seconds.
- **SC-005**: Replaying the same seed and inputs reproduces identical incident behaviour and outcomes
  in 100% of repeated runs.
- **SC-006**: A reviewer can name the real networking concept behind each incident from its banner
  alone (3 of 3).
- **SC-007**: At least 3 of 5 playtesters name a Major Incident as a highlight of the run.
- **SC-008**: With an incident active and 300 enemies on screen, gameplay stays as smooth as feature 001
  SC-005 requires, on desktop and in the feature 003 phone checks.

## Assumptions

- The three incident identities (Route Leak, Core Switch Failure, Ransomware Outbreak) and their
  behaviours are starting proposals; names and numbers live in data and can be tuned.
- "Typical build" for SC-002 means the build a scripted player reaches by taking the first offered
  upgrade at each level-up, as in feature 001's balance simulations.
- Incidents enter from a random off-screen direction chosen by the seeded generator.
- The incident pointer and health bar are part of the HUD and follow feature 003's safe-area rules.
- Adding incident sounds and a music layer extends feature 002's sound data; that feature's 10 effect
  names are extended to include the alarm and resolution sounds.
- Major Incidents fit the constitution's First Release Scope ("enemy count and strength increase each
  difficulty level, and new enemy types appear every few levels"); no amendment is expected.
