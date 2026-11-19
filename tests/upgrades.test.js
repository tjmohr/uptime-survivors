// Late-game upgrades (feature 006): U1–U7 (specs/006-late-game-upgrades/quickstart.md).
import { test, assert, assertEqual, assertApprox, loadGameData } from './harness.js';
import { validateGameData } from '../engine/content.js';
import { createRun, step, chooseUpgrade } from '../engine/run.js';
import { buildOffer, candidates } from '../engine/progression.js';
import { bonusTotals, effectiveToolStats, repeatableBonus } from '../engine/stats.js';
import { addPickup } from '../engine/combat.js';
import { MAX_ZONES } from '../engine/weapons.js';
import { quietRun, place } from './fixtures.js';

const DT = 1 / 60;
const give = (run, ...tools) => {
  run.engineer.tools = tools.map(([id, rank = 1]) => ({ id, rank, cooldownLeft: 0 }));
};
const passive = (run, id, rank) => run.engineer.passives.push({ id, rank });
// A passive's percentage at a rank, read from the data (so retuning values never breaks these tests).
const pct = (run, id, rank) => Object.values(run.defs.passive.get(id).ranks[rank - 1])[0];
// An enemy that stays put and does not die.
function post(run, type, x, y) {
  const e = place(run, type, x, y);
  e.speed = 0;
  e.health = e.maxHealth = 1e9;
  return e;
}
function runSteps(run, n) {
  const events = [];
  for (let i = 0; i < n; i++) {
    run.engineer.uptime = run.engineer.maxUptime;
    step(run, { dx: 0, dy: 0 });
    events.push(...run.events.map((e) => ({ ...e, tick: run.tick })));
    run.events.length = 0;
  }
  return events;
}

// ---- U1: data validation ----

function failsAt(edit, path) {
  return loadGameData().then((d) => {
    edit(d);
    const r = validateGameData(d);
    assert(!r.ok, `expected failure at ${path}`);
    const err = r.errors.find((e) => e.path === path);
    assert(err, `expected an error at ${path}; got ${JSON.stringify(r.errors)}`);
    return err;
  });
}
const tool = (d, id) => d.tools.find((t) => t.id === id);
const pas = (d, id) => d.passives.find((p) => p.id === id);
const idx = (d, id) => d.tools.findIndex((t) => t.id === id);
const pidx = (d, id) => d.passives.findIndex((p) => p.id === id);

test('upgrades U1: shipped data has 7 tools, 6 passives, Capacity Planning, and a 15% heal, and is valid', async () => {
  const d = await loadGameData();
  const r = validateGameData(d);
  assert(r.ok, JSON.stringify(r.errors));
  assertEqual(d.tools.length, 7);
  assertEqual(d.passives.length, 6);
  assertEqual(d.repeatable.id, 'capacity-planning');
  assertEqual(d.levelUp.fallbackHealPercent, 15);
});

test('upgrades U1: broken copies fail naming the item and path', async () => {
  let err = await failsAt((d) => { tool(d, 'traceroute').kind = 'laser'; }, `tools[5].kind`.replace('5', '4'));
  assertEqual(err.id, 'traceroute');
  const t = await loadGameData();
  const ti = idx(t, 'traceroute');
  const ri = idx(t, 'rate-limiter');
  err = await failsAt((d) => { delete tool(d, 'traceroute').ranks[0].hops; }, `tools[${ti}].ranks[0].hops`);
  assertEqual(err.id, 'traceroute');
  await failsAt((d) => { tool(d, 'traceroute').ranks[2].hops = 2.5; }, `tools[${ti}].ranks[2].hops`);
  await failsAt((d) => { tool(d, 'rate-limiter').ranks[0].slowPercent = 90; }, `tools[${ri}].ranks[0].slowPercent`);
  err = await failsAt((d) => { pas(d, 'qos-policy').ranks[4].cooldownReductionPercent = 60; },
    `passives[${pidx(t, 'qos-policy')}].ranks[4].cooldownReductionPercent`);
  assertEqual(err.id, 'qos-policy');
  await failsAt((d) => { pas(d, 'hardened-config').ranks[4].damageReductionPercent = 60; },
    `passives[${pidx(t, 'hardened-config')}].ranks[4].damageReductionPercent`);
  err = await failsAt((d) => { delete d.repeatable.damagePercentPerTake; }, 'repeatable.damagePercentPerTake');
  assertEqual(err.id, 'capacity-planning');
  err = await failsAt((d) => { d.repeatable.id = 'ping'; }, 'repeatable.id');
  assert(/duplicate/.test(err.message), err.message);
  await failsAt((d) => { delete d.repeatable; }, 'repeatable');
});

