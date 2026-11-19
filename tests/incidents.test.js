// Major Incidents (feature 004): U2–U6 and the reward-pickup cap (specs/004-major-incidents/quickstart.md).
import { test, assert, assertEqual, assertApprox, loadGameData } from './harness.js';
import { createRun, step, chooseUpgrade, pause, resume } from '../engine/run.js';
import { addPickup } from '../engine/combat.js';
import { activeIncidentCount } from '../engine/incidents.js';
import { spawnEnemy } from '../engine/spawner.js';
import { rowFor } from '../engine/difficulty.js';
import { hashRun } from '../engine/hash.js';
import { createRng } from '../engine/rng.js';

// A run with incidents but almost no ordinary spawning; levels last `levelSeconds`.
async function incidentRun({ levelSeconds = 2, seed = 1, edit = () => {} } = {}) {
  const data = await loadGameData();
  for (const row of data.difficulty) row.spawnPerSecond = 1e-9;
  data.player.maxUptime = 1e12;
  edit(data);
  const run = createRun(data, { seed, levelSeconds });
  return run;
}

// Steps, auto-choosing upgrades, collecting events; keeps the engineer alive.
function advance(run, n, onStep = () => {}, input = { dx: 0, dy: 0 }) {
  const events = [];
  for (let i = 0; i < n && run.phase !== 'ended'; i++) {
    if (run.phase === 'levelup') chooseUpgrade(run, 0);
    run.engineer.uptime = run.engineer.maxUptime;
    step(run, input);
    for (const e of run.events) events.push({ ...e, tick: run.tick });
    run.events.length = 0;
    onStep(run);
  }
  return events;
}

const incidentOf = (run, id) => run.enemies.find((e) => e.incidentId === id);
// Steps until the run reaches `level` (the incident for that level has then arrived).
function untilLevel(run, level) {
  const events = [];
  while (run.difficultyLevel < level && run.phase !== 'ended') events.push(...advance(run, 1));
  return events;
}

test('incidents: reward pickups survive the pickup cap; ordinary pickups merge around them', async () => {
  const run = await incidentRun();
  run.data.caps.pickups = 3;
  addPickup(run, 0, 0, 50, { reward: true });
  for (let i = 0; i < 6; i++) addPickup(run, i, 0, 1);
  const rewards = run.pickups.filter((p) => p.reward);
  assertEqual(rewards.length, 1);
  assertEqual(rewards[0].value, 50);
  assertEqual(run.pickups.filter((p) => !p.reward).length, 3);
  assertEqual(run.pickups.filter((p) => !p.reward).reduce((s, p) => s + p.value, 0), 6);
});

test('incidents: each arrives on the step its level begins, off-screen, on screen within 2 s (U2)', async () => {
  for (const levelSeconds of [2, 60]) {
    const run = await incidentRun({ levelSeconds });
    const arrivals = [];
    advance(run, Math.ceil(18 * levelSeconds * 60) + 2, (r) => {
      for (const def of r.data.incidents) {
        const e = incidentOf(r, def.id);
        if (e && !arrivals.some((a) => a.id === def.id)) arrivals.push({ id: def.id, level: r.difficultyLevel, tick: r.tick, d: Math.hypot(e.x - r.engineer.x, e.y - r.engineer.y) });
      }
    });
    assertEqual(arrivals.map((a) => a.level), [7, 12, 18], `levelSeconds ${levelSeconds}`);
    for (const a of arrivals) {
      assertEqual(a.tick, Math.round((run.data.incidents.find((x) => x.id === a.id).arrivalLevel - 1) * levelSeconds * 60), `${a.id} arrival tick (first step of its level)`);
      assert(a.d > 700, `${a.id} arrived ${a.d.toFixed(0)} u away (off-screen)`);
    }
  }
});

test('incidents: within 330 u of the engineer by 2 s after arrival; record active; one event (U2)', async () => {
  const run = await incidentRun({ levelSeconds: 60 });
  let events = untilLevel(run, 7);
  const leak = incidentOf(run, 'route-leak');
  assert(leak, 'Route Leak present at level 7');
  assertEqual(events.filter((e) => e.type === 'incident-arrived').length, 1);
  const rec = run.incidents.find((r) => r.id === 'route-leak');
  assertEqual(rec.state, 'active');
  assertApprox(rec.arrivedAt, 360, 1e-9);
  advance(run, 120);
  const e = incidentOf(run, 'route-leak');
  assert(Math.hypot(e.x - run.engineer.x, e.y - run.engineer.y) <= 330, 'on screen within 2 s');
});

