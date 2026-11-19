# Data Model: Uptime Survivors — First Playable

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-18

Two kinds of data exist:

1. **Authored content** — loaded from `data/game.json`, validated, then read-only (C6). Its exact
   file format is in [contracts/game-data.md](./contracts/game-data.md).
2. **Run state** — created by the engine for each run, held in memory only, discarded on reload
   (no persistence, per the spec's Non-Goals).

**Units** used everywhere: distance in world units (1 unit = 1 CSS pixel at default zoom), time in
seconds, speed in units/second, Uptime in points (the HUD shows it as a percentage of max).

## Authored content

### Settings

| Field | Type | Rule |
|-------|------|------|
| `schemaVersion` | integer | Must equal `1` |
| `player.maxUptime` | number | > 0 |
| `player.moveSpeed` | number | > 0 |
| `player.pickupRadius` | number | > 0 |
| `player.invulnerableSeconds` | number | ≥ 0 (spec default 0.5, FR-009) |
| `player.startingTool` | tool ID | Must exist in `tools` |
| `player.maxTools` | integer | ≥ 1 (spec: 4, FR-013) |
| `caps.enemies` | integer | > 0 (spec: 300, FR-020) |
| `caps.pickups` | integer | > 0 (spec: 200, FR-020) |
| `caps.projectiles` | integer | > 0 (plan: 400) |
| `progression.base`, `progression.perLevel` | number | > 0. Telemetry for next level = `base + perLevel × (level − 1)`; strictly increasing (FR-012) |
| `levelUp.choices` | integer | Must equal 3 (FR-013) |
| `levelUp.fallbackHealPercent` | number | 0–100 (Edge Cases: 20) |

### Enemy Type

| Field | Type | Rule |
|-------|------|------|
| `id` | kebab-case string | Unique across enemies |
| `name`, `concept`, `description` | string | Non-empty (C1: names the real network problem) |
| `shape` | `square` \| `triangle` \| `hexagon` \| `diamond` \| `octagon` | Unique per enemy type (FR-025b) |
| `color` | `#rrggbb` | Unique per enemy type (FR-025b) |
| `radius` | number | > 0 |
| `health`, `speed`, `contactDamagePerSecond` | number | > 0 |
| `telemetry` | integer | ≥ 1 (FR-010) |
| `behavior` | object | One of the kinds below |
| `debutLevel` | integer | 1–20 (FR-018) |

Behavior kinds:

| `kind` | Extra fields | Used by |
|--------|--------------|---------|
| `chase` | — | Dropped Packet, Latency Spike, DDoS Botnet |
| `split` | `count` (≥2), `scale` (0–1), `maxGenerations` (≥1) | Broadcast Storm — on defeat spawns `count` copies at `scale` size and health; copies of the last generation do not split |
| `blink` | `intervalSeconds` (> 0), `distance` (> 0) | Route Flap — every interval jumps `distance` toward the engineer |

### Tool

| Field | Type | Rule |
|-------|------|------|
| `id` | kebab-case string | Unique across tools and passives |
| `name`, `concept`, `description` | string | Non-empty (C1) |
| `kind` | `projectile-nearest` \| `orbit` \| `pulse` \| `spread` | — |
| `ranks` | array of 5 rank objects | Exactly 5 (FR-014); each numeric field > 0 |

Per-rank fields by kind:

| Kind | Fields per rank |
|------|-----------------|
| `projectile-nearest` (Ping) | `damage`, `cooldown`, `projectileSpeed`, `range`, `pierce` |
| `orbit` (Firewall Rule) | `damage`, `barriers`, `orbitRadius`, `rotationSpeed` (radians/s), `hitCooldown` |
| `pulse` (Ansible Playbook) | `damage`, `cooldown`, `radius` |
| `spread` (Load Balancer) | `damage`, `cooldown`, `projectiles`, `projectileSpeed`, `range` |

Upgrade text is generated from the difference between rank *n* and *n+1* using these same
numbers, so displayed values always match applied values (FR-015, C6).

### Passive

| Field | Type | Rule |
|-------|------|------|
| `id` | kebab-case string | Unique across tools and passives |
| `name`, `concept`, `description` | string | Non-empty (C1) |
| `ranks` | array of 5 objects | Exactly 5; fields from: `maxUptimeBonus`, `regenPerSecond`, `moveSpeedPercent`, `pickupRadiusPercent` (each ≥ 0, cumulative totals at that rank) |

### Difficulty Level

| Field | Type | Rule |
|-------|------|------|
| `level` | integer | Exactly 20 entries numbered 1–20 in order (FR-016) |
| `durationSeconds` | number | > 0 (spec: 60) |
| `spawnPerSecond` | number | > 0 |
| `healthMultiplier`, `damageMultiplier`, `speedMultiplier` | number | ≥ 1 |
| `mix` | object `{enemyId: weight}` | Weights > 0; every ID exists; an enemy may appear only at or after its `debutLevel` |

Cross-row rules (FR-017, FR-018, FR-019):

- Each level is ≥ the previous in `spawnPerSecond` and all three multipliers, and strictly greater
  in at least one.
- Each enemy appears in the `mix` of its `debutLevel`; debut banners are derived from `debutLevel`.
- Level 20's `mix` contains every enemy type, and level 20 has the highest multipliers.

## Run state (in memory)

### Run

| Field | Description |
|-------|-------------|
| `seed` | 32-bit integer; source of all engine randomness |
| `rng` | Seeded generator state |
| `phase` | See state transitions below |
| `tick` | Fixed steps elapsed (1 step = 1/60 s) |
| `elapsed` | `tick / 60` seconds |
| `difficultyLevel` | 1–20, derived from `elapsed` and level durations |
| `outcome` | `null` \| `win` \| `loss` |
| `stats` | `enemiesDefeated`, `timeSurvived`, `highestDifficulty` |
| `pendingLevelUps` | Count of level-ups not yet chosen (Edge Cases) |
| `offer` | Current level-up choices (up to 3), or `null` |
| `testOverrides` | `levelSeconds` if set by URL (R7) |

### Engineer

`x`, `y`, `uptime`, `maxUptime`, `moveSpeed`, `pickupRadius`, `invulnerableUntil`, `level`,
`telemetry`, `telemetryToNext`, `tools` (list of `{id, rank, cooldownLeft}`), `passives` (list of
`{id, rank}`). Derived stats (max Uptime, speed, radius) are recomputed from base settings plus
passive ranks whenever a passive changes.

### Enemy, Projectile, Pickup

- **Enemy**: `typeId`, `x`, `y`, `radius`, `health`, `speed`, `damagePerSecond`, `generation`
  (for splits), `blinkTimer`.
- **Projectile**: `toolId`, `x`, `y`, `vx`, `vy`, `damage`, `pierceLeft`, `distanceLeft`,
  `hitIds`.
- **Pickup**: `x`, `y`, `value`. Over the cap, the two oldest merge (Edge Cases).

### Level-up offer

Candidates: new tools (only if fewer than `maxTools` owned), owned tools below rank 5, passives
below rank 5. Draw up to 3 distinct candidates with the run's `rng`. If there are 0 candidates,
the offer is the fallback heal. Each offer item carries `{kind, id, fromRank, toRank, changes}`
where `changes` lists `{stat, from, to}` taken from the rank tables.

## State transitions

```text
loading ──valid data──▶ title ──Start──▶ playing
   └──invalid data──▶ error (lists item IDs; no Start)

playing ──telemetry bar full──▶ levelup ──choice made──▶ playing (or levelup again if more pending)
playing ──Esc/P or page loses focus──▶ paused ──Resume──▶ playing
paused ──Quit to Title──▶ title
playing ──uptime ≤ 0──▶ ended(loss)
playing ──level 20 timer ends, uptime > 0──▶ ended(win)
ended ──New Run──▶ playing (new seed)
ended ──Replay Seed──▶ playing (same seed)
```

Rules: the simulation advances only in `playing`. In a single step, damage is applied before the
win check, so reaching 0 Uptime on the final step is a loss (Edge Cases).

## Initial tuning

Starting values for playtesting (R10). These live in `data/game.json`, not code.

**Engineer**: max Uptime 100, move speed 160, pickup radius 60, invulnerability 0.5 s,
starting tool Ping, max 4 tools. **Telemetry**: base 3, +6 per level (3, 9, 15, …) — lowered from 5 so the
first level-up lands within 60 s (SC-002).

| Enemy | Shape / colour | HP | Speed | Contact dmg/s | Telemetry | Behavior | Debut |
|-------|----------------|----|-------|---------------|-----------|----------|-------|
| Dropped Packet | square / `#38bdf8` | 10 | 60 | 8 | 1 | chase | 1 |
| Latency Spike | triangle / `#facc15` | 6 | 130 | 6 | 2 | chase | 4 |
| Broadcast Storm | hexagon / `#f97316` | 30 | 70 | 10 | 4 | split ×3, scale 0.5, 1 gen | 8 |
| Route Flap | diamond / `#a855f7` | 25 | 80 | 12 | 5 | blink every 3 s, 80 units | 12 |
| DDoS Botnet | octagon / `#ef4444` | 200 | 40 | 20 | 20 | chase | 16 |

| Tool | Rank 1 → Rank 5 |
|------|-----------------|
| Ping | damage 10→22, cooldown 0.8→0.4 s, speed 400, range 350, pierce 1→3 |
| Firewall Rule | damage 8→16, barriers 1→4, orbit radius 70, 3 rad/s, 0.5 s per-enemy hit cooldown |
| Ansible Playbook | damage 15→40, cooldown 3→2 s, radius 90→140 |
| Load Balancer | damage 8→14, cooldown 1.2→0.8 s, projectiles 3→8, speed 350, range 300 |

| Passive | Rank 1 → Rank 5 (cumulative) |
|---------|------------------------------|
| Redundant Power Supply | +10→+50 max Uptime, regen 0.2→1.0 per s |
| Bandwidth Upgrade | +5→+25% move speed, +10→+60% pickup radius |

| Level | Spawn/s | HP× | Dmg× | Speed× | New enemy in mix |
|-------|---------|-----|------|--------|------------------|
| 1 | 1.2 | 1.0 | 1.0 | 1.00 | Dropped Packet |
| 2 | 1.4 | 1.0 | 1.0 | 1.00 | |
| 3 | 1.8 | 1.1 | 1.0 | 1.00 | |
| 4 | 2.0 | 1.1 | 1.0 | 1.00 | Latency Spike |
| 5 | 2.4 | 1.2 | 1.1 | 1.00 | |
| 6 | 2.8 | 1.3 | 1.1 | 1.00 | |
| 7 | 3.2 | 1.4 | 1.1 | 1.05 | |
| 8 | 3.4 | 1.5 | 1.2 | 1.05 | Broadcast Storm |
| 9 | 3.8 | 1.6 | 1.2 | 1.05 | |
| 10 | 4.2 | 1.7 | 1.3 | 1.10 | |
| 11 | 4.6 | 1.8 | 1.3 | 1.10 | |
| 12 | 4.8 | 1.9 | 1.4 | 1.10 | Route Flap |
| 13 | 5.2 | 2.0 | 1.4 | 1.10 | |
| 14 | 5.6 | 2.2 | 1.5 | 1.15 | |
| 15 | 6.0 | 2.4 | 1.5 | 1.15 | |
| 16 | 6.4 | 2.6 | 1.6 | 1.15 | DDoS Botnet |
| 17 | 7.0 | 2.8 | 1.7 | 1.20 | |
| 18 | 7.6 | 3.0 | 1.8 | 1.20 | |
| 19 | 8.4 | 3.3 | 1.9 | 1.20 | |
| 20 | 9.5 | 3.6 | 2.0 | 1.25 | (all five) |

All levels last 60 s. Mix weights favour the newest enemy lightly and keep Dropped Packet as the
most common type; exact weights are set in `data/game.json`.