// ---- U2: effective stats ----

test('upgrades U2: Link Aggregation + Capacity Planning add for damage; QoS shortens cooldown and hit cooldown only', async () => {
  const run = await quietRun();
  const ping = run.defs.tool.get('ping').ranks[0];
  assertEqual(JSON.stringify(effectiveToolStats(run, 'ping', 1)), JSON.stringify(ping), 'no bonuses → rank values');
  passive(run, 'link-aggregation', 3);
  run.engineer.capacityTakes = 2; // +10%
  const la = pct(run, 'link-aggregation', 3);
  assertEqual(repeatableBonus(run), 10);
  assertEqual(bonusTotals(run).damagePercent, la + 10);
  let s = effectiveToolStats(run, 'ping', 1);
  assertApprox(s.damage, 10 * (1 + (la + 10) / 100));
  assertEqual(s.cooldown, ping.cooldown);
  assertEqual(s.range, ping.range);
  passive(run, 'qos-policy', 2);
  const q = 1 - pct(run, 'qos-policy', 2) / 100;
  s = effectiveToolStats(run, 'ping', 1);
  assertApprox(s.cooldown, ping.cooldown * q);
  const fw = run.defs.tool.get('firewall-rule').ranks[0];
  assertApprox(effectiveToolStats(run, 'firewall-rule', 1).hitCooldown, fw.hitCooldown * q);
  const rl = run.defs.tool.get('rate-limiter').ranks[0];
  assertEqual(effectiveToolStats(run, 'rate-limiter', 1).tickInterval, rl.tickInterval, 'tick interval is not a cooldown');
});

test('upgrades U2: tools fire with exactly the effective numbers (hit amounts and cooldown timing)', async () => {
  const run = await quietRun();
  give(run, ['ping', 1]);
  passive(run, 'link-aggregation', 3);
  passive(run, 'qos-policy', 2);
  run.engineer.capacityTakes = 2;
  post(run, 'dropped-packet', 120, 0);
  const events = runSteps(run, 200);
  const hits = events.filter((e) => e.type === 'hit');
  assert(hits.length >= 2, 'ping hit');
  const eff = effectiveToolStats(run, 'ping', 1);
  for (const h of hits) assertApprox(h.amount, 10 * (1 + (pct(run, 'link-aggregation', 3) + 10) / 100));
  for (const h of hits) assertApprox(h.amount, eff.damage);
  const fires = events.filter((e) => e.type === 'fire').map((e) => e.tick);
  const gaps = fires.slice(1).map((t, i) => t - fires[i]);
  // The effective cooldown in steps, rounded either way by the fixed step.
  const steps = eff.cooldown * 60;
  assert(gaps.length > 1 && gaps.every((g) => g === Math.floor(steps) || g === Math.ceil(steps)), `gaps ${gaps} for ${steps} steps`);
});

// ---- U3: Traceroute ----

test('upgrades U3: Traceroute hits the nearest, then hops up to its hop count within hop range', async () => {
  const run = await quietRun();
  give(run, ['traceroute', 1]); // hops 2, hopRange 140, range 300
  const a = post(run, 'dropped-packet', 100, 0);
  const b = post(run, 'dropped-packet', 220, 0);
  const c = post(run, 'dropped-packet', 340, 0);
  const d = post(run, 'dropped-packet', 460, 0);
  const far = post(run, 'dropped-packet', -500, 0);
  const events = runSteps(run, 1);
  const chain = events.find((e) => e.type === 'chain');
  assert(chain, 'chain event');
  assertEqual(chain.points.length, 4, 'engineer + 3 hits (1 + 2 hops)');
  for (const e of [a, b, c]) assert(e.health < e.maxHealth, `hit ${e.x}`);
  assertEqual(d.health, d.maxHealth, 'fourth not hit (hop count)');
  assertEqual(far.health, far.maxHealth);
  assertEqual(chain.points.slice(1).map((p) => p.x).join(','), '100,220,340');
  assert(events.some((e) => e.type === 'fire' && e.toolId === 'traceroute'), 'fire sound event');
});

test('upgrades U3: Traceroute stops when no problem is within hop range, never hits twice, waits when nothing is in range', async () => {
  const run = await quietRun();
  give(run, ['traceroute', 5]);
  assertEqual(runSteps(run, 30).filter((e) => e.type === 'chain').length, 0, 'nothing in range: no fire');
  assertEqual(run.engineer.tools[0].cooldownLeft, 0, 'stays ready');
  post(run, 'dropped-packet', 100, 0);
  post(run, 'dropped-packet', 150, 0);
  const chain = runSteps(run, 1).find((e) => e.type === 'chain');
  assertEqual(chain.points.length, 3, 'two problems → two hits, no repeats');
});

