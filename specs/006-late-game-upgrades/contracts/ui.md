# Contract: Screens, HUD, Field Guide, rendering

**Feature**: [../spec.md](../spec.md)

## Stat text (`ui/stattext.js`)

- New labels: `hops` Hops, `hopRange` Hop range, `slowPercent` Slow (%), `tickInterval` Tick interval (s),
  `duration` Duration (s), `cooldownReductionPercent` Cooldowns (−%), `damagePercent` Tool damage (+%),
  `telemetryGainPercent` Telemetry gain (+%), `damageReductionPercent` Damage taken (−%),
  `allDamagePercent` All tool damage (+%).
- `describeStatChange(change, effective?)`: when `effective` is given and differs from the rank value
  (after rounding to ≤ 2 decimals), appends ` (E with bonuses)`, e.g. "Damage 15 → 18 (22 with bonuses)",
  "Cooldown 0.6 s (0.48 s with bonuses)".

## Level-up screen

- Tool choices: rank lines as today, plus the effective value of the *new* rank under current bonuses.
- Capacity Planning choice: name, "Taken n×", description (concept), change line
  "All tool damage +15% → +20%". Shown as choice [1]; Failover as choice [2] with "Restore Uptime +15%".
- Must still fit 360 × 640 and landscape phones (feature 003 T6).

## HUD loadout and end screen

New tools and passives listed with rank pips like the others (OFFLINE rule applies to new tools);
"Capacity Planning ×n" appended when n > 0.

## Field Guide (feature 005)

- "Tools & passives": 7 tools, 6 passives, then a "Capacity Planning" entry (taken n×, total bonus
  "+X% all tool damage", concept, description; never "Not owned" — shows "Not taken yet" at 0).
- Stats lines use the effective-value text (rank value + bonuses) for owned tools.
- Icons: `chain` (zig-zag of 3 nodes), `aura` (dashed ring around a dot), `zone` (dark disc with rim);
  passives: QoS (stacked priority bars), Link Aggregation (three parallel lines joined), Observability
  (gauge), Hardened Config (shield). All `aria-hidden`, static.

## Play field

| Tool | Drawing | Reduced motion |
|------|---------|----------------|
| Traceroute | Polyline through `chain` points in its colour, fading over 0.2 s | Drawn for 0.2 s without fade |
| Rate Limiter | Dashed circle at `radius` around the engineer, low alpha | Same (it is static) |
| Null Route | Dark disc + rim for the zone's life; rim pulses | No pulse |
