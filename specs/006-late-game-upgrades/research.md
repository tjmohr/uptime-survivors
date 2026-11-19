# Research: Late-Game Upgrades

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

No `NEEDS CLARIFICATION` items remained after the clarify session; these decisions settle the design
against the existing code (features 001–005).

## R1 · One place that computes effective tool stats

- **Decision**: New pure module `engine/stats.js`:
  - `bonusTotals(run)` → `{ damagePercent, cooldownReductionPercent }`, where `damagePercent` is
    Link Aggregation's rank value plus `capacityTakes × repeatable.damagePercentPerTake`
    (spec assumption: the two add) and `cooldownReductionPercent` is QoS Policy's rank value.
  - `effectiveToolStats(run, toolId, rank)` → the rank's stats with `damage × (1 + damagePercent/100)`
    and `cooldown` / `hitCooldown` × `(1 − cooldownReductionPercent/100)`; every other stat unchanged.
  - `engine/weapons.js` reads tool stats only through `effectiveToolStats`.
- **Rationale**: Clarification Q1 shows both the rank value and the effective value; C6 requires the
  shown value to equal what the game uses. One function used by the engine **and** the UI guarantees it.
- **Alternatives**: Applying bonuses inside each tool kind's code — duplicates the rule and lets the UI
  drift from it.

## R2 · Three new tool kinds

| Kind | Tool | Stats (per rank) | Behaviour |
|------|------|------------------|-----------|
| `chain` | Traceroute | `damage`, `cooldown`, `range`, `hops`, `hopRange` | Fires at the nearest problem within `range` (waits if none, like Ping); then up to `hops` more times jumps to the nearest not-yet-hit problem within `hopRange` of the last one. Damage is instant. Emits one `chain` event with the hit points (renderer draws the path) and a `fire` event (sound). |
| `aura` | Rate Limiter | `damage`, `tickInterval`, `radius`, `slowPercent` | Always on while online. Every `tickInterval` seconds damages every problem within `radius` (incidents included). Each step it publishes `run.slowField = {x, y, radius, factor}`; ordinary enemies inside move at `speed × (1 − slowPercent/100)`; incidents ignore it (clarification Q3). No `fire` sound per tick. |
| `zone` | Null Route | `damage`, `tickInterval`, `cooldown`, `range`, `radius`, `duration` | When a problem is within `range`: picks the problem with the most other problems within `radius` of it (ties → lowest entity id, so no randomness is needed and it stays deterministic), places a zone there for `duration`, damaging everything inside every `tickInterval`. Zones live in `run.zones`, are capped (8), are hashed, and emit `zone-placed` (sound: existing `pulse`). |

- `cooldown` of `zone`/`chain` and the aura's `tickInterval` are not reduced by QoS for the aura's tick
  (the aura has no cooldown); QoS reduces `cooldown` and `hitCooldown` only (FR-009 wording "cooldown";
  orbit: hit cooldown). Recorded so the Field Guide shows the same.
- Slow application: `engine/behaviors.js` multiplies an ordinary enemy's step speed by the slow factor
  when inside `run.slowField`; the stored `enemy.speed` never changes, so leaving the field restores speed
  at once and Ransomware infection (004) composes (infected speed × slow).
- **Rationale**: Each kind maps to its networking concept (hop-by-hop path, policing a rate around you,
  black-holing a prefix) and reuses existing pieces (nearest-target search, grid queries, damage, events).
- **Alternatives**: Random zone placement among dense spots via `run.rng` — works but makes tests harder;
  the deterministic densest-with-tie-break rule satisfies C5 without consuming randomness.

## R3 · Passive stats

- **Decision**: `PASSIVE_FIELDS` gains `cooldownReductionPercent`, `damagePercent`, `telemetryGainPercent`,
  `damageReductionPercent`. Validation caps `cooldownReductionPercent` and `damageReductionPercent` at 50
  per rank (FR-010); others ≥ 0.
  - Observability Stack: `updatePickups` adds `value × (1 + g/100)` (fractional telemetry is fine; the
    bar already handles it). Applies to incident rewards too.
  - Hardened Config: `applyContactDamage` multiplies the amount by `(1 − r/100)`.
