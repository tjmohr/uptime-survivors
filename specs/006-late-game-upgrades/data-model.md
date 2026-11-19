# Data Model: Late-Game Upgrades

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Units: game units (u), seconds (s), percentages as whole numbers (5 = 5%).

## Authored data (`data/game.json`)

### Tool Definition (feature 001, extended)

`kind` gains three values; each kind has exactly these rank stats (all numbers > 0; `hops` integer):

| Kind | Rank stats |
|------|-----------|
| `chain` | `damage`, `cooldown`, `range`, `hops` (integer ≥ 1), `hopRange` |
| `aura` | `damage` (per tick), `tickInterval`, `radius`, `slowPercent` (> 0 and ≤ 80) |
| `zone` | `damage` (per tick), `tickInterval`, `cooldown`, `range`, `radius`, `duration` |

New entries: `traceroute` (chain), `rate-limiter` (aura), `null-route` (zone). 7 tools total; ids unique
across tools, passives, enemies, incidents, and the repeatable.

### Passive Definition (feature 001, extended)

`PASSIVE_FIELDS` gains:

| Field | Rule |
|-------|------|
| `cooldownReductionPercent` | ≥ 0 and ≤ 50 |
| `damagePercent` | ≥ 0 |
| `telemetryGainPercent` | ≥ 0 |
| `damageReductionPercent` | ≥ 0 and ≤ 50 |

New entries (one stat each, all 5 ranks): `qos-policy` (cooldownReductionPercent), `link-aggregation`
(damagePercent), `observability-stack` (telemetryGainPercent), `hardened-config`
(damageReductionPercent). 6 passives total.

### Repeatable Upgrade (new top-level `repeatable`)

| Field | Rule |
|-------|------|
| `id` | kebab-case, unique across all ids (`capacity-planning`) |
| `name`, `concept`, `description` | strings, same length rules as tools |
| `damagePercentPerTake` | number > 0 |

### Level-up (feature 001, value change and addition)

| Field | Rule |
|-------|------|
| `levelUp.fallbackHealPercent` | unchanged rule (0–100); value changes 20 → 15 |
| `levelUp.toolFloor` | optional list of `{difficulty, tools}`: `difficulty` integer 1–20, strictly increasing; `tools` integer 1–`player.maxTools`, never decreasing. Shipped: `[{5,2},{10,3},{15,4}]` |

## Run state (engine, deterministic)

### Engineer (addition)

| Field | Type | Rule |
|-------|------|------|
| `capacityTakes` | integer | 0 at start; +1 each time Capacity Planning is chosen; hashed |

### Slow Field (`run.slowField`)

| Field | Type | Rule |
|-------|------|------|
| `x`, `y`, `radius` | number | Engineer position and aura radius this step |
| `factor` | number in (0, 1) | `1 − slowPercent/100`; `null` field when no online Rate Limiter |

Recomputed every step before enemy movement; affects ordinary enemies only (never incidents); hashed.

### Zone (`run.zones[]`)

| Field | Type | Rule |
|-------|------|------|
| `x`, `y`, `radius` | number | Placement and size |
| `damage`, `tickInterval` | number | Effective values at placement time |
| `expiresAt`, `nextTickAt` | number s | Removed at `expiresAt`; damages everything inside at each tick |

At most 8 zones; a new one beyond the cap is not placed (cooldown still spent). Hashed.

### Tool (feature 001, addition)

| Field | Type | Rule |
|-------|------|------|
| `tickLeft` | number s | Aura only: time to next damage tick |

### Level-up Offer Item (feature 001, extended)

| Field | Type | Rule |
|-------|------|------|
| `kind` | `tool` \| `passive` \| `heal` \| `repeatable` | `repeatable` only when the pool is empty |
| `timesTaken` | integer | Repeatable only: `capacityTakes` before choosing |
| `changes` | Stat Change[] | Repeatable: `[{stat: 'allDamagePercent', from: n·p, to: (n+1)·p}]` |
| `forced` | `true` \| absent | Set on every item of an offer made only of new tools because the engineer is below the tool floor |

Offer when the pool is empty: exactly `[repeatable, heal]`.

## Derived values (pure, `engine/stats.js`)

| Value | Rule |
|-------|------|
| `damagePercent` bonus | Link Aggregation rank value + `capacityTakes × damagePercentPerTake` |
| `cooldownReductionPercent` bonus | QoS Policy rank value |
| Effective `damage` | rank `damage × (1 + damagePercent/100)` |
| Effective `cooldown`, `hitCooldown` | rank value × `(1 − cooldownReductionPercent/100)` |
| Telemetry gained | pickup value × `(1 + telemetryGainPercent/100)` |
| Contact damage taken | amount × `(1 − damageReductionPercent/100)` |

## Engine events (additions)

| Event | Payload |
|-------|---------|
| `chain` | `{toolId, points: [{x, y}, …]}` (engineer first, then each hit) |
| `zone-placed` | `{x, y, radius, duration}` |
