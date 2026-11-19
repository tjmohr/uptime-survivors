# Contract: New game data (starting values)

**Feature**: [../spec.md](../spec.md) | Rules: [../data-model.md](../data-model.md)

Starting values, to be tuned with `tests/balance/upgrades.mjs` (research R7). Text is final unless a
reviewer finds a concept inaccurate.

## Tools

| id | name | concept | description | kind |
|----|------|---------|-------------|------|
| `traceroute` | Traceroute | Traceroute (hop-by-hop path discovery) | Probes the path one hop at a time: a bolt hits the nearest problem, then jumps to the next. | chain |
| `rate-limiter` | Rate Limiter | Traffic policing (rate limiting) | Polices traffic around you: problems in range slow down and are steadily worn away. | aura |
| `null-route` | Null Route | Black-hole routing (RTBH) | Routes the busiest cluster of problems into a black hole that drops everything inside. | zone |

| Rank | Traceroute (damage, cooldown, range, hops, hopRange) | Rate Limiter (damage, tickInterval, radius, slowPercent) | Null Route (damage, tickInterval, cooldown, range, radius, duration) |
|------|------|------|------|
| 1 | 12, 1.4, 300, 2, 140 | 3, 0.5, 90, 20 | 6, 0.5, 5, 350, 60, 2.5 |
| 2 | 14, 1.3, 300, 3, 150 | 4, 0.5, 105, 25 | 8, 0.5, 4.5, 350, 70, 3 |
| 3 | 17, 1.2, 300, 4, 160 | 5, 0.5, 120, 30 | 10, 0.5, 4, 350, 80, 3 |
| 4 | 20, 1.0, 300, 5, 170 | 6, 0.5, 135, 35 | 12, 0.5, 3.5, 350, 90, 3.5 |
| 5 | 24, 0.9, 300, 6, 180 | 8, 0.5, 150, 40 | 14, 0.5, 3, 350, 100, 4 |

## Passives

| id | name | concept | description | stat by rank 1–5 |
|----|------|---------|-------------|------------------|
| `qos-policy` | QoS Policy | Quality of Service | Prioritises your tools' traffic so every tool recharges faster. | cooldownReductionPercent 10, 14, 18, 22, 25 (was 5, 10, 15, 20, 25) |
| `link-aggregation` | Link Aggregation | Link aggregation (LACP) | Bundles parallel links into one bigger pipe: every tool hits harder. | damagePercent 12, 17, 22, 26, 30 (was 6, 12, 18, 24, 30) |
| `observability-stack` | Observability Stack | Network monitoring and observability | Better dashboards squeeze more telemetry out of every pickup. | telemetryGainPercent 15, 22, 28, 34, 40 (was 8, 16, 24, 32, 40) |
| `hardened-config` | Hardened Config | Device hardening | Locks down management and services so problems that reach you do less damage. | damageReductionPercent 10, 14, 18, 22, 25 (was 5, 10, 15, 20, 25) |

## Repeatable

```json
"repeatable": {
  "id": "capacity-planning",
  "name": "Capacity Planning",
  "concept": "Capacity planning",
  "description": "Everything is maxed — plan more headroom. All tools deal a little more damage, every time.",
  "damagePercentPerTake": 5
}
```

## Changed and added values

- `levelUp.fallbackHealPercent`: 20 → 15.
- `levelUp.toolFloor`: `[{"difficulty": 5, "tools": 2}, {"difficulty": 10, "tools": 3}, {"difficulty": 15, "tools": 4}]` (user's thresholds).

## Balance results (2026-11-19, `python3 tests/balance/parallel.py upgrades sN`)

### History

1. **Starting values**: S1–S4 passed with the tools-first bot, but the "always choice 1" bot did much
   worse with the new content (median 4.5 vs 7): early offers are mostly passives and it never took a
   second tool.
2. **"One new tool in every offer"** (tried, replaced): helped the tools-first bot (+2.5, slightly too
   easy) but not random or first-choice players (−2.5, −3).
3. **Tool floor 5/10/15** (user's thresholds): tools-first 5.5 vs 4.5 ✓; random and first-choice still
   4.5 vs 7 — those runs die at difficulty 3–5. An earlier floor (3/6/10, experiment) gave the same 4.5, so
   tool count was not the cause: early picks were spread over many weak rank-1 passives.
4. **Front-loaded passives** (final): see the values above.

### Final results (tool floor 5/10/15 + front-loaded passives)

| Check | Result |
|-------|--------|
| S1 | PASS — 10/10 runs still have upgrades at difficulty 12 |
| S2 | PASS — 22 offers after the pool ran out, all exactly [Capacity Planning, Failover] |
| S3 | PASS — 14 distinct 4-tool builds in 20 random-choice runs |
| S4 tools-first | PASS — median 5.5 vs 4.5 baseline, 0 wins vs 0 |
| S4 random choices | PASS — median 5.5 vs 7, 0 wins vs 0 |
| S4 always choice 1 | PASS — median 7.5 vs 7, 0 wins vs 0 |
| Feature 004 I-S1 re-run | PASS — Route Leak 10/10, Core Switch Failure 8/10, Ransomware Outbreak 7/10 resolved in 30–60 s; rewards ≈ 0.68–1.07 level-ups |
| Feature 004 I-S2 re-run | FAIL (as before this feature) — with incidents 18, 7, 7, 12, 20, 3, 5, 4, 8, 12 (median 7.5, 5/10 in 7–14) vs without 20, 7, 17, 10, 14, 3, 5, 4, 8, 13 (median 9) |