// ---- U4: Rate Limiter ----

test('upgrades U4: Rate Limiter slows ordinary problems inside, not outside, and damages every tick', async () => {
  const run = await quietRun();
  give(run, ['rate-limiter', 1]); // radius 90, slow 20%, damage 3 / 0.5 s
  const inside = place(run, 'ddos-botnet', 60, 0);
  const outside = place(run, 'ddos-botnet', 0, 400);
  inside.health = inside.maxHealth = outside.health = outside.maxHealth = 1e6;
  const x0 = inside.x;
  const y0 = outside.y;
  runSteps(run, 1);
  assertApprox(x0 - inside.x, inside.speed * 0.8 * DT, 1e-9, 'inside moved at 80%');
  assertApprox(y0 - outside.y, outside.speed * DT, 1e-9, 'outside at full speed');
  assert(run.slowField && run.slowField.radius === 90, 'field published');
  runSteps(run, 60);
  const ticks = Math.round((inside.maxHealth - inside.health) / 3);
  assert(ticks === 2 || ticks === 3, `ticks in ~1 s: ${ticks}`);
  assertEqual(outside.health, outside.maxHealth, 'outside not damaged');
});

test('upgrades U4: Major Incidents take Rate Limiter damage but are never slowed; infected enemies slowed from infected speed', async () => {
  const data = await loadGameData();
  for (const row of data.difficulty) row.spawnPerSecond = 1e-9;
  const run = createRun(data, { seed: 2, levelSeconds: 1 });
  while (!run.enemies.some((e) => e.incidentId)) { run.engineer.uptime = 1e9; if (run.phase === 'levelup') chooseUpgrade(run, 0); step(run, { dx: 0, dy: 0 }); run.events.length = 0; }
  give(run, ['rate-limiter', 5]); // radius 150, slow 40%
  const inc = run.enemies.find((e) => e.incidentId);
  inc.phase = 'active';
  inc.x = run.engineer.x + 100;
  inc.y = run.engineer.y;
  const def = run.defs.incident.get(inc.incidentId);
  const h0 = inc.health;
  const x0 = inc.x;
  run.engineer.uptime = 1e9;
  step(run, { dx: 0, dy: 0 });
  assertApprox(x0 - inc.x, def.speed * DT, 1e-9, 'incident at full speed');
  for (let i = 0; i < 40; i++) { run.engineer.uptime = 1e9; step(run, { dx: 0, dy: 0 }); }
  assert(inc.health < h0, 'incident damaged by the field');
  // Infected ordinary enemy: slowed from its infected speed.
  const q = await quietRun();
  give(q, ['rate-limiter', 1]);
  const e = place(q, 'ddos-botnet', 60, 0);
  e.health = e.maxHealth = 1e6;
  e.infected = true;
  e.speed *= 1.15;
  const ex = e.x;
  runSteps(q, 1);
  assertApprox(ex - e.x, e.speed * 0.8 * DT, 1e-9);
});

test('upgrades U4: an offline Rate Limiter publishes no field and deals no damage', async () => {
  const run = await quietRun();
  give(run, ['rate-limiter', 3], ['ping', 1]);
  run.engineer.tools[0].offlineUntil = 1e9;
  const e = place(run, 'ddos-botnet', 0, 60);
  e.health = e.maxHealth = 1e6;
  run.engineer.tools[1].offlineUntil = 1e9; // keep ping quiet too
  runSteps(run, 90);
  assertEqual(run.slowField, null);
  assertEqual(e.health, e.maxHealth);
});

// ---- U5: Null Route ----

test('upgrades U5: Null Route lands on the densest problem (ties → lowest id) and damages everything inside for its duration', async () => {
  const run = await quietRun();
  give(run, ['null-route', 1]); // damage 6 / 0.5 s, radius 60, duration 2.5, cooldown 5, range 350
  const lone = post(run, 'dropped-packet', -150, 0);
  const a = post(run, 'dropped-packet', 200, 0);
  const b = post(run, 'dropped-packet', 225, 0);
  const c = post(run, 'dropped-packet', 200, 25);
  const events = runSteps(run, 1);
  const placed = events.find((e) => e.type === 'zone-placed');
  assert(placed, 'zone placed');
  assertEqual(`${placed.x},${placed.y}`, `${a.x},${a.y}`, 'densest, lowest id');
  runSteps(run, 179); // to 3.0 s: one zone of 2.5 s, cooldown 5 s → no second zone yet
  assertEqual(run.zones.length, 0, 'expired');
  for (const e of [a, b, c]) assertEqual(e.maxHealth - e.health, 30, 'five ticks of 6');
  assertEqual(lone.health, lone.maxHealth, 'outside the zone');
});

