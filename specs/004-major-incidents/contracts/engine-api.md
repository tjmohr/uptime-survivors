# Contract: Engine Additions (feature 001 `contracts/engine-api.md` extended)

## New module `engine/incidents.js` (pure, called from `step`)

| Export | Contract |
|--------|----------|
| `createIncidentRecords(data) → Record[]` | One `not-reached` record per incident, in data order |
| `arriveIncidents(run)` | On reaching a difficulty level equal to an incident's `arrivalLevel`: spawn it (R3), set its record `active`, push `incident-arrived`. Called right after `difficulty-up` events are pushed, so an incident arrives on the same step as its level. |
| `updateIncidents(run, dt)` | Entry dash, then behaviour state machines (R4). Runs after `updateSpawner`, before `updateBehaviors`. |
| `resolveIncident(run, enemy)` | Called from `resolveDefeats` for an incident: record `resolved`, push `incident-resolved`, restore tools (`link-restored`), clear infections (`infection-cleared`), drop the reward pickup. |
| `activeIncidentCount(run) → number` | Incidents currently in `run.enemies` |

## Changes to existing engine modules

| Module | Change |
|--------|--------|
| `run.js` | `createRun` adds `run.incidents` (records); `step` calls `arriveIncidents` after difficulty changes and `updateIncidents` after spawning |
| `spawner.js` | Ordinary spawn rate × `incidentSpawnFactor` while an incident is active during its own arrival level (once, not per incident); the cap check ignores incidents |
| `behaviors.js` | Incidents chase the engineer at their own speed (dash or normal); excluded from blink/separation special cases as needed |
| `weapons.js` | Skip tools with `offlineUntil > run.elapsed` |
| `combat.js` | `resolveDefeats` routes incidents to `resolveIncident` (no ordinary telemetry drop); `addPickup` never merges or drops `reward` pickups; contact damage uses the incident's own `damagePerSecond` |
| `content.js` | Validates `incidents` and `incidentSpawnFactor` ([game-data.md](./game-data.md)); ids unique across all content |
| `hash.js` | Adds incident records, incident timers, `infected` flags, tool `offlineUntil`, pickup `reward` |

Events: see [data-model.md](../data-model.md) › Engine events. Determinism: all choices use `run.rng`.