test('incidents: arrival direction is seeded (U2)', async () => {
  const pos = async (seed) => {
    const run = await incidentRun({ seed });
    untilLevel(run, 7);
    const e = incidentOf(run, 'route-leak');
    return [e.x, e.y];
  };
  assertEqual(await pos(5), await pos(5));
  assert(JSON.stringify(await pos(5)) !== JSON.stringify(await pos(6)), 'different seeds, different directions');
});

test('incidents: resolving drops one reward pickup and nothing else; record resolved (U4)', async () => {
  const run = await incidentRun();
  untilLevel(run, 7);
  const e = incidentOf(run, 'route-leak');
  const before = run.pickups.length;
  e.dead = true; // defeated this step
  const x = e.x;
  const events = advance(run, 30);
  const resolved = events.filter((ev) => ev.type === 'incident-resolved');
  assertEqual(resolved.length, 1);
  assertEqual(run.incidents.find((r) => r.id === 'route-leak').state, 'resolved');
  const rewards = run.pickups.filter((p) => p.reward);
  assertEqual(rewards.length, 1);
  assertEqual(rewards[0].value, run.data.incidents[0].rewardTelemetry);
  assert(!events.some((ev) => ev.type === 'enemy-defeated' && ev.typeId === 'route-leak'));
  assert(run.pickups.length <= before + 1 + 20, 'only minion drops besides the reward');
  assertApprox(rewards[0].x, x, 1e-9);
});

test('incidents: collecting the reward adds exactly its telemetry (U4)', async () => {
  const run = await incidentRun();
  untilLevel(run, 7);
  run.engineer.telemetryToNext = 1e9; // no level-up in between, so the gain is visible
  const before = run.engineer.telemetry;
  run.pickups = [];
  addPickup(run, run.engineer.x, run.engineer.y, 60, { reward: true });
  run.enemies = run.enemies.filter((e) => e.incidentId !== undefined);
  for (const e of run.enemies) e.x = e.y = 1e5;
  advance(run, 1);
  assertEqual(run.engineer.telemetry - before, 60);
  assertEqual(run.pickups.length, 0);
});

test('incidents: contact drains at the incident rate, above any ordinary enemy at arrival (U4, FR-007)', async () => {
  const run = await incidentRun();
  run.data.player.invulnerableSeconds = 0;
  untilLevel(run, 7);
  const e = incidentOf(run, 'route-leak');
  e.x = run.engineer.x + 10;
  e.y = run.engineer.y;
  run.engineer.uptime = 1000;
  run.engineer.maxUptime = 1000;
  run.enemies = run.enemies.filter((n) => n === e);
  step(run, { dx: 0, dy: 0 });
  assertApprox(1000 - run.engineer.uptime, e.damagePerSecond / 60, 1e-6);
});

test('incidents: Route Leak bursts on its interval, never more than maxAlive, respects the cap (U3)', async () => {
  const run = await incidentRun({ levelSeconds: 60 });
  untilLevel(run, 7);
  const leakId = incidentOf(run, 'route-leak').id;
  const b = run.data.incidents[0].behavior;
  incidentOf(run, 'route-leak').health = 1e9;
  for (const t of run.engineer.tools) t.offlineUntil = 1e9; // no firing: minions accumulate
  const events = advance(run, Math.round(b.intervalSeconds * 60 * 5) + 2);
  const leaks = events.filter((e) => e.type === 'leak');
  assert(leaks.length >= 3, `${leaks.length} bursts`);
  assertEqual(leaks[0].count, b.burst);
  const alive = run.enemies.filter((e) => e.leakedBy === leakId && !e.dead);
  assert(alive.length <= b.maxAlive, `${alive.length} minions alive`);
  assert(alive.every((m) => m.typeId === b.minionType));
  // Cap: with the enemy cap reached, no burst.
  run.data.caps.enemies = run.enemies.filter((e) => e.incidentId === undefined).length;
  const more = advance(run, Math.round(b.intervalSeconds * 60) + 2).filter((e) => e.type === 'leak');
  assertEqual(more.length, 0);
});

