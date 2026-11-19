// Floating joystick math (specs/003-mobile-touch/contracts/input.md › ui/joystick.js). Pure.

export const JOYSTICK_RADIUS = 56; // CSS px
export const DEAD_ZONE = 0.1; // fraction of the radius

// base: joystick centre, point: finger. Returns the unit steering direction ({0, 0} inside the dead
// zone) and the base, dragged along behind the finger when it goes past the edge.
export function joystickStep(base, point, radius = JOYSTICK_RADIUS, deadZone = DEAD_ZONE) {
  const ox = point.x - base.x;
  const oy = point.y - base.y;
  const dist = Math.hypot(ox, oy);
  if (dist <= deadZone * radius || dist === 0) return { dx: 0, dy: 0, base: { x: base.x, y: base.y } };
  const dx = ox / dist;
  const dy = oy / dist;
  const next = dist > radius ? { x: point.x - dx * radius, y: point.y - dy * radius } : { x: base.x, y: base.y };
  return { dx, dy, base: next };
}
