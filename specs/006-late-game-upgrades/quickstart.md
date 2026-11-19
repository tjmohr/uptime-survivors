# Quickstart & Validation Guide: Late-Game Upgrades

## Run and test

```sh
python3 -m http.server 8000 --bind 127.0.0.1      # http://127.0.0.1:8000/
jsc -m tests/run.mjs                                # unit tests (U1–U8 plus all earlier ones)
jsc -m tests/balance/upgrades.mjs -- s1             # balance (s1 | s2 | s3 | s4), add a seed to run one
python3 tests/browser/drive.py --only upgrades     # scripted browser checks (B1–B4)
python3 tests/browser/drive.py                      # everything
```

## Validation scenarios

Record each as **pass / fail / not run** in the README (constitution C7). Ids use the prefix "L-" in the
README (e.g. L-U1) to avoid clashing with earlier features.

### Unit tests

| # | Check | Expected |
|---|-------|----------|
| U1 | Data validation | Shipped data passes; broken copies fail naming the item: unknown kind, missing `hops`, non-integer `hops`, `slowPercent` 90, `cooldownReductionPercent` 60, `damageReductionPercent` 60, missing `repeatable.damagePercentPerTake`, `repeatable.id` clashing with a tool |
| U2 | Effective stats | `effectiveToolStats` applies Link Aggregation + Capacity Planning additively to damage and QoS to `cooldown`/`hitCooldown` only; weapons fire with exactly these numbers (cooldown timing and hit amounts measured) |
| U3 | Traceroute | Hits nearest, then ≤ `hops` more distinct problems each within `hopRange` of the previous; stops early when none; waits when nothing in range; one `chain` event with the points |
| U4 | Rate Limiter | Damage every `tickInterval` to all problems in radius incl. incidents; ordinary enemies inside move at `speed × (1 − slow)`, outside at full speed; incidents never slowed; infected enemies slowed from infected speed; offline → no field, no damage |
| U5 | Null Route | Placed on the densest problem (tie → lowest id); damages everything inside each tick until `duration`; ≤ 8 zones; waits when nothing in range |
| U6 | Passives | QoS, Link Aggregation, Observability (pickups and incident reward), Hardened Config change the measured values by exactly the rank percentage |
| U7 | Offers | Tools offered from the first level-up; none once 4 owned; pool empty → offer is exactly `[Capacity Planning, Failover]`; Capacity Planning never offered before; taking it increments `capacityTakes`; Failover heals 15% |
| U8 | Determinism | Same seed + inputs with new tools → identical hash; hash covers zones, slow field, `capacityTakes`; engine purity scan includes `engine/stats.js` |

### Balance simulation (`tests/balance/upgrades.mjs`)

| # | Check | Expected |
|---|-------|----------|
| S1 | Pool lasts (SC-001) | 10 seeds, invincible: pool not empty at difficulty 12 in ≥ 8 of the runs that reach 15 |
| S2 | Never Failover-only (SC-002) | Every offer containing Failover is exactly `[Capacity Planning, Failover]` |
| S3 | Build variety (SC-003) | 20 seeds, random choices: ≥ 10 distinct 4-tool builds |
| S4 | Fair difficulty (SC-004) | Not invincible, vs. baseline data: median difficulty within ±2 levels; win rate up by ≤ 20 points |

### Scripted browser checks (`tests/browser/smoke-upgrades.html`, touch checks)

| # | Check | Expected |
|---|-------|----------|
| B1 | New tools visible | With each new tool given: Traceroute path, Rate Limiter ring, Null Route zone drawn; problems resolved; `fire`/`pulse` sounds counted |
| B2 | Level-up text | Owned Link Aggregation → tool choices show "(… with bonuses)" equal to `effectiveToolStats`; pool exhausted → choices [1] Capacity Planning "All tool damage +X% → +Y%", [2] Failover "Restore Uptime +15%" |
| B3 | Field Guide and HUD | 7 tools, 6 passives, Capacity Planning entry with times taken; effective values shown; HUD lists new items and "Capacity Planning ×n" |
| B4 | Regression and performance | All feature 001–005 checks pass; 300 enemies with all three new tools owned ≥ 50 fps desktop; phone fit (T6) still passes with the longer level-up text |

### Human checks

| # | Check | Expected |
|---|-------|----------|
| H1 | Concepts recognisable (SC-005) | A reviewer names each new item's concept from its name and description |
| H2 | Late-game playtest (SC-006) | ≥ 4 of 5 players who reach difficulty 12 say late level-ups still felt worth making |
