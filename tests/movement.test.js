// U1–U2: analog movement input (specs/003-mobile-touch/quickstart.md).
import { test, assert, assertApprox, assertEqual } from './harness.js';
import { createRun, step, chooseUpgrade } from '../engine/run.js';
import { createRng } from '../engine/rng.js';
import { hashRun } from '../engine/hash.js';
import { loadGameData } from './harness.js';
import { quietRun, steps } from './fixtures.js';

test('movement: any angle moves at full speed in that direction (U1)', async () => {
  for (const deg of [0, 30, 45, 137, 300]) {
    const run = await quietRun();
    const a = (deg * Math.PI) / 180;
    steps(run, 60, { dx: Math.cos(a), dy: Math.sin(a) });
    const speed = run.data.player.moveSpeed;
    assertApprox(Math.hypot(run.engineer.x, run.engineer.y), speed, 1e-6, `distance at ${deg}°`);
    assertApprox(run.engineer.x, Math.cos(a) * speed, 1e-6, `x at ${deg}°`);
    assertApprox(run.engineer.y, Math.sin(a) * speed, 1e-6, `y at ${deg}°`);
    assertApprox(run.engineer.facing, Math.atan2(Math.sin(a), Math.cos(a)), 1e-9, `facing at ${deg}°`);
  }
});

test('movement: short drags still move at full speed (direction only)', async () => {
  const run = await quietRun();
  steps(run, 60, { dx: 0.2, dy: 0 });
  assertApprox(run.engineer.x, run.data.player.moveSpeed, 1e-6);
});

test('movement: values beyond ±1 clamp; non-finite and non-numbers count as 0 (U1)', async () => {
  const a = await quietRun();
  steps(a, 30, { dx: 5, dy: 0 });
  const b = await quietRun();
  steps(b, 30, { dx: 1, dy: 0 });
  assertEqual(a.engineer.x, b.engineer.x);
  for (const bad of [NaN, undefined, 'left', Infinity, -Infinity, null]) {
    const run = await quietRun();
    steps(run, 10, { dx: bad, dy: bad });
    assertEqual([run.engineer.x, run.engineer.y], [0, 0], `input ${String(bad)}`);
  }
  const still = await quietRun();
  steps(still, 10, { dx: 0, dy: 0 });
  assertEqual([still.engineer.x, still.engineer.y], [0, 0]);
});

test('movement: a recorded any-angle input sequence replays exactly (U2, SC-007)', async () => {
  const r = createRng(77);
  const inputs = [];
  let current = { dx: 0, dy: 0 };
  for (let i = 0; i < 1800; i++) {
    if (i % 20 === 0) {
      const a = r.next() * Math.PI * 2;
      current = r.next() < 0.15 ? { dx: 0, dy: 0 } : { dx: Math.cos(a), dy: Math.sin(a) };
    }
    inputs.push(current);
  }
  const play = async () => {
    const run = createRun(await loadGameData(), { seed: 5 });
    for (const input of inputs) {
      if (run.phase === 'levelup') chooseUpgrade(run, 0);
      step(run, input);
      run.events.length = 0;
    }
    return hashRun(run);
  };
  const h1 = await play();
  const h2 = await play();
  assert(typeof h1 === 'string' || typeof h1 === 'number');
  assertEqual(h1, h2);
});
