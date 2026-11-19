import { test, assert, assertEqual, assertApprox, loadGameData } from './harness.js';
import { step, chooseUpgrade } from '../engine/run.js';
import { telemetryToNext, buildOffer, describeChange, addTelemetry } from '../engine/progression.js';
import { hashRun } from '../engine/hash.js';
import { quietRun } from './fixtures.js';

const maxAll = (run) => {
  run.engineer.tools = run.data.tools.slice(0, run.data.player.maxTools).map((t) => ({ id: t.id, rank: 5, cooldownLeft: 0 }));
  run.engineer.passives = run.data.passives.map((p) => ({ id: p.id, rank: 5 }));
};

test('progression: telemetry needed per level strictly increases', async () => {
  const d = await loadGameData();
  for (let l = 1; l < 50; l++) assert(telemetryToNext(d, l + 1) > telemetryToNext(d, l), `level ${l}`);
  assertEqual(telemetryToNext(d, 1), d.progression.base);
});

test('progression: a full telemetry bar pauses the run and offers 3 distinct choices', async () => {
  const run = await quietRun();
  addTelemetry(run, run.engineer.telemetryToNext);
  step(run);
  assertEqual(run.phase, 'levelup');
  assertEqual(run.offer.length, 3);
  const keys = run.offer.map((o) => `${o.kind}:${o.id}`);
  assertEqual(new Set(keys).size, 3, 'choices are distinct');
});

test('progression: offers show every remaining candidate (no duplicates) when only 1–2 remain', async () => {
  const run = await quietRun();
  maxAll(run);
  run.engineer.tools[0].rank = 4;
  assertEqual(buildOffer(run).map((o) => o.id), [run.engineer.tools[0].id]);
  run.engineer.passives[0].rank = 4;
  const two = buildOffer(run);
  assertEqual(two.length, 2);
  assertEqual(new Set(two.map((o) => o.id)).size, 2);
});

test('progression: no new tools are offered once the tool limit is reached', async () => {
  const run = await quietRun({}, (d) => { d.player.maxTools = 1; });
  for (let i = 0; i < 20; i++) {
    for (const o of buildOffer(run)) assert(!(o.kind === 'tool' && o.fromRank === 0), 'new tool offered past the limit');
  }
});

test('progression: max-rank items are never offered', async () => {
  const run = await quietRun();
  run.engineer.tools[0].rank = 5;
  for (let i = 0; i < 30; i++) {
    for (const o of buildOffer(run)) assert(!(o.id === run.engineer.tools[0].id), 'max-rank tool offered');
  }
});

test('progression: the fallback heal is offered when nothing is left', async () => {
  const run = await quietRun();
  maxAll(run);
  run.engineer.uptime = 10;
  const offer = buildOffer(run);
  assertEqual(offer.map((o) => o.kind), ['heal']);
  run.phase = 'levelup';
  run.pendingLevelUps = 1;
  run.offer = offer;
  chooseUpgrade(run, 0);
  assertEqual(run.engineer.uptime, 10 + run.engineer.maxUptime * run.data.levelUp.fallbackHealPercent / 100);
});

test('progression: displayed changes equal the stats applied after choosing', async () => {
  const run = await quietRun();
  const base = run.data.player;
  for (let round = 0; round < 12; round++) {
    run.phase = 'levelup';
    run.pendingLevelUps = 1;
    run.offer = buildOffer(run);
    const item = run.offer[0];
    if (item.kind === 'heal') break;
    assertEqual(item.changes, describeChange(run.data, item));
    chooseUpgrade(run, 0);
    const owned = (item.kind === 'tool' ? run.engineer.tools : run.engineer.passives).find((x) => x.id === item.id);
    assertEqual(owned.rank, item.toRank);
    if (item.kind === 'tool') {
      const stats = run.data.tools.find((t) => t.id === item.id).ranks[owned.rank - 1];
      for (const c of item.changes) assertEqual(stats[c.stat], c.to, `${item.id}.${c.stat}`);
    } else {
      for (const c of item.changes) {
        if (c.stat === 'moveSpeedPercent') assertApprox(run.engineer.moveSpeed, base.moveSpeed * (1 + c.to / 100));
        if (c.stat === 'pickupRadiusPercent') assertApprox(run.engineer.pickupRadius, base.pickupRadius * (1 + c.to / 100));
        if (c.stat === 'maxUptimeBonus') assertApprox(run.engineer.maxUptime, base.maxUptime + c.to);
        if (c.stat === 'regenPerSecond') assertApprox(run.engineer.regenPerSecond, c.to);
      }
    }
  }
});

test('progression: one pickup worth several levels queues level-ups resolved one at a time', async () => {
  const run = await quietRun();
  const need = telemetryToNext(run.data, 1) + telemetryToNext(run.data, 2) + telemetryToNext(run.data, 3);
  addTelemetry(run, need);
  assertEqual(run.pendingLevelUps, 3);
  step(run);
  assertEqual(run.phase, 'levelup');
  chooseUpgrade(run, 0);
  assertEqual(run.phase, 'levelup', 'second pending level-up');
  chooseUpgrade(run, 0);
  chooseUpgrade(run, 0);
  assertEqual(run.phase, 'playing');
  assertEqual(run.engineer.level, 4);
  assertEqual(run.offer, null);
});

test('progression: invalid choices change nothing', async () => {
  const run = await quietRun();
  const before = hashRun(run);
  assertEqual(chooseUpgrade(run, 0).ok, false, 'not in levelup phase');
  addTelemetry(run, run.engineer.telemetryToNext);
  step(run);
  const mid = hashRun(run);
  for (const bad of [-1, 3, 1.5, 'x']) assertEqual(chooseUpgrade(run, bad).ok, false, `index ${bad}`);
  assertEqual(hashRun(run), mid);
  assert(before !== mid);
});