test('upgrades U5: Null Route waits with nothing in range and never keeps more than 8 zones', async () => {
  const run = await quietRun({}, (d) => { for (const r of d.tools.find((t) => t.id === 'null-route').ranks) r.duration = 100; });
  give(run, ['null-route', 1]);
  const ev = runSteps(run, 30);
  assertEqual(ev.filter((e) => e.type === 'zone-placed').length, 0);
  assertEqual(run.engineer.tools[0].cooldownLeft, 0);
  post(run, 'dropped-packet', 100, 0);
  for (let i = 0; i < 20; i++) { run.engineer.tools[0].cooldownLeft = 0; runSteps(run, 1); }
  assertEqual(run.zones.length, MAX_ZONES);
});

// ---- U6: passives ----

test('upgrades U6: QoS, Link Aggregation, Observability, Hardened Config change values by exactly their percentages', async () => {
  // QoS rank 5: Ping 0.8 s shortened by the rank percentage.
  let run = await quietRun();
  give(run, ['ping', 1]);
  passive(run, 'qos-policy', 5);
  post(run, 'dropped-packet', 120, 0);
  const fires = runSteps(run, 200).filter((e) => e.type === 'fire').map((e) => e.tick);
  const want = 0.8 * (1 - pct(run, 'qos-policy', 5) / 100) * 60;
  const avg = (fires[fires.length - 1] - fires[0]) / (fires.length - 1);
  assert(fires.length >= 5 && Math.abs(avg - want) <= 0.5, `QoS average gap ${avg} vs ${want} (fires ${fires})`);
  // Link Aggregation rank 2.
  run = await quietRun();
  give(run, ['ping', 1]);
  passive(run, 'link-aggregation', 2);
  post(run, 'dropped-packet', 120, 0);
  const hit = runSteps(run, 60).find((e) => e.type === 'hit');
  assertApprox(hit.amount, 10 * (1 + pct(run, 'link-aggregation', 2) / 100));
  // Observability rank 1: ordinary pickup and an incident reward.
  run = await quietRun();
  run.engineer.tools = [];
  passive(run, 'observability-stack', 1);
  run.engineer.telemetryToNext = 1e9;
  addPickup(run, run.engineer.x, run.engineer.y, 10);
  addPickup(run, run.engineer.x + 1, run.engineer.y, 100, { reward: true });
  runSteps(run, 2);
  assertApprox(run.engineer.telemetry, 110 * (1 + pct(run, 'observability-stack', 1) / 100));
  // Hardened Config rank 4.
  run = await quietRun();
  run.engineer.tools = [];
  passive(run, 'hardened-config', 4);
  const e = place(run, 'ddos-botnet', run.engineer.x, run.engineer.y);
  const before = run.engineer.uptime = run.engineer.maxUptime;
  step(run, { dx: 0, dy: 0 });
  const expected = e.damagePerSecond * run.data.player.invulnerableSeconds * (1 - pct(run, 'hardened-config', 4) / 100);
  assertApprox(before - run.engineer.uptime, expected);
});

// ---- U7: offers ----

test('upgrades U7: new tools can be offered from the first level-up; none once 4 tools are owned; Ping starts', async () => {
  const run = await quietRun();
  assertEqual(run.engineer.tools.map((t) => t.id).join(), 'ping');
  const ids = candidates(run).filter((c) => c.kind === 'tool' && c.fromRank === 0).map((c) => c.id);
  for (const id of ['traceroute', 'rate-limiter', 'null-route']) assert(ids.includes(id), `${id} offerable`);
  give(run, ['ping'], ['traceroute'], ['rate-limiter'], ['null-route']);
  assert(!candidates(run).some((c) => c.kind === 'tool' && c.fromRank === 0), 'no 5th tool');
});