test('incidents: Core Switch Failure warns, takes a tool offline, spaced, never the last (U3)', async () => {
  const run = await incidentRun({ levelSeconds: 60 });
  untilLevel(run, 12);
  const csf = incidentOf(run, 'core-switch-failure');
  assert(csf, 'Core Switch Failure present at level 12');
  csf.health = 1e9;
  const b = run.data.incidents[1].behavior;
  run.engineer.tools = [{ id: 'ping', rank: 1, cooldownLeft: 0 }];
  // One tool owned: nothing happens.
  let events = advance(run, 60 * 20);
  assertEqual(events.filter((e) => e.type === 'link-down' || e.type === 'link-warning').length, 0);
  run.engineer.tools.push({ id: 'load-balancer', rank: 1, cooldownLeft: 0 });
  events = advance(run, 60 * 40);
  const warn = events.filter((e) => e.type === 'link-warning');
  const down = events.filter((e) => e.type === 'link-down');
  assert(warn.length >= 2 && down.length >= 2, `${warn.length} warnings, ${down.length} outages`);
  assertApprox((down[0].tick - warn[0].tick) / 60, b.warningSeconds, 1 / 60 + 1e-9);
  assertEqual(down[0].toolId, warn[0].toolId);
  assert((warn[1].tick - warn[0].tick) / 60 >= b.cooldownSeconds - 1e-9, 'warnings at least cooldown apart');
  const restored = events.filter((e) => e.type === 'link-restored');
  assert(restored.length >= 1);
  assertApprox((restored[0].tick - down[0].tick) / 60, b.offlineSeconds, 1 / 60 + 1e-9);
  // While offline, that tool does not fire.
  const r2 = await incidentRun({ levelSeconds: 60 });
  untilLevel(r2, 12);
  incidentOf(r2, 'core-switch-failure').health = 1e9;
  r2.engineer.tools = [{ id: 'ping', rank: 1, cooldownLeft: 0, offlineUntil: r2.elapsed + 3 }, { id: 'firewall-rule', rank: 1, cooldownLeft: 0 }];
  spawnEnemy(r2, 'dropped-packet', r2.engineer.x + 100, r2.engineer.y, rowFor(r2.data, 12)).health = 1e9;
  const fired = advance(r2, 60).filter((e) => e.type === 'fire' && e.toolId === 'ping');
  assertEqual(fired.length, 0);
});

test('incidents: resolving Core Switch Failure restores tools at once (U3)', async () => {
  const run = await incidentRun({ levelSeconds: 60 });
  untilLevel(run, 12);
  run.engineer.tools.push({ id: 'load-balancer', rank: 1, cooldownLeft: 0 });
  const csf = incidentOf(run, 'core-switch-failure');
  csf.health = 1e9;
  advance(run, 60 * 9); // first warning at 6 s, outage at 7.5 s
  assert(run.engineer.tools.some((t) => t.offlineUntil > run.elapsed), 'a tool is offline');
  csf.health = 0.001;
  csf.dead = true;
  const events = advance(run, 1);
  assert(events.some((e) => e.type === 'link-restored'));
  assert(run.engineer.tools.every((t) => !(t.offlineUntil > run.elapsed)));
});

test('incidents: Ransomware infects nearby enemies once and clears on resolution (U3)', async () => {
  const run = await incidentRun({ levelSeconds: 60 });
  untilLevel(run, 18);
  const rw = incidentOf(run, 'ransomware-outbreak');
  rw.health = 1e9;
  const b = run.data.incidents[2].behavior;
  for (const t of run.engineer.tools) t.offlineUntil = 1e9;
  const row = rowFor(run.data, 18);
  const near = spawnEnemy(run, 'dropped-packet', rw.x + 50, rw.y, row);
  const far = spawnEnemy(run, 'dropped-packet', rw.x + 2000, rw.y, row);
  const base = { speed: near.speed, max: near.maxHealth };
  rw.timer = 0;
  advance(run, 1);
  assert(near.infected && !far.infected);
  assertApprox(near.speed, base.speed * b.speedMultiplier, 1e-9);
  assertApprox(near.maxHealth, base.max * b.healthMultiplier, 1e-9);
  advance(run, 120);
  assertApprox(near.speed, base.speed * b.speedMultiplier, 1e-9, 'infected only once');
  assert(!rw.infected, 'incidents are never infected');
  rw.dead = true;
  const events = advance(run, 1);
  assert(events.some((e) => e.type === 'infection-cleared'));
  assert(!near.infected);
  assertApprox(near.speed, base.speed, 1e-9);
  assert(near.health <= base.max + 1e-9 && near.maxHealth === base.max);
});

test('incidents: an unresolved incident lingers at fixed strength; two can be active (U5)', async () => {
  const run = await incidentRun({ levelSeconds: 2 });
  untilLevel(run, 7);
  const leak = incidentOf(run, 'route-leak');
  leak.health = leak.maxHealth = 1e12;
  const stats = [leak.speed, leak.damagePerSecond];
  untilLevel(run, 12);
  assertEqual(activeIncidentCount(run), 2);
  assertEqual([leak.speed, leak.damagePerSecond], stats);
  assertEqual(run.incidents.map((r) => r.state).slice(0, 2), ['active', 'active']);
});

