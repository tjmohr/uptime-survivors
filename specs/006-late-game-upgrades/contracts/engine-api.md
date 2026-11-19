# Contract: Engine changes

**Feature**: [../spec.md](../spec.md) | Shapes: [../data-model.md](../data-model.md)

## New module `engine/stats.js` (pure)

```js
export function bonusTotals(run)                    // { damagePercent, cooldownReductionPercent }
export function effectiveToolStats(run, toolId, rank) // rank stats with bonuses applied (data-model › Derived values)
export function repeatableBonus(run)                 // capacityTakes × damagePercentPerTake
```

## Changed modules

| Module | Change |
|--------|--------|
| `engine/content.js` | `TOOL_KIND_FIELDS` adds `chain`, `aura`, `zone`; integer `hops`; `slowPercent` ≤ 80; `PASSIVE_FIELDS` adds 4 stats with caps; validates top-level `repeatable`; `repeatable.id` joins the shared id set |
| `engine/weapons.js` | Reads stats via `effectiveToolStats`; new kinds `chain`, `aura`, `zone`; zone update (ticks, expiry); publishes `run.slowField`; offline tools (004) skip all kinds and an offline aura publishes no field |
| `engine/behaviors.js` | Ordinary enemy step speed × `slowField.factor` when inside it; incidents unaffected |
| `engine/combat.js` | Contact damage × `(1 − damageReductionPercent/100)`; pickup telemetry × `(1 + telemetryGainPercent/100)` |
| `engine/progression.js` | `passiveTotals` covers new fields; `buildOffer` returns `[repeatable, heal]` when the pool is empty; `describeChange` for `repeatable`; `applyUpgrade` increments `capacityTakes` |
| `engine/run.js` | `createRun`: `engineer.capacityTakes = 0`, `zones: []`, `slowField: null`; `defs` unchanged except repeatable lookup |
| `engine/hash.js` | Adds `capacityTakes`, zones, slow field |

Events added: `chain`, `zone-placed` (data-model › Engine events). Tick damage uses the existing `hit`
event. All behaviour deterministic; no new `run.rng` calls.
