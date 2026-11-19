# Data Model: Major Incident Boss Encounters

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

Units: game units (u), seconds (s), u/s for speeds. Stats are absolute — difficulty multipliers never
apply to incidents (FR-006).

## Authored data (`data/game.json`)

### Top level (additions)

| Field | Type | Rule |
|-------|------|------|
| `incidents` | array of Incident Definition | Exactly 3 entries; unique `id`; unique `arrivalLevel` |
| `incidentSpawnFactor` | number | > 0 and ≤ 1 (spec: 0.5, FR-005); applies only while an incident is active during its own arrival level |

### Incident Definition

| Field | Type | Rule |
|-------|------|------|
| `id` | kebab-case string | Unique across incidents **and** enemies, tools, passives |
| `name` | string | 1–40 characters (banner, HUD) |
| `concept` | string | 1–80 characters; the real networking concept (C1) |
| `description` | string | 1–200 characters |
| `arrivalLevel` | integer | 2–20; the spec's values are 7, 12, 18 |
| `shape` | one of feature 001 `SHAPES` | — |
| `color` | `#rrggbb` | — |
| `radius` | number | > largest ordinary enemy radius and ≤ 80 (FR-004) |
| `health` | number | > 0 |
| `speed` | number | > 0 (u/s, after arrival) |
| `entrySpeed` | number | ≥ `speed` (u/s, during the entry dash) |
| `entryDistance` | number | > 0 and < 720 (dash ends inside this distance) |
| `contactDamagePerSecond` | number | > 0 (FR-007: tuned above ordinary enemies at that level) |
| `rewardTelemetry` | integer | ≥ 1 (reward pickup value, spec Q2) |
| `behavior` | Incident Behavior | See below |

### Incident Behavior (`behavior.kind` + parameters, all required for that kind, no extras)

| Kind | Field | Type | Rule |
|------|-------|------|------|
| `leak` | `intervalSeconds` | number | > 0 |
| | `burst` | integer | ≥ 1 |
| | `maxAlive` | integer | ≥ `burst` |
| | `minionType` | enemy id | Must exist in `enemies` |
| `link-down` | `cooldownSeconds` | number | > `warningSeconds` + `offlineSeconds` (spec: 12) |
| | `warningSeconds` | number | > 0 (spec: 1.5) |
| | `offlineSeconds` | number | > 0 (spec: 4) |
| `infect` | `intervalSeconds` | number | > 0 |
| | `radius` | number | > 0 |
| | `healthMultiplier` | number | ≥ 1 |
| | `speedMultiplier` | number | ≥ 1 |

## Authored data (`data/audio.json`, feature 002 additions)

| Field | Rule |
|-------|------|
| `effects.incidentAlarm`, `effects.incidentResolved` | Sound Effect Definition (feature 002 rules); alarm and resolution ≤ 3000 ms like `win`/`loss` |
| Music Layer `trigger` | Optional `"incident"`; a layer has **either** `joinLevel` **or** `trigger`, never both; exactly one layer has `trigger: "incident"` |

## Run state (engine, deterministic)

### Active Incident (an entry in `run.enemies`)

Ordinary enemy fields plus:

| Field | Type | Rule |
|-------|------|------|
| `incidentId` | string | Incident Definition id; marks this enemy as an incident |
| `phase` | `entering` \| `active` | `entering` until within `entryDistance`, then `active` |
| `timer` | number s | Behaviour timer |
| `linkState` | `idle` \| `warning` | `link-down` only |
| `pendingTool` | tool id \| null | `link-down` only: tool named in the warning |

### Tool (feature 001, addition)

| Field | Type | Rule |
|-------|------|------|
| `offlineUntil` | number s | 0 when online; tool does not fire while `offlineUntil > elapsed`; never all owned tools offline |

### Ordinary Enemy (feature 001, additions)

| Field | Type | Rule |
|-------|------|------|
| `infected` | boolean | Set by `infect`; cleared on resolution |
| `baseSpeed`, `baseMaxHealth` | number | Saved when infected, restored on clearing (health capped to `baseMaxHealth`) |
| `leakedBy` | entity id \| null | Set on Route Leak minions (for `maxAlive`) |

### Pickup (feature 001, addition)

| Field | Type | Rule |
|-------|------|------|
| `reward` | boolean | True for incident rewards: never merged or removed by the pickup cap |

### Incident Record (`run.incidents`)

| Field | Type | Rule |
|-------|------|------|
| `id` | incident id | One record per Incident Definition |
| `state` | `not-reached` \| `active` \| `resolved` | Starts `not-reached`; `active` on arrival; `resolved` on defeat. At run end, `active` is reported as **unresolved** (FR-013) |
| `arrivedAt`, `resolvedAt` | number s \| null | For the summary and balance simulation |

### State transitions

```text
not-reached ──difficulty-up to arrivalLevel──▶ active (entering → active)
active ──health ≤ 0──▶ resolved (reward pickup dropped; tools restored; infections cleared)
active ──run ends──▶ reported "unresolved"
```

## Engine events (additions to feature 001's list)

| Event | Payload |
|-------|---------|
| `incident-arrived` | `{incidentId, x, y}` |
| `incident-resolved` | `{incidentId, x, y}` |
| `link-warning` | `{incidentId, toolId, inSeconds}` |
| `link-down` | `{incidentId, toolId, seconds}` |
| `link-restored` | `{toolId}` |
| `infected` | `{count}` (enemies newly infected this step; omitted when 0) |
| `infection-cleared` | `{count}` |
| `leak` | `{incidentId, count}` |
