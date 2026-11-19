# Data Model: Field Guide

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

No authored data changes: `data/game.json` and `data/audio.json` are unchanged, and the guide shows only
fields that are already validated (feature 001 and 004 rules).

## Run state (engine, deterministic)

### Encounter Record (`run.encountered`)

| Field | Type | Rule |
|-------|------|------|
| `run.encountered` | array of id strings | Created empty by `createRun`. Holds enemy type ids and incident ids, each at most once, in order first met. Only grows during a run; a new run starts empty; never saved. Included in `hashRun`. |

Transitions:

```text
(absent) ──spawnEnemy(typeId) first time this run──▶ typeId appended
(absent) ──arriveIncidents(incidentId)──▶ incidentId appended
```

`spawnEnemy` covers ordinary spawns, Broadcast Storm splits, and Route Leak minions.

## Guide model (UI, derived, never stored)

`buildGuide(run)` in `ui/guide.js` returns a new object each call; it reads the run and never changes it.

### Guide

| Field | Type | Rule |
|-------|------|------|
| `problems` | array of Problem Entry | Every enemy type, sorted by `debutLevel` ascending (data order breaks ties) |
| `incidents` | array of Problem Entry | Every incident, sorted by `arrivalLevel` ascending |
| `loadout` | array of Loadout Entry | Every tool in data order, then every passive in data order |

### Problem Entry (enemy or Major Incident)

| Field | Type | Rule |
|-------|------|------|
| `id` | string | Enemy or incident id |
| `kind` | `enemy` \| `incident` | — |
| `locked` | boolean | `true` when `id` is not in `run.encountered` (FR-011) |
| `shape` | one of `SHAPES` | Always present (silhouette when locked) |
| `color` | `#rrggbb` \| null | Data colour; `null` when locked |
| `name`, `concept`, `description` | string \| null | From data; all `null` when locked |
| `arrivalLevel` | integer \| null | Incidents only, shown even when locked; `null` for enemies |

No combat numbers (health, speed, damage) are included (FR-005, FR-006).

### Loadout Entry (tool or passive)

| Field | Type | Rule |
|-------|------|------|
| `id`, `kind` | string, `tool` \| `passive` | — |
| `name`, `concept`, `description` | string | From data |
| `owned` | boolean | Engineer has it |
| `rank` | integer 1–5 | Owned rank; 1 when not owned |
| `stats` | array of Stat Change `{stat, from: null, to}` | Values of `ranks[rank - 1]`: tools restricted to `TOOL_KIND_FIELDS[kind]`, passives all fields (research R4) |
| `next` | array of Stat Change `{stat, from, to}` \| null | Owned and rank < 5: `describeChange(data, {kind, id, fromRank: rank, toRank: rank + 1})`; otherwise `null` |
| `offline` | boolean | Tools only: `offlineUntil > run.elapsed`; always `false` for passives |

Stat Change is the existing record from `engine/progression.js › describeChange`; text comes from
`ui/stattext.js › describeStatChange` (research R3).

## Validation rules (from the spec)

- Unlocked text fields equal the data exactly (SC-002); locked entries expose none of them.
- `stats`/`next` values equal the rank tables the engine reads (FR-008, C6).
- Building the guide leaves `hashRun(run)` unchanged (FR-015).
