# Contract: Game Data File (`data/game.json`)

All authored content for the game. Field meanings and validation rules are defined in
[data-model.md](../data-model.md); this file fixes the JSON shape.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "player": {
    "maxUptime": 100,
    "moveSpeed": 160,
    "pickupRadius": 60,
    "invulnerableSeconds": 0.5,
    "startingTool": "ping",
    "maxTools": 4
  },
  "caps": { "enemies": 300, "pickups": 200, "projectiles": 400 },
  "progression": { "base": 5, "perLevel": 6 },
  "levelUp": { "choices": 3, "fallbackHealPercent": 20 },
  "enemies": [ /* Enemy Type objects */ ],
  "tools": [ /* Tool objects */ ],
  "passives": [ /* Passive objects */ ],
  "difficulty": [ /* exactly 20 Difficulty Level objects */ ]
}
```

## Examples of each object

```json
{
  "id": "broadcast-storm",
  "name": "Broadcast Storm",
  "concept": "Layer 2 broadcast storm / switching loop",
  "description": "Looping broadcasts multiply until the segment melts down. Breaks into smaller storms when cleared.",
  "shape": "hexagon",
  "color": "#f97316",
  "radius": 14,
  "health": 30,
  "speed": 70,
  "contactDamagePerSecond": 10,
  "telemetry": 4,
  "behavior": { "kind": "split", "count": 3, "scale": 0.5, "maxGenerations": 1 },
  "debutLevel": 8
}
```

```json
{
  "id": "ping",
  "name": "Ping",
  "concept": "ICMP echo request",
  "description": "Sends an echo at the nearest problem. If it answers, it hurts.",
  "kind": "projectile-nearest",
  "ranks": [
    { "damage": 10, "cooldown": 0.8, "projectileSpeed": 400, "range": 350, "pierce": 1 },
    { "damage": 12, "cooldown": 0.7, "projectileSpeed": 400, "range": 350, "pierce": 1 },
    { "damage": 15, "cooldown": 0.6, "projectileSpeed": 400, "range": 350, "pierce": 2 },
    { "damage": 18, "cooldown": 0.5, "projectileSpeed": 400, "range": 350, "pierce": 2 },
    { "damage": 22, "cooldown": 0.4, "projectileSpeed": 400, "range": 350, "pierce": 3 }
  ]
}
```

```json
{
  "id": "bandwidth-upgrade",
  "name": "Bandwidth Upgrade",
  "concept": "Link capacity",
  "description": "A fatter pipe: move faster and pull in telemetry from farther away.",
  "ranks": [
    { "moveSpeedPercent": 5,  "pickupRadiusPercent": 10 },
    { "moveSpeedPercent": 10, "pickupRadiusPercent": 20 },
    { "moveSpeedPercent": 15, "pickupRadiusPercent": 30 },
    { "moveSpeedPercent": 20, "pickupRadiusPercent": 45 },
    { "moveSpeedPercent": 25, "pickupRadiusPercent": 60 }
  ]
}
```

```json
{
  "level": 4,
  "durationSeconds": 60,
  "spawnPerSecond": 2.0,
  "healthMultiplier": 1.1,
  "damageMultiplier": 1.0,
  "speedMultiplier": 1.0,
  "mix": { "dropped-packet": 3, "latency-spike": 1 }
}
```

## Validation output

`validateGameData(raw)` returns `{ ok: true, data }` or `{ ok: false, errors }`, where each error is

```json
{ "path": "enemies[2].shape", "id": "broadcast-storm", "message": "shape 'square' is already used by 'dropped-packet'" }
```

The error screen lists every error (not just the first). An unknown top-level or object field is
an error, so typos cannot silently fall back to defaults.

## Milestone note

For the core-loop milestone (FR-029) the file contains only the core roster (Dropped Packet,
Latency Spike, Ping, Firewall Rule, Bandwidth Upgrade) and a 20-row difficulty table that uses
only those enemies. The same validation rules apply; adding the remaining roster (FR-030) is a
data edit plus the new behavior/tool kinds in the engine.

**Feature 006 note (2026-11-19):** the roster grew to 7 tools (new kinds `chain`, `aura`, `zone`) and 6
passives (new stats `cooldownReductionPercent`, `damagePercent`, `telemetryGainPercent`,
`damageReductionPercent`), plus a top-level `repeatable` (Capacity Planning); `levelUp.fallbackHealPercent`
is now 15. Rules: `specs/006-late-game-upgrades/data-model.md`.
