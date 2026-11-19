# Uptime Survivors Constitution

**Purpose:** The player is the network engineer, who repeatedly fights off
network problems as the game's enemies, grows their troubleshooting and automation skills, and
gains new abilities after each level-up to protect their network. Enemies grow in number and
strength as difficulty rises, and new enemy types appear every few difficulty levels. The game is
a survivors-like (auto-attacking horde survival) themed on network engineering and
automation.

## Core Principles

### C1 · Fun, survivors-like play with a networking theme

The game MUST be fun and MUST play as a survivors-like: the player moves, weapons and abilities
fire automatically, enemy hordes escalate over time, defeated enemies drop experience, and each
character level-up offers a choice of new or improved abilities. Every enemy, ability, and pickup
MUST be themed on a real network engineering or automation concept (e.g., packet loss, BGP flaps,
broadcast storms vs. ACLs, Ansible playbooks, failover links).

The game shares only its genre with other survivors-likes, not their identity: names, characters, art,
music, and UI MUST be original to this project, and no third-party game assets are used.

**Evidence:** a reviewer can name the real networking concept behind every enemy and ability from
its in-game name and description; an asset review confirms all art, audio, and names are
original.

### C5 · The first version is deterministic and self-contained

Ship authored content and deterministic domain logic. The game requires no account, backend,
live device connection, model, or API key. AI may help write code and assets during
development; its output receives the same review as any other contribution.

All randomness in game logic (spawns, drops, level-up offers) MUST come from a seeded
pseudo-random generator: the same seed plus the same input sequence MUST produce the same
simulation outcome. Purely visual effects are exempt.

**Evidence:** a clean browser session can play using only the project's static files; no network
request leaves the page's origin during a run; and a fixed-seed simulation test produces identical
results on repeated runs.

### C6 · Content and logic can be reviewed separately

Store game content and difficulty in editable data: enemy types, abilities and upgrades, the
20 difficulty levels (spawn rates, enemy mix, stat scaling), and the networking descriptions
shown to the player. Keep game rules (combat, spawning, experience, upgrades, difficulty
progression) separate from rendering and input. Validate all data before a run starts; invalid
data MUST show an error naming the offending ID instead of starting play. Any number or effect
shown to the player (damage, cooldowns, upgrade descriptions, end-of-run summary) MUST match what
the rules compute.

**Evidence:** validation tests reject malformed, duplicate, or missing entries; rule tests run
without rendering; displayed upgrade values are checked against rule outputs.

### C7 · Done is demonstrated

Ship only the agreed scope. Requirements, plan, tasks, and README must describe the same game.
A feature is complete when its acceptance criteria pass and its actual status is recorded. A
screenshot, a checked task box, or the agent saying "done" is insufficient by itself.

When time is short, reduce scope explicitly. Fix broken core interactions and inaccurate
networking descriptions before adding visual effects. Keep failed and untested checks visible.

**Evidence:** reproducible run/test commands, recorded verification results, a fresh-start
playthrough, and a README another attendee can follow.

## First Release Scope

One core mechanic, a run of up to 20 difficulty levels, a browser, and a 60-minute workshop
build. Change this budget only by updating the agreed scope.

- **Core mechanic:** move-and-survive with automatic attacks and level-up ability choices.
- **Run structure:** difficulty rises through levels 1–20 during a run; enemy count and strength
  increase each difficulty level, and new enemy types appear every few levels. Surviving
  difficulty level 20 wins the run; being overwhelmed before then loses it.
- **Difficulty vs. character level:** difficulty levels pace the run; character level-ups
  (experience → ability choice) are separate.
- **Build budget:** to fit 60 minutes, difficulty levels MUST be data-driven scaling (spawn rate,
  enemy mix, stat multipliers), not 20 hand-built stages.
- **Platform:** desktop browser, static files only, no install.
- Out of scope for v1 unless the scope is amended: meta-progression between runs, persistence,
  multiplayer, multiple maps.

## Decisions Record

Decisions made on 2026-11-18 while adopting the workshop starter constitution:

- **Genre:** survivors-like; original names, art, and audio.
- **C1 evidence:** every enemy and ability is tied to a real networking concept.
- **Scope:** "three short levels" replaced by a run of up to 20 difficulty levels ending in a win.
- **Determinism:** seeded randomness satisfies C5.
- **Terminology:** quiz wording in the starter kit (challenges, hints, sources, evaluator,
  teaching) was a leftover from the workshop example and is not part of this game.
- **Numbering:** C2–C4 were intentionally dropped; IDs are kept for traceability.
- **C5 evidence (2026-11-19):** the truncated evidence line was completed and confirmed: same-origin
  requests only, and fixed-seed determinism (v1.0.1).

## Governance

For any material change, record the reason, update the affected spec and plan, and rerun
analysis. A conflict with this constitution is resolved openly; the build agent must not weaken
a principle merely to make its implementation pass.

- This constitution supersedes conflicting guidance in specs, plans, tasks, and agent output.
- **Versioning:** MAJOR for removing or redefining a principle or the release budget; MINOR for
  adding a principle/section or materially expanding guidance; PATCH for wording fixes.
- **Compliance review:** `/speckit-analyze` and every review of a slice MUST check the work
  against C1, C5, C6, C7 and the First Release Scope, and record pass / fail / not run.

**Version**: 1.0.1 | **Ratified**: 2026-11-18 | **Last Amended**: 2026-11-19
