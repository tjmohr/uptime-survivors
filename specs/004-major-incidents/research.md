# Research: Major Incident Boss Encounters

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Builds on features 001–003: a pure, seeded engine stepped at 1/60 s (`engine/run.js` `step`), enemies
in `run.enemies` with a spatial grid, tools that target the nearest enemy, telemetry pickups with a
cap that merges the oldest, `run.events` read by the renderer, screens, and audio director, and all
content in validated `data/game.json` / `data/audio.json`.

## R1 · An incident is an enemy with extra state

- **Decision**: An active Major Incident is an entry in `run.enemies` with `incidentId` set, so
  existing systems — weapon targeting and damage, the collision grid, contact damage, hit events,
  rendering order — handle it unchanged. Incident-only state (behaviour timers, arrival dash, base
  stats) lives on the same object. A new module `engine/incidents.js` owns arrival, behaviours,
  resolution, and the per-run incident records.
- **Rationale**: Reuses tested code paths (FR-006: all tools damage it); keeps determinism in one
  stepped list; minimal surface for bugs.
- **Alternatives considered**: A separate `run.incidents` list with its own targeting and collision
  (duplicates weapons/combat logic for three entities).

## R2 · Authored in `data/game.json`, validated

- **Decision**: New top-level `incidents` array in `data/game.json` (three entries) with absolute stats
  (no difficulty multipliers — FR-006 fixed strength), look, behaviour kind and parameters, and reward
  telemetry. New top-level `incidentSpawnFactor` (0.5, FR-005). Validated
  by `engine/content.js` with errors naming the incident id (C6).
- **Rationale**: Same rules and tooling as every other enemy; reviewers see the concepts in one file
  (C1 evidence).
- **Alternatives considered**: Hard-coding incidents in the engine (violates C6).

## R3 · Arrival: off-screen spawn plus an entry dash

- **Decision**: On the `difficulty-up` to an arrival level, spawn the incident at `SPAWN_DISTANCE`
  (720 units, always off-screen) in a seeded random direction and give it an **entry dash**: it moves
  at `entrySpeed` (data; default 240 u/s) toward the engineer until within `entryDistance` (default
  300 units), then at its normal speed. 420 units at 240 u/s ≈ 1.75 s, so it is on screen on every
  supported view (≥ 330 units, feature 003) within 2 s (FR-001, SC-001). Emits `incident-arrived`.
- **Rationale**: Slow incidents (Core Switch Failure) would otherwise take 10+ s to appear; a dash reads
  as "it arrives" and keeps the 2 s promise.
- **Alternatives considered**: Spawning inside the view (pops in; breaks the off-screen rule).

## R4 · Signature behaviours as small, data-driven kinds

| Incident | `behavior.kind` | Mechanics (parameters in data) |
|----------|-----------------|--------------------------------|
| Route Leak | `leak` | Every `intervalSeconds` (default 5) release `burst` (default 6) enemies of `minionType` (default `latency-spike`, small and fast) in a ring around it, at the current level's row; at most `maxAlive` (default 18) of its minions alive; minions respect the enemy cap |
| Core Switch Failure | `link-down` | Cycle: wait `cooldownSeconds` (12) → choose a tool with the seeded generator from owned tools that are online, excluding the case where it would leave none online → emit `link-warning` → after `warningSeconds` (1.5) set `tool.offlineUntil = elapsed + offlineSeconds` (4) → emit `link-down`; on resolution, all offline tools come back at once (`link-restored`) |
| Ransomware Outbreak | `infect` | Every `intervalSeconds` (default 1) ordinary enemies within `radius` (default 180) that are not infected become infected: health and max health × `healthMultiplier` (1.5), speed × `speedMultiplier` (1.3), `infected: true`; on resolution all infected enemies revert (speed back; health capped at their pre-infection max) and emit `infection-cleared` |

- **Rationale**: Each behaviour maps to its concept (C1) and is a short, testable state machine.
  Tool offline is enforced in `engine/weapons.js` by skipping tools with `offlineUntil > elapsed`.

## R5 · Lingering and overlap

