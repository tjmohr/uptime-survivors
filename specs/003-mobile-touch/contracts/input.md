# Contract: Movement Input and Touch Steering

## Engine (feature 001 `step(run, input)`) — changed

| Before | After |
|--------|-------|
| `dx`, `dy` each snapped to −1, 0, or 1 (8 directions) | `dx`, `dy` any finite number, clamped to [−1, 1]; non-numbers → 0; direction normalised (any angle) |

- Speed is always full when the vector is non-zero; diagonal never faster than straight (unchanged).
- Keyboard inputs give identical results to feature 001: existing state hashes do not change.
- The input is part of the recorded input sequence; touch runs replay exactly (FR-005, SC-007).

Feature 001's `contracts/engine-api.md` is updated to match.

## `ui/joystick.js` — pure

| Export | Contract |
|--------|----------|
| `JOYSTICK_RADIUS` | 56 (CSS px) |
| `DEAD_ZONE` | 0.10 (fraction of radius) |
| `joystickStep(base, point, radius = JOYSTICK_RADIUS, deadZone = DEAD_ZONE) → {dx, dy, base}` | `dx, dy` is the unit vector from `base` to `point`, or `{0, 0}` within `deadZone × radius`; if the distance exceeds `radius`, the returned `base` is moved toward `point` so it sits exactly `radius` away (floating joystick); otherwise `base` is returned unchanged. |

## `ui/input.js` — changed

- `createInput({..., onMuteKey, onFocusGained})` also listens to Pointer Events on the canvas.
- `move()` returns the touch direction while a steering pointer is active, otherwise the keyboard
  direction (`moveFromKeys`). Touch and keys can be mixed; touch wins while held.
- `joystick()` returns `{active, base, point}` for drawing (null when idle).
- Steering starts only on a touch `pointerdown` on the canvas while the run is `playing`; it ends on
  `pointerup`, `pointercancel`, `lostpointercapture`, or when the run stops playing.
- `clear()` also ends steering.