test('incidents: ordinary spawning halves only during an active incident\'s arrival level, once (U5)', async () => {
  const data = await loadGameData();
  data.player.maxUptime = 1e12;
  for (const row of data.difficulty) row.spawnPerSecond = 6;
  const run = createRun(data, { seed: 2, levelSeconds: 4 });
  // Simplest exact check: compare accumulator growth with and without an incident active.
  const grow = (r) => { const before = r.spawnAccumulator; for (const t of r.engineer.tools) t.offlineUntil = 1e9; r.engineer.uptime = 1e12; step(r, { dx: 0, dy: 0 }); r.events.length = 0; let g = r.spawnAccumulator - before; while (g < 0) g += 1; return g; };
  const quiet = createRun(data, { seed: 2, levelSeconds: 4 });
  for (let i = 0; i < 10; i++) grow(quiet);
  assertApprox(grow(quiet), 6 / 60, 1e-9);
  const busy = createRun(data, { seed: 2, levelSeconds: 4 });
  while (busy.difficultyLevel < 7) { if (busy.phase === 'levelup') chooseUpgrade(busy, 0); grow(busy); }
  if (busy.phase === 'levelup') chooseUpgrade(busy, 0);
  assertEqual(activeIncidentCount(busy), 1);
  for (const e of busy.enemies) if (e.incidentId) e.health = e.maxHealth = 1e12;
  assertApprox(grow(busy), (6 / 60) * data.incidentSpawnFactor, 1e-9, 'half rate during its arrival level');
  while (busy.difficultyLevel < 8) { if (busy.phase === 'levelup') chooseUpgrade(busy, 0); grow(busy); }
  if (busy.phase === 'levelup') chooseUpgrade(busy, 0);
  assertEqual(activeIncidentCount(busy), 1, 'still active (lingering)');
  assertApprox(grow(busy), 6 / 60, 1e-9, 'full rate once its arrival level is over');
  while (busy.difficultyLevel < 12) { if (busy.phase === 'levelup') chooseUpgrade(busy, 0); grow(busy); }
  if (busy.phase === 'levelup') chooseUpgrade(busy, 0);
  for (const e of busy.enemies) if (e.incidentId) e.health = e.maxHealth = 1e12;
  assertEqual(activeIncidentCount(busy), 2);
  assertApprox(grow(busy), (6 / 60) * data.incidentSpawnFactor, 1e-9, 'not compounded (only the new arrival counts)');
  for (const e of busy.enemies) if (e.incidentId) e.dead = true;
  grow(busy);
  if (busy.phase === 'levelup') chooseUpgrade(busy, 0);
  assertEqual(activeIncidentCount(busy), 0);
  assertApprox(grow(busy), 6 / 60, 1e-9, 'full rate when resolved');
});

test('incidents: run length unchanged; same seed + inputs → same hash with incidents (U6)', async () => {
  const r = createRng(9);
  const inputs = [];
  let cur = { dx: 0, dy: 0 };
  for (let i = 0; i < 20 * 3 * 60 + 5; i++) {
    if (i % 30 === 0) { const a = r.next() * Math.PI * 2; cur = { dx: Math.cos(a), dy: Math.sin(a) }; }
    inputs.push(cur);
  }
  const play = async () => {
    const data = await loadGameData();
    data.player.maxUptime = 1e12;
    const run = createRun(data, { seed: 11, levelSeconds: 3 });
    for (const input of inputs) {
      if (run.phase === 'ended') break;
      if (run.phase === 'levelup') chooseUpgrade(run, run.tick % run.offer.length);
      run.engineer.uptime = run.engineer.maxUptime;
      step(run, input);
      run.events.length = 0;
    }
    return run;
  };
  const a = await play();
  const b = await play();
  assertEqual(a.phase, 'ended');
  assertEqual(a.outcome, 'win');
  assertEqual(a.elapsed, a.runLength);
  assert(a.incidents.every((x) => x.state !== 'not-reached'), 'all three incidents reached');
  assertEqual(hashRun(a), hashRun(b));
});

test('incidents: pause and level-up freeze incidents (U6)', async () => {
  const run = await incidentRun();
  untilLevel(run, 7);
  const e = incidentOf(run, 'route-leak');
  const snap = () => JSON.stringify([e.x, e.y, e.timer, e.health, run.tick]);
  const before = snap();
  pause(run);
  step(run, { dx: 0, dy: 0 });
  assertEqual(snap(), before);
  resume(run);
  run.phase = 'levelup';
  step(run, { dx: 0, dy: 0 });
  assertEqual(snap(), before);
});

