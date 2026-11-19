# Contract: Engine and pure UI modules

**Feature**: [../spec.md](../spec.md) | Data shapes: [../data-model.md](../data-model.md)

## Engine changes (pure, deterministic)

| Module | Change |
|--------|--------|
| `engine/run.js › createRun` | Adds `encountered: []` to the run |
| `engine/spawner.js › spawnEnemy` | After creating the enemy: if `typeId` is not in `run.encountered`, append it |
| `engine/incidents.js › arriveIncidents` | On arrival: append `def.id` to `run.encountered` if absent |
| `engine/hash.js › hashRun` | Adds `run.encountered.join('|')` |

No new events, no randomness, no change to any other run field. Existing determinism and incident tests
keep passing (hashes of two identical runs still match).

## `ui/stattext.js` (new, DOM-free)

Moved unchanged from `ui/screens.js`; screens.js imports them back.

```js
export const STAT_LABELS, UNITS
export function describeStatChange(change)  // "Damage 12", "Damage 12 → 15", "Move speed +10%"
```

## `ui/guide.js` (new, DOM-free)

```js
export function buildGuide(run)   // → Guide (data-model.md); reads run, never changes it
```

## `ui/icons.js` (new, DOM-free; returns SVG markup strings)

```js
export const TOOL_COLORS          // { ping, 'firewall-rule', 'ansible-playbook', 'load-balancer' } (moved from render.js)
export const LOCKED_COLOR = '#64748b'
export function shapePoints(shape, r)              // [[x, y], …]; circle → null
export function problemIcon(entry, size = 40)      // enemy/incident; silhouette when entry.locked
export function loadoutIcon(def, size = 40)        // tool by def.kind, passive by def.id (fallback circle)
```

Every returned `<svg>` has `aria-hidden="true"` and `focusable="false"`, and no animation.

`ui/render.js › shapePath` draws from `shapePoints` (same vertices as before), and imports `TOOL_COLORS`.
