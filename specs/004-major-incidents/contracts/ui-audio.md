# Contract: Incident UI and Sound (features 001–003 extended)

## HUD

| Element | Behaviour |
|---------|-----------|
| Incident panel (`#hud-incidents`) | Below the top row; one entry per active incident: name + health bar (stacked for 2–3); hidden when none; inside the safe area (feature 003) |
| Loadout | Offline tools show "OFFLINE" and a dimmed style; a warning line "Link down in 1.5 s: <tool>" appears during `link-warning` |
| Edge pointers | Canvas, screen space: an arrow at the screen edge (inset by the safe area and clear of the touch buttons) for each off-screen incident (threat style), and one for each uncollected reward pickup (telemetry style); shown together — up to three incident pointers and three reward pointers |

## Banners and announcements

| Event | Banner (threat style) | Live region |
|-------|-----------------------|-------------|
| `incident-arrived` | "MAJOR INCIDENT — {name} — {concept}" (shown before a same-step "New threat" banner) | Same text |
| `incident-resolved` | "RESOLVED — {name}" | Same text |
| `link-down` | — (HUD only) | "{tool} offline" |

**Feature 006 update (2026-11-19):** the two incident messages are no longer timed banners. Each active
incident has a standing alert line (`#incident-alerts`, below the HUD) reading "MAJOR INCIDENT — {name} —
{concept}" in pulsing red (no pulse with reduced motion) until it is resolved; then the line turns green,
"RESOLVED — {name}", for 3 s and is removed. Two active incidents show two lines. The live region still
announces each message once (after any same-step "Difficulty N" banner); the lines are `aria-hidden`.
Alerts are cleared when the run ends or the player quits. See `specs/006-late-game-upgrades/spec.md` FR-018.

## Play field

- Incident drawn with its shape/colour at its radius, a thicker outline, and a slow glow; infected
  enemies get a magenta ring; Route Leak minions look like their enemy type.
- Reward pickup: 2.5× pickup size, pulsing glow (1.2 s period); steady glow under reduced motion.

## End screen

New row **Incidents**: e.g. "Route Leak ✓ resolved · Core Switch Failure ✗ unresolved · Ransomware
Outbreak — not reached".

## Sound (feature 002)

| Event | Sound |
|-------|-------|
| `incident-arrived` | `incidentAlarm` |
| `incident-resolved` | `incidentResolved` |
| any incident active | music layer with `trigger: "incident"` plays (from the next bar) |

`incidentAlarm` and `incidentResolved` are treated like `win`/`loss`: always accepted, never dropped by
the minimum-interval or concurrency limits, and not counted against `maxConcurrentEffects`, so FR-017's
"MUST play" holds in crowded fights. Several arrivals or resolutions in one frame still produce one sound
each per incident.
