// U3–U5: joystick math, tap guard, view scale (specs/003-mobile-touch/quickstart.md).
import { test, assert, assertApprox, assertEqual } from './harness.js';
import { joystickStep, JOYSTICK_RADIUS, DEAD_ZONE } from '../ui/joystick.js';
import { createTapGuard, TAP_GUARD_MS } from '../ui/tapguard.js';
import { viewScale, viewHalfShort, MIN_VIEW_UNITS, VIEW_RADIUS } from '../ui/view.js';

const at = (deg, dist, from = { x: 100, y: 100 }) => {
  const a = (deg * Math.PI) / 180;
  return { x: from.x + Math.cos(a) * dist, y: from.y + Math.sin(a) * dist };
};

test('joystick: constants match the contract', () => {
  assertEqual(JOYSTICK_RADIUS, 56);
  assertEqual(DEAD_ZONE, 0.1);
});

test('joystick: inside the dead zone → no movement, base unchanged (U3)', () => {
  const base = { x: 100, y: 100 };
  const r = joystickStep(base, at(30, 5));
  assertEqual([r.dx, r.dy], [0, 0]);
  assertEqual(r.base, base);
  const same = joystickStep(base, { x: 100, y: 100 });
  assertEqual([same.dx, same.dy], [0, 0]);
  assert(!Number.isNaN(same.dx) && !Number.isNaN(same.base.x));
});

test('joystick: beyond the dead zone → unit direction; base stays inside the radius (U3)', () => {
  const base = { x: 100, y: 100 };
  const r = joystickStep(base, at(30, 40));
  assertApprox(Math.atan2(r.dy, r.dx), (30 * Math.PI) / 180, 1e-9);
  assertApprox(Math.hypot(r.dx, r.dy), 1, 1e-12);
  assertEqual(r.base, base);
});

test('joystick: past the edge the base follows the finger (U3)', () => {
  const base = { x: 100, y: 100 };
  const p = at(200, 100);
  const r = joystickStep(base, p);
  assertApprox(Math.atan2(r.dy, r.dx), Math.atan2(p.y - base.y, p.x - base.x), 1e-9);
  assertApprox(Math.hypot(p.x - r.base.x, p.y - r.base.y), JOYSTICK_RADIUS, 1e-9);
  // Following again from the new base keeps the same direction.
  const r2 = joystickStep(r.base, p);
  assertApprox(Math.atan2(r2.dy, r2.dx), Math.atan2(r.dy, r.dx), 1e-9);
});

test('tap guard: a finger held at open blocks arming until it lifts (U4)', () => {
  const g = createTapGuard(0, [7]);
  assertEqual(g.canArm(600, new Set([7])), false);
  assertEqual(g.canArm(600, new Set()), true);
});

test('tap guard: nothing arms before 500 ms; exactly 500 ms arms (U4)', () => {
  assertEqual(TAP_GUARD_MS, 500);
  const g = createTapGuard(1000, []);
  assertEqual(g.canArm(1300, new Set()), false);
  assertEqual(g.canArm(1499, new Set()), false);
  assertEqual(g.canArm(1500, new Set()), true);
  assertEqual(g.readyAt(), 1500);
});

test('tap guard: other fingers down that were not held at open do not block (U4)', () => {
  const g = createTapGuard(0, [3]);
  assertEqual(g.canArm(700, new Set([9])), true);
});

test('tap guard: a held id that lifts and is reused later is a new touch (U4)', () => {
  const g = createTapGuard(0, [4]);
  assertEqual(g.canArm(100, new Set()), false); // lifted but too early
  assertEqual(g.canArm(600, new Set([4])), true); // id 4 reused by a fresh touch
});

test('view: desktop 1400 × 1000 is unchanged from feature 001 (U5)', () => {
  const old = Math.max(1, Math.hypot(1400, 1000) / 2 / VIEW_RADIUS);
  assertApprox(viewScale(1400, 1000), old, 1e-12);
  assertApprox(old, 1.3034, 1e-3);
});

test('view: phones show at least 330 units each way in both orientations (U5)', () => {
  assertApprox(viewScale(390, 844), 390 / 660, 1e-12);
  assertApprox(viewScale(844, 390), 390 / 660, 1e-12);
  assertApprox(viewHalfShort(390, 844), MIN_VIEW_UNITS, 1e-9);
  assert(viewHalfShort(360, 640) >= MIN_VIEW_UNITS - 1e-9);
});

test('view: across many sizes the short side shows ≥ 330 units and never zooms in beyond 001 (U5)', () => {
  for (let w = 320; w <= 2560; w += 80) {
    for (let h = 480; h <= 1440; h += 80) {
      assert(viewHalfShort(w, h) >= MIN_VIEW_UNITS - 1e-9, `${w}×${h}`);
      assert(viewScale(w, h) <= Math.max(1, Math.hypot(w, h) / 2 / VIEW_RADIUS) + 1e-12, `${w}×${h}`);
    }
  }
});
