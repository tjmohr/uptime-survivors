// How much of the play field the camera shows (specs/003-mobile-touch/data-model.md › Screen Fit).
// Pure. Units: CSS px for w/h, game units for distances.

export const VIEW_RADIUS = 660; // feature 001: half the screen diagonal shows at least this much
export const MIN_VIEW_UNITS = 330; // feature 003 FR-015: short side shows at least this much each way

// CSS px per game unit. Feature 001 used max(1, halfDiagonal / VIEW_RADIUS); the cap keeps at least
// MIN_VIEW_UNITS visible from the engineer to the nearest screen edge on small screens.
export function viewScale(w, h) {
  const base = Math.max(1, Math.hypot(w, h) / 2 / VIEW_RADIUS);
  const cap = Math.min(w, h) / 2 / MIN_VIEW_UNITS;
  return Math.min(base, cap);
}

// Game units visible from the engineer to the nearest screen edge.
export const viewHalfShort = (w, h) => Math.min(w, h) / 2 / viewScale(w, h);