- **Decision**: An incident stays in `run.enemies` until its health reaches 0 or the run ends
  (clarification Q1). Several may be active; each keeps its own timers. Strength is fixed at arrival
  (Q4). Ordinary spawning uses `rate × incidentSpawnFactor` while an incident is active **during its arrival
  level** — not compounded, and not for lingering incidents (FR-005, revised 2026-11-19 so that ignoring an
  incident never makes the run easier). The incident itself never counts toward the ordinary enemy cap; Route Leak
  minions do count, and a burst is cut short at the cap.

## R6 · Resolution and the reward pickup

- **Decision**: In `resolveDefeats`, a dead incident emits `incident-resolved`, records the outcome,
  undoes its behaviour (tools online, infections cleared), and drops **one** reward pickup with
  `reward: true` and `value = rewardTelemetry` (data). Reward pickups are never merged or dropped by the
  pickup cap (the merge rule skips them) and never expire. `rewardTelemetry` is authored per incident to
  be about one engineer level-up at its arrival level for a typical build (spec Q2), checked by the
  balance simulation (R8).
- **Visual**: drawn 2.5× the normal pickup size with a pulsing glow (sine pulse, 1.2 s period); a steady
  glow under reduced motion. Each uncollected reward pickup has its own telemetry-style edge pointer, shown
  alongside any incident pointers.

## R7 · UI and sound

- **HUD**: an incident panel under the top row lists each active incident: name + health bar (stacked
  when two or three). Loadout entries show "OFFLINE" for offline tools and a short "Link down in 1.5 s:
  Ping" warning line. Edge pointers (canvas, screen space) for off-screen incidents and the reward,
  kept inside the safe-area-adjusted HUD bounds (feature 003).
- **Banners**: `incident-arrived` → threat-style banner "MAJOR INCIDENT — Route Leak — BGP route leak",
  queued before a same-level "New threat" banner (spec edge case); `incident-resolved` → "RESOLVED —
  Route Leak". Both announced through the live region.
- **End screen**: an "Incidents" row: resolved / unresolved / not reached for each.
- **Sound (feature 002 data)**: two new effects `incidentAlarm` and `incidentResolved` (effect list grows
  from 10 to 12; the validator and its tests are updated), and a music layer with `"trigger":
  "incident"` instead of `joinLevel`, active while any incident is active (switches on the next bar).
  The director maps `incident-arrived` / `incident-resolved` and tracks the active count.

## R8 · Balance evidence by simulation

- **Decision**: A terminal script `tests/balance/incidents.mjs` (jsc/Node) runs 10 seeded full runs with
  a scripted player (circling movement, test-only invincibility, first upgrade at each level-up — the
  "typical build" in the spec) and reports, per incident, time from arrival to resolution and reward
  value vs. the level-up cost at that moment. Targets: 30–60 s in ≥ 7 of 10 seeds (SC-002); reward
  within 0.8–1.5 level-ups. A second mode without invincibility re-checks feature 001's difficulty
  proxy (bot runs ending around levels 7–14) so incidents do not make the game far harder (SC-003
  proxy).
- **Outcome (2026-11-19)**: a plain circling bot outran the slow incidents and resolved none, so the
  simulation's player plays "focused" (keeps ~150 u from an active incident and circles it), matching the
  spec's "focused play". With that bot S1 passes after data tuning; the R8 fallback was not needed. S2
  showed strong late-game runs ending at incidents (4 baseline wins → 0). Traced to the bot fighting at
  close range inside the horde; softening the incidents, a wider orbit, and incident-first aiming (tried and
  reverted) did not change that, so the R8 fallback is **not** adopted and difficulty is left to a human
  playtest.
- **Risk**: Tools target the nearest enemy, so a dense horde can shield the incident. If the 30–60 s
  target cannot be met with health tuning alone, the fallback is projectile tools preferring an
  incident within range — recorded as a design change if used.

## R9 · Determinism and hashing

- **Decision**: All incident randomness (direction, tool choice, minion placement) uses `run.rng`.
  `hashRun` adds incident state (incident ids/health/timers, infected flags, tool `offlineUntil`,
  reward flags, incident records). Existing determinism tests compare runs to each other (no stored
  golden hashes), so adding fields is safe.

## R10 · Constitution and scope

- **Finding**: The First Release Scope already includes "new enemy types appear every few levels" and
  data-driven difficulty; incidents are authored enemies at fixed levels. No amendment needed. C1:
  each incident names a real concept; C5: seeded; C6: data + validation; C7: evidence below.
