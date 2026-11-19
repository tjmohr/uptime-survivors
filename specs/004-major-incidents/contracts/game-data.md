# Contract: Incident Data (`data/game.json` additions)

Field rules: [data-model.md](../data-model.md). Validation follows feature 001's
`validateGameData` (errors `{path, id, message}`, unknown fields rejected, never throws).

```json
{
  "incidentSpawnFactor": 0.5,
  "incidents": [
    {
      "id": "route-leak",
      "name": "Route Leak",
      "concept": "BGP route leak",
      "description": "Routes are advertised far beyond where they belong, and traffic pours the wrong way.",
      "arrivalLevel": 7,
      "shape": "diamond",
      "color": "#fb923c",
      "radius": 46,
      "health": 900,
      "speed": 70,
      "entrySpeed": 240,
      "entryDistance": 300,
      "contactDamagePerSecond": 30,
      "rewardTelemetry": 60,
      "behavior": { "kind": "leak", "intervalSeconds": 5, "burst": 6, "maxAlive": 18, "minionType": "latency-spike" }
    },
    {
      "id": "core-switch-failure",
      "name": "Core Switch Failure",
      "concept": "Single point of failure in the network core",
      "description": "The core switch is down. Everything behind it flaps: links drop one at a time.",
      "arrivalLevel": 12,
      "shape": "square",
      "color": "#94a3b8",
      "radius": 60,
      "health": 2600,
      "speed": 40,
      "entrySpeed": 240,
      "entryDistance": 300,
      "contactDamagePerSecond": 45,
      "rewardTelemetry": 140,
      "behavior": { "kind": "link-down", "cooldownSeconds": 12, "warningSeconds": 1.5, "offlineSeconds": 4 }
    },
    {
      "id": "ransomware-outbreak",
      "name": "Ransomware Outbreak",
      "concept": "Malware spreading laterally across a network",
      "description": "An infection is moving host to host. Everything near it gets tougher and faster.",
      "arrivalLevel": 18,
      "shape": "octagon",
      "color": "#e879f9",
      "radius": 52,
      "health": 4200,
      "speed": 85,
      "entrySpeed": 240,
      "entryDistance": 300,
      "contactDamagePerSecond": 60,
      "rewardTelemetry": 260,
      "behavior": { "kind": "infect", "intervalSeconds": 1, "radius": 180, "healthMultiplier": 1.5, "speedMultiplier": 1.3 }
    }
  ]
}
```

Numbers above are **starting values**; health and reward are tuned with the balance simulation
(quickstart S1–S2) before this feature is done.

**Tuned 2026-11-19 (S1 passes):** Route Leak health 1200, reward 72; Core Switch Failure health 2600,
reward 160, contact 35/s; Ransomware Outbreak health 3400, reward 260, contact 45/s, infection radius 140,
×1.25 health, ×1.15 speed. `data/game.json` is the source of truth.

Example errors:

```json
{ "path": "incidents[1].behavior.offlineSeconds", "id": "core-switch-failure", "message": "missing required field 'offlineSeconds'" }
{ "path": "incidents[0].behavior.minionType", "id": "route-leak", "message": "unknown enemy 'packet-storm'" }
{ "path": "incidents[2].arrivalLevel", "id": "ransomware-outbreak", "message": "arrival level 12 is already used by 'core-switch-failure'" }
```
