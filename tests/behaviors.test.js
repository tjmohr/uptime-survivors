import { test, assert, assertEqual, assertApprox } from './harness.js';
import { step } from '../engine/run.js';
import { resolveDefeats } from '../engine/combat.js';
import { applyUpgrade } from '../engine/progression.js';
import { quietRun, place, steps } from './fixtures.js';

const def = (run, kind, id) => run.data[kind].find((x) => x.id === id);

// ---------- Enemies (T055) ----------

test('behaviors: Broadcast Storm splits into `count` smaller copies; the last generation does not split', async () => {
  const run = await quietRun();
  run.engineer.tools = [];
  const b = def(run, 'enemies', 'broadcast-storm');
  const storm = place(run, 'broadcast-storm', 300, 0);
  storm.dead = true;
  resolveDefeats(run);
  assertEqual(run.enemies.length, b.behavior.count);
  for (const copy of run.enemies) {
    assertEqual(copy.generation, 1);
    assertApprox(copy.maxHealth, storm.maxHealth * b.behavior.scale, 1e-9);
    assert(copy.radius < storm.radius, 'copies are smaller');
  }
  for (const copy of run.enemies) copy.dead = true;
  resolveDefeats(run);
  assertEqual(run.enemies.length, b.behavior.maxGenerations === 1 ? 0 : -1, 'last generation does not split');
  assertEqual(run.stats.enemiesDefeated, 1 + b.behavior.count);
});

test('behaviors: split copies respect the enemy cap', async () => {
  const run = await quietRun({}, (d) => { d.caps.enemies = 2; });
  run.engineer.tools = [];
  place(run, 'broadcast-storm', 300, 0).dead = true;
  place(run, 'dropped-packet', -300, 0);
  resolveDefeats(run);
  assert(run.enemies.length <= 2, `cap exceeded: ${run.enemies.length}`);
});

test('behaviors: Route Flap jumps `distance` toward the engineer every `intervalSeconds`', async () => {
  const run = await quietRun();
  run.engineer.tools = [];
  const b = def(run, 'enemies', 'route-flap').behavior;
  const flap = place(run, 'route-flap', 500, 0);
  flap.speed = 0; // isolate the blink from normal chasing
  const stepsPerBlink = Math.round(b.intervalSeconds * 60);
  steps(run, stepsPerBlink - 1);
  assertApprox(flap.x, 500, 1e-9, 'no jump before the interval');
  step(run);
  assertApprox(flap.x, 500 - b.distance, 1e-6, 'one jump after the interval');
  steps(run, stepsPerBlink);
  assertApprox(flap.x, 500 - 2 * b.distance, 1e-6, 'second jump');
});

test('behaviors: DDoS Botnet is the largest, slowest, toughest enemy', async () => {
  const run = await quietRun();
  const ddos = def(run, 'enemies', 'ddos-botnet');
  for (const e of run.data.enemies) {
    if (e.id === 'ddos-botnet') continue;
    assert(ddos.radius > e.radius && ddos.speed < e.speed && ddos.health > e.health, `vs ${e.id}`);
  }
});

// ---------- Tools and passives (T056) ----------

test('weapons: Ansible Playbook pulse damages every enemy within its radius and none outside', async () => {
  const run = await quietRun();
  run.engineer.tools = [{ id: 'ansible-playbook', rank: 1, cooldownLeft: 0 }];
  const stats = def(run, 'tools', 'ansible-playbook').ranks[0];
  const near = place(run, 'dropped-packet', stats.radius - 5, 0);
  const near2 = place(run, 'dropped-packet', 0, -(stats.radius - 20));
  const far = place(run, 'dropped-packet', stats.radius + 30, 0);
  for (const e of [near, near2, far]) { e.health = 1000; e.maxHealth = 1000; e.speed = 0; }
  step(run);
  assertEqual(near.health, 1000 - stats.damage);
  assertEqual(near2.health, 1000 - stats.damage);
  assertEqual(far.health, 1000, 'outside the pulse');
  assert(run.events.some((ev) => ev.type === 'pulse' && ev.radius === stats.radius));
});

test('weapons: Load Balancer fires `projectiles` evenly spaced projectiles', async () => {
  const run = await quietRun();
  run.engineer.tools = [{ id: 'load-balancer', rank: 1, cooldownLeft: 0 }];
  const stats = def(run, 'tools', 'load-balancer').ranks[0];
  step(run);
  assertEqual(run.projectiles.length, stats.projectiles);
  const angles = run.projectiles.map((p) => Math.atan2(p.vy, p.vx)).sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) {
    assertApprox(angles[i] - angles[i - 1], (Math.PI * 2) / stats.projectiles, 1e-9, 'even spacing');
  }
});

test('passives: Redundant Power Supply raises max Uptime and regenerates per second', async () => {
  const run = await quietRun();
  run.engineer.tools = [];
  const rank = def(run, 'passives', 'redundant-power-supply').ranks[0];
  applyUpgrade(run, { kind: 'passive', id: 'redundant-power-supply', fromRank: 0, toRank: 1 });
  assertEqual(run.engineer.maxUptime, run.data.player.maxUptime + rank.maxUptimeBonus);
  run.engineer.uptime = 50;
  steps(run, 60);
  assertApprox(run.engineer.uptime, 50 + rank.regenPerSecond, 1e-6);
});

test('roster: 5 enemies, 7 tools, 6 passives, and Capacity Planning (features 001 + 006)', async () => {
  const run = await quietRun();
  assertEqual(run.data.enemies.map((e) => e.id),
    ['dropped-packet', 'latency-spike', 'broadcast-storm', 'route-flap', 'ddos-botnet']);
  assertEqual(run.data.tools.map((t) => t.id),
    ['ping', 'firewall-rule', 'ansible-playbook', 'load-balancer', 'traceroute', 'rate-limiter', 'null-route']);
  assertEqual(run.data.passives.map((p) => p.id), ['bandwidth-upgrade', 'redundant-power-supply', 'qos-policy',
    'link-aggregation', 'observability-stack', 'hardened-config']);
  assertEqual(run.data.repeatable.id, 'capacity-planning');
});