- **Rationale**: Same pattern as the existing passives (`passiveTotals`), so no new mechanism.

## R4 · Capacity Planning and the exhausted pool

- **Decision**: New top-level data object `repeatable` `{id, name, concept, description,
  damagePercentPerTake}` (one item). The engineer gains `capacityTakes` (0 at start). `buildOffer`:
  - pool not empty → unchanged (up to 3 from tools/passives);
  - pool empty → exactly `[repeatable, heal]` in that order (keys 1 and 2), clarification Q2.
  - `levelUp.fallbackHealPercent` changes to 15 in data.
  - The offer item for Capacity Planning is `{kind: 'repeatable', id, timesTaken, changes: [{stat:
    'allDamagePercent', from: n×p, to: (n+1)×p}]}`.
- **Rationale**: Keeps the single offer path; the heal remains a real choice (power vs. survival).
- **Alternatives**: Several repeatables — out of scope (spec lists one).

## R5 · Showing rank and effective values

- **Decision**: `ui/stattext.js` gets `describeStat(stat, rankChange, effective)` which appends
  " (X with bonuses)" when the effective value differs from the rank value (rounded to ≤ 2 decimals,
  display only). Level-up lines: "Damage 15 → 18 (22 with bonuses)" (effective of the *new* rank with the
  *current* bonuses). Field Guide stats: "Damage 15 (21 with bonuses)". New labels: Hops, Hop range,
  Slow (%), Tick interval (s), Duration (s), the four passive stats, and "All tool damage" for Capacity
  Planning.
- **Rationale**: Clarification Q1, with numbers from `effectiveToolStats` (R1).

## R6 · Presentation

- **Render** (`ui/render.js`): Traceroute — a bright polyline through the hit points, fading in 0.2 s
  (reduced motion: drawn once, no fade); Rate Limiter — a faint dashed circle at `radius` around the
  engineer while online (reduced motion: static); Null Route — a dark disc with a violet rim for its
  duration (reduced motion: no pulsing). Colours added to `ui/icons.js › TOOL_COLORS`.
- **Sound**: no new effects; Traceroute uses `fire`, Null Route placement uses `pulse`; aura ticks
  produce `hit` events like other tools (already capped by the director). `data/audio.json` unchanged.
- **Field Guide** (feature 005): icons for the three new kinds and four passives; a Capacity Planning
  entry (times taken, total bonus) after the passives; stats lines use R5. **HUD / end screen**: list
  Capacity Planning as "Capacity Planning ×n" when n > 0.
- **Text**: Failover's text stays in `ui/screens.js` (existing); only its number changes (data).

## R7 · Balance verification

- **Decision**: New `tests/balance/upgrades.mjs` (jsc, per-seed arguments like `incidents.mjs`) using the
  feature 004 bot movement:
  - **S1 (SC-001)**: 10 seeds, invincible, choice 0: difficulty at which the pool empties.
  - **S2 (SC-002)**: same runs: every offer with a heal also offers Capacity Planning, length 2.
  - **S3 (SC-003)**: 20 seeds, choices picked by a separate seeded RNG: count distinct 4-tool builds.
  - **S4 (SC-004)**: 10 seeds, not invincible: median difficulty reached and win count, new data vs.
    **baseline** = the same data with the new tools, passives, and repeatable removed and heal 20%.
- Tune rank numbers in `data/game.json` until S1–S4 pass; record results honestly (004 precedent).

## R8 · Determinism and performance

- `hashRun` adds `run.zones`, `capacityTakes`, and `run.slowField`. No new randomness.
- Aura and zones use the spatial grid (`queryCircle`), like the pulse tool; zone cap 8; Traceroute at most
  `hops + 1` hits. Checked by the existing 300-enemy performance checks (desktop F5, phone T9) with the
  new tools owned.
