// Tap guard for the level-up and pause screens on touch (specs/003-mobile-touch/data-model.md › Tap
// Guard, clarification Q5). Pure: the caller passes times and the set of touch pointers down.

export const TAP_GUARD_MS = 500;

// openedAt: ms when the screen opened; heldAtOpen: iterable of touch pointer ids down at that moment.
export function createTapGuard(openedAt, heldAtOpen = [], minDelayMs = TAP_GUARD_MS) {
  const held = new Set(heldAtOpen);
  return {
    openedAt,
    minDelayMs,
    // True when a touch starting now may select: every finger held at open has lifted, and the
    // minimum delay has passed.
    canArm(now, pointersDown) {
      for (const id of held) if (pointersDown.has(id)) return false;
      held.clear(); // once lifted, a reused pointer id is a new touch
      return now - openedAt >= minDelayMs;
    },
    // Earliest time arming could become possible, ignoring held fingers.
    readyAt: () => openedAt + minDelayMs,
  };
}