test('upgrades U7: an exhausted pool offers exactly Capacity Planning and Failover; it stacks; Failover heals 15%', async () => {
  const run = await quietRun();
  const maxAll = () => {
    give(run, ['ping', 5], ['traceroute', 5], ['rate-limiter', 5], ['null-route', 5]);
    run.engineer.passives = run.data.passives.map((p) => ({ id: p.id, rank: 5 }));
  };
  maxAll();
  run.engineer.passives[0].rank = 4;
  assert(!buildOffer(run).some((o) => o.kind === 'repeatable'), 'not offered while anything remains');
  maxAll();
  const offer = buildOffer(run);
  assertEqual(offer.map((o) => o.kind).join(), 'repeatable,heal');
  assertEqual(JSON.stringify(offer[0].changes), JSON.stringify([{ stat: 'allDamagePercent', from: 0, to: 5 }]));
  const dmg0 = effectiveToolStats(run, 'ping', 5).damage;
  for (let n = 1; n <= 3; n++) {
    run.phase = 'levelup'; run.pendingLevelUps = 1; run.offer = buildOffer(run);
    assertEqual(run.offer[0].timesTaken, n - 1);
    chooseUpgrade(run, 0);
    assertEqual(run.engineer.capacityTakes, n);
  }
  const ping = run.defs.tool.get('ping').ranks[4].damage;
  // Link Aggregation rank 5 + 3 × 5%.
  assertApprox(effectiveToolStats(run, 'ping', 5).damage, ping * (1 + (pct(run, 'link-aggregation', 5) + 15) / 100));
  assert(effectiveToolStats(run, 'ping', 5).damage > dmg0);
  assertEqual(JSON.stringify(buildOffer(run)[0].changes), JSON.stringify([{ stat: 'allDamagePercent', from: 15, to: 20 }]));
  run.engineer.uptime = 10;
  run.phase = 'levelup'; run.pendingLevelUps = 1; run.offer = buildOffer(run);
  chooseUpgrade(run, 1);
  assertApprox(run.engineer.uptime, 10 + run.engineer.maxUptime * 0.15);
});

test('upgrades U7: tool floor — below it, offers are only new tools; at or above it, offers are unrestricted', async () => {
  const run = await quietRun();
  assertEqual(JSON.stringify(run.data.levelUp.toolFloor),
    JSON.stringify([{ difficulty: 5, tools: 2 }, { difficulty: 10, tools: 3 }, { difficulty: 15, tools: 4 }]));
  const onlyNewTools = (offer) => offer.every((o) => o.kind === 'tool' && o.fromRank === 0 && o.forced);
  run.difficultyLevel = 4; // before the first floor: never forced
  for (let i = 0; i < 50; i++) assert(!buildOffer(run).some((o) => o.forced), 'no floor before difficulty 5');
  run.difficultyLevel = 5; // 1 tool < 2
  for (let i = 0; i < 50; i++) { const o = buildOffer(run); assert(onlyNewTools(o) && o.length === 3, 'forced at 5'); }
  give(run, ['ping'], ['traceroute']); // 2 tools: floor met at 5..9
  let passives = 0;
  for (let i = 0; i < 50; i++) { const o = buildOffer(run); assert(!o.some((x) => x.forced)); if (o.some((x) => x.kind === 'passive')) passives++; }
  assert(passives > 0, 'unrestricted offers include passives');
  run.difficultyLevel = 10;
  assert(onlyNewTools(buildOffer(run)), 'forced at 10 with 2 tools');
  give(run, ['ping'], ['traceroute'], ['rate-limiter']);
  run.difficultyLevel = 15;
  assert(onlyNewTools(buildOffer(run)), 'forced at 15 with 3 tools');
  give(run, ['ping'], ['traceroute'], ['rate-limiter'], ['null-route']);
  assert(!buildOffer(run).some((o) => o.forced || (o.kind === 'tool' && o.fromRank === 0)), '4 tools: never forced, no new tools');
});

test('upgrades U1: toolFloor validation (increasing difficulties, non-decreasing tools, ≤ maxTools)', async () => {
  for (const [bad, path] of [
    [[{ difficulty: 5, tools: 2 }, { difficulty: 5, tools: 3 }], 'levelUp.toolFloor[1].difficulty'],
    [[{ difficulty: 5, tools: 3 }, { difficulty: 10, tools: 2 }], 'levelUp.toolFloor[1].tools'],
    [[{ difficulty: 5, tools: 5 }], 'levelUp.toolFloor[0].tools'],
    [[{ difficulty: 21, tools: 2 }], 'levelUp.toolFloor[0].difficulty'],
  ]) {
    const d = await loadGameData();
    d.levelUp.toolFloor = bad;
    const r = validateGameData(d);
    assert(!r.ok && r.errors.some((e) => e.path === path), `${JSON.stringify(bad)} → ${path}: ${JSON.stringify(r.errors)}`);
  }
});
