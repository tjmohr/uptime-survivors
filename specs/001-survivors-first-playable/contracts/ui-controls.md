# Contract: Player Controls, Screens, and URL Parameters

## Keyboard

| Context | Keys | Action |
|---------|------|--------|
| Title | Enter or Space (on focused Start button) | Start run |
| Playing | W A S D or arrow keys | Move (8 directions; opposite keys cancel) |
| Playing | Esc or P | Pause |
| Level-up | 1, 2, 3 (or Tab + Enter, or mouse click) | Choose upgrade |
| Paused | Esc or P, or Resume button | Resume |
| Paused | Quit to Title button | End run, return to title |
| End screen | Buttons: New Run, Replay Seed | Start new run / same seed |

Automatic pause when the page is hidden or the window loses focus (FR-004).

## Screens

All menus are HTML elements over the canvas. When a screen opens, keyboard focus moves to its
first button. Menu buttons are native `<button>` elements.

| Screen | Must show |
|--------|-----------|
| Loading | "Loading…" text |
| Error | Title "Game data has errors" and every error's item ID, path, and message; no Start button |
| Title | Game name, Start, controls reminder |
| HUD (playing) | Uptime % and bar; telemetry bar and engineer level; "Difficulty N / 20" and seconds left in level; total time; owned tools and passives with ranks (FR-028); test-setting label if any URL parameter is active |
| Level-up | Up to 3 choices: name, "Rank a → b" or "New", description, exact stat changes (FR-015) |
| Banner | "Difficulty N" on each level; "New threat: <name> — <concept>" on debut |
| Paused | Resume, Quit to Title |
| End | Win/Loss, time survived, difficulty reached, enemies defeated, engineer level, tools/passives with ranks, seed; New Run, Replay Seed (FR-003) |

## Accessibility

- Text is never shown only through colour; enemy types also differ by shape (FR-025b).
- `prefers-reduced-motion: reduce` turns off screen flash, screen shake, and particle bursts.
- Banners and level-up screens are announced through an ARIA live region.

## URL parameters (testing only)

| Parameter | Example | Effect |
|-----------|---------|--------|
| `seed` | `?seed=12345` | Use this seed instead of a random one |
| `levelSeconds` | `?levelSeconds=2` | Every difficulty level lasts this many seconds (full run = 20 × value) |

Invalid values (non-numbers, ≤ 0) are ignored and the HUD shows "ignored test setting".
