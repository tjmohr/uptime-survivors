# Contract: Engine API (`engine/`)

The engine holds all game rules. It is plain ES modules with **no DOM, canvas, timers, network,
or `Math.random`** (C5, C6). The UI calls it; it never calls the UI. Tests import it directly.

## Modules and exported functions

| Module | Export | Contract |
|--------|--------|----------|
| `engine/content.js` | `validateGameData(raw) → {ok, data} \| {ok:false, errors}` | Pure. See [game-data.md](./game-data.md). Never throws on bad input. |
| `engine/rng.js` | `createRng(seed) → {next(), int(n), pick(list), state()}` | `next()` returns a float in [0, 1). Same seed → same sequence. |
| `engine/run.js` | `createRun(data, {seed, levelSeconds?}) → RunState` | New run in `playing` phase with the starting tool, Uptime full. |
| `engine/run.js` | `step(run, input) → void` | Advances exactly one 1/60 s step when `run.phase === "playing"`; does nothing otherwise. `input = {dx, dy}`, each −1, 0, or 1. |
| `engine/run.js` | `chooseUpgrade(run, index) → {ok, reason?}` | Valid only in `levelup` phase with an index in the current offer; otherwise returns `{ok:false}` and changes nothing. |
| `engine/run.js` | `pause(run)`, `resume(run)` | Switch between `playing` and `paused`; ignored in other phases. |
| `engine/progression.js` | `telemetryToNext(data, level)`, `buildOffer(run) → OfferItem[]`, `describeChange(data, item) → {stat, from, to}[]` | Offer and its numbers come from the rank tables (FR-015). |
| `engine/difficulty.js` | `levelAt(data, elapsed, levelSeconds?) → 1..20`, `runLength(data, levelSeconds?)` | Pure lookups. |
| `engine/hash.js` | `hashRun(run) → string` | Stable hash of the simulation state, for determinism tests (SC-006). |

Internal modules (`spawner.js`, `combat.js`, `weapons.js`, `behaviors.js`, `grid.js`) are not
called by the UI.

## Events

`step()` appends to `run.events` (cleared by the UI after each frame) so the UI can show feedback
without reading internals:

| Event | Payload | UI use |
|-------|---------|--------|
| `hit` | `{x, y, amount}` | Damage number/flash |
| `player-hit` | `{amount}` | Screen flash (disabled under reduced motion) |
| `enemy-defeated` | `{typeId, x, y}` | Particle burst |
| `level-up` | `{level}` | Open level-up screen |
| `difficulty-up` | `{level, debuts: [enemyId]}` | Difficulty banner, "New threat" banner |
| `run-ended` | `{outcome}` | Open end screen |
| `pulse` | `{x, y, radius}` | Ansible Playbook ring effect |
| `blink` | `{x, y}` | Route Flap jump (available for effects) |

## Guarantees tested

- Same `data`, seed, and input sequence → identical `hashRun` after any number of steps.
- `step` in `levelup`, `paused`, or `ended` changes nothing.
- No source file under `engine/` contains `Math.random`, `document`, `window`, or `fetch`.
- Uptime reaching 0 on the same step as level 20 ending → `outcome === "loss"`.
