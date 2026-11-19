import { test, assert, assertEqual, assertApprox } from './harness.js';
import { step } from '../engine/run.js';
import { addPickup } from '../engine/combat.js';
import { moveFromKeys } from '../ui/input.js';
import { quietRun, place, steps, stepUntil } from './fixtures.js';

// ---------- US1 ----------

test('combat: straight movement covers moveSpeed units per second', async () => {
  const run = await quietRun();
  steps(run, 60, { dx: 1, dy: 0 });
  assertApprox(run.engineer.x, run.data.player.moveSpeed, 1e-6);
});

test('combat: diagonal movement is no faster than straight', async () => {
  const run = await quietRun();
  steps(run, 60, { dx: 1, dy: 1 });
  assertApprox(Math.hypot(run.engineer.x, run.engineer.y), run.data.player.moveSpeed, 1e-6);
});

test('input: opposite keys cancel; arrows and WASD both work', () => {
  assertEqual(moveFromKeys(new Set(['ArrowLeft', 'ArrowRight'])), { dx: 0, dy: 0 });
  assertEqual(moveFromKeys(new Set(['KeyA', 'KeyD', 'KeyW'])), { dx: 0, dy: -1 });
  assertEqual(moveFromKeys(new Set(['KeyS', 'ArrowRight'])), { dx: 1, dy: 1 });
});

test('combat: contact damage applies the listed rate, spaced by invulnerability', async () => {
  const run = await quietRun();
  place(run, 'dropped-packet', 0, 0).health = 1e6; // survives Ping so contact continues
  const dps = run.data.enemies.find((e) => e.id === 'dropped-packet').contactDamagePerSecond;
  const iframe = run.data.player.invulnerableSeconds;
  step(run);
  assertApprox(run.engineer.uptime, 100 - dps * iframe, 1e-9, 'first hit');
  steps(run, 29); // still inside the invulnerability period
  assertApprox(run.engineer.uptime, 100 - dps * iframe, 1e-9, 'no damage while invulnerable');
  steps(run, 2);
  assertApprox(run.engineer.uptime, 100 - 2 * dps * iframe, 1e-9, 'second hit after the period');
});

test('combat: contact damage scales with the difficulty damage multiplier', async () => {
  const run = await quietRun();
  const row = run.data.difficulty[4];
  place(run, 'dropped-packet', 0, 0, 5).health = 1e6;
  step(run);
  const dps = run.data.enemies.find((e) => e.id === 'dropped-packet').contactDamagePerSecond;
  assertApprox(run.engineer.uptime, 100 - dps * row.damageMultiplier * run.data.player.invulnerableSeconds, 1e-9);
});

test('combat: a defeated enemy is removed and leaves a pickup worth its telemetry', async () => {
  const run = await quietRun();
  const enemy = place(run, 'dropped-packet', 150, 0);
  stepUntil(run, (r) => r.enemies.length === 0, 240);
  assertEqual(run.stats.enemiesDefeated, 1);
  const total = run.pickups.reduce((s, p) => s + p.value, 0) + run.engineer.telemetry;
  assertEqual(total, enemy.telemetry);
});

test('combat: spawns over the enemy cap are skipped, not queued', async () => {
  const run = await quietRun({}, (d) => {
    d.caps.enemies = 5;
    d.difficulty[0].spawnPerSecond = 600; // 10 spawns per step
  });
  step(run);
  assertEqual(run.enemies.length, 5);
  assert(run.spawnAccumulator < 1, 'skipped spawns are not kept for later');
});

test('combat: Ping fires only at enemies in range and only when off cooldown', async () => {
  const run = await quietRun();
  place(run, 'dropped-packet', 1000, 0);
  step(run);
  assertEqual(run.projectiles.length, 0, 'out of range');
  run.enemies = [];
  place(run, 'dropped-packet', 200, 0);
  step(run);
  assertEqual(run.projectiles.length, 1, 'fires when in range');
  step(run);
  assertEqual(run.projectiles.length, 1, 'does not fire again during cooldown');
});

// ---------- US2 ----------

test('combat: pickups inside the pickup radius are drawn in and collected', async () => {
  const run = await quietRun();
  run.engineer.telemetryToNext = 1000; // keep this test independent of level-up tuning
  addPickup(run, run.engineer.pickupRadius - 5, 0, 3);
  addPickup(run, run.engineer.pickupRadius + 200, 0, 7);
  stepUntil(run, (r) => r.pickups.length === 1, 60);
  assertEqual(run.engineer.telemetry, 3);
  assertEqual(run.pickups[0].value, 7, 'the far pickup stays');
});

test('combat: over the pickup cap the two oldest merge and no telemetry is lost', async () => {
  const run = await quietRun({}, (d) => { d.caps.pickups = 3; });
  for (const v of [1, 2, 3, 4]) addPickup(run, 1000 + v, 1000, v);
  assertEqual(run.pickups.length, 3);
  assertEqual(run.pickups.map((p) => p.value), [3, 3, 4]);
});

test('combat: a Firewall Rule barrier hits each enemy at most once per hitCooldown', async () => {
  const run = await quietRun();
  run.engineer.tools = [{ id: 'firewall-rule', rank: 1, cooldownLeft: 0 }];
  const stats = run.data.tools.find((t) => t.id === 'firewall-rule').ranks[0];
  const enemy = place(run, 'dropped-packet', stats.orbitRadius, 0);
  enemy.health = 1e6;
  enemy.speed = 0;
  let hits = 0;
  for (let i = 0; i < 120; i++) {
    run.events = [];
    step(run);
    hits += run.events.filter((ev) => ev.type === 'hit').length;
    enemy.x = run.engineer.x + stats.orbitRadius * Math.cos(run.elapsed * stats.rotationSpeed);
    enemy.y = run.engineer.y + stats.orbitRadius * Math.sin(run.elapsed * stats.rotationSpeed);
  }
  // Two seconds of constant contact with a 0.5 s hit cooldown: 4 or 5 hits, never more.
  assert(hits >= 4 && hits <= 5, `expected 4–5 hits, got ${hits}`);
});
