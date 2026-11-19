# Quickstart & Validation Guide: Major Incidents

## Run and test

```sh
python3 -m http.server 8000 --bind 127.0.0.1      # http://127.0.0.1:8000/?levelSeconds=4
jsc -m tests/run.mjs                                # or: node tests/run.mjs
jsc -m tests/balance/incidents.mjs                  # balance simulation (S1–S2)
python3 tests/browser/drive.py --only incident      # scripted browser checks (B1–B7)
python3 tests/browser/drive.py                      # everything (desktop, sound, touch, incidents)
```

`?levelSeconds=4` reaches level 7 in 24 s, 12 in 44 s, 18 in 68 s.

## Validation scenarios

Record each as **pass / fail / not run** in the README (constitution C7).

### Unit tests

| # | Check | Expected |
|---|-------|----------|
| U1 | Data validation | Shipped data passes; broken copies fail naming the id/path: missing behaviour field, unknown kind, unknown `minionType`, duplicate `arrivalLevel`, id clashing with an enemy, `cooldownSeconds` ≤ warning + offline, radius too small, unknown field |
| U2 | Arrival | Incidents arrive on the step their level begins (7, 12, 18), off-screen at 720 u, on screen (≤ 330 u) within 2 s; records go `not-reached → active` |
| U3 | Behaviours | Route Leak bursts on interval, never exceeds `maxAlive`, respects the enemy cap; Core Switch Failure warns 1.5 s ahead, takes a tool offline 4 s, ≥ 12 s apart, never the last tool, offline tools do not fire; Ransomware infects within radius with ×1.5 health / ×1.3 speed, once per enemy |
| U4 | Resolution | Health 0 → `incident-resolved`, record resolved, one reward pickup with `rewardTelemetry`, tools back online, infections cleared; reward pickup survives the pickup cap |
| U5 | Lingering and overlap | An unresolved incident stays through later levels at fixed strength; two active at once both behave; spawn factor applied once |
| U6 | Run integrity | Run length unchanged (20 levels); same seed + inputs → identical hash with incidents; pause/level-up freeze incidents |
| U7 | Sound data and director | `incidentAlarm`/`incidentResolved` validated; incident layer validated (`trigger` xor `joinLevel`); director maps the two events and reports incident-active |

### Balance simulation (`tests/balance/incidents.mjs`)

| # | Check | Expected |
|---|-------|----------|
| S1 | Resolve time | Typical build (first upgrade each level-up): each incident resolved in 30–60 s in ≥ 7 of 10 seeds (SC-002); reward ≈ 0.8–1.5 level-ups |
| S2 | Difficulty proxy | Non-invincible circling bot, 10 seeds, run once **before** the incident data is added (baseline) and once after: pass when, with incidents, ≥ 7 of 10 runs end between levels 7 and 14 and the median ending level is at most 1 below the baseline median (SC-003 proxy) |

### Scripted browser (headless Chrome)

| # | Check | Expected |
|---|-------|----------|
| B1 | Arrival | `?levelSeconds=4`: banner text, alarm counted, HUD bar, incident on screen within 2 s, edge pointer while off-screen |
| B2 | Each behaviour seen | Leak bursts, a tool shown OFFLINE with warning first, infected enemies marked |
| B3 | Resolution | RESOLVED banner, resolved sound, glowing reward pickup drawn larger, collected → telemetry jump |
| B4 | Overlap | Make incident 1 invulnerable (test-only): at level 12 two bars, two pointers |
| B5 | End summary | Incidents row lists resolved / unresolved / not reached |
| B6 | Phone + perf | 390×844 touch emulation: bars and pointers inside safe area, clear of touch buttons; 300 enemies + incident: frame pacing as feature 001 F5 / 003 T9 |
| B7 | Regression | All feature 001–003 checks still pass |

### Human

| # | Check | Expected |
|---|-------|----------|
| H1 | Concepts | A reviewer names the concept behind each incident from its banner (SC-006) |
| H2 | Playtest | 3 of 5 name an incident as a highlight (SC-007); first runs still end around levels 8–14 (SC-003) |
