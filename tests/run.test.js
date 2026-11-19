import { test, assert, assertEqual, loadGameData } from './harness.js';
import { createRun, step } from '../engine/run.js';
import { hashRun } from '../engine/hash.js';
import { quietRun, place, steps, stepUntil } from './fixtures.js';

// ---------- US1 ----------

test('run: createRun starts at the centre with full Uptime and the starting tool', async () => {
  const data = await loadGameData();
  const run = createRun(data, { seed: 5 });
  const e = run.engineer;
  assertEqual([e.x, e.y], [0, 0]);
  assertEqual(e.uptime, data.player.maxUptime);
  assertEqual(e.maxUptime, data.player.maxUptime);
  assertEqual(e.tools.map((t) => [t.id, t.rank]), [[data.player.startingTool, 1]]);
  assertEqual(run.phase, 'playing');
  assertEqual(run.difficultyLevel, 1);
  assertEqual(run.seed, 5);
});

test('run: step changes nothing unless the phase is playing', async () => {
  const run = createRun(await loadGameData(), { seed: 9 });
  steps(run, 30);
  for (const phase of ['paused', 'levelup', 'ended']) {
    run.phase = phase;
    const before = hashRun(run);
    steps(run, 10, { dx: 1, dy: 1 });
    assertEqual(hashRun(run), before, `phase ${phase}`);
  }
});

test('run: Uptime reaching 0 ends the run as a loss with a run-ended event', async () => {
  const run = await quietRun();
  run.engineer.uptime = 1;
  place(run, 'dropped-packet', 0, 0).health = 1e6; // survives Ping so it can make contact
  run.events = [];
  stepUntil(run, (r) => r.phase === 'ended', 120);
  assertEqual(run.outcome, 'loss');
  assertEqual(run.engineer.uptime, 0);
  assert(run.events.some((ev) => ev.type === 'run-ended' && ev.outcome === 'loss'));
});

test('run: the first difficulty-up event announces level 1 debuts', async () => {
  const run = createRun(await loadGameData(), { seed: 1 });
  assertEqual(run.events[0], { type: 'difficulty-up', level: 1, debuts: ['dropped-packet'] });
});

// ---------- US3 ----------

test('run: a difficulty-up event fires at each level boundary with that level\'s debuts', async () => {
  const run = await quietRun({ levelSeconds: 1 }, (d) => { d.player.maxUptime = 1e9; });
  const seen = [];
  run.events = []; // drop the opening level-1 announcement
  for (let i = 0; i < 60 * 19 + 5; i++) {
    step(run);
    for (const ev of run.events) if (ev.type === 'difficulty-up') seen.push(ev);
    run.events = [];
    if (run.phase === 'levelup') { run.phase = 'playing'; run.pendingLevelUps = 0; run.offer = null; }
  }
  assertEqual(seen.map((s) => s.level), Array.from({ length: 19 }, (_, i) => i + 2));
  for (const ev of seen) {
    const expected = run.data.enemies.filter((e) => e.debutLevel === ev.level).map((e) => e.id);
    assertEqual(ev.debuts, expected, `debuts at level ${ev.level}`);
  }
});

test('run: surviving to the end of level 20 wins', async () => {
  const run = await quietRun({ levelSeconds: 0.5 });
  stepUntil(run, (r) => r.phase === 'ended', 60 * 11);
  assertEqual(run.outcome, 'win');
  assertEqual(run.tick, 600, 'run length is 20 × 0.5 s = 600 steps');
  assertEqual(run.stats.highestDifficulty, 20);
});

test('run: reaching 0 Uptime on the same step the run would be won is a loss', async () => {
  const run = await quietRun({ levelSeconds: 0.5 });
  steps(run, 599);
  assertEqual(run.phase, 'playing');
  run.engineer.uptime = 0.001;
  run.engineer.invulnerableUntil = 0;
  place(run, 'dropped-packet', 0, 0).health = 1e6;
  step(run);
  assertEqual(run.phase, 'ended');
  assertEqual(run.outcome, 'loss');
});

test('run: full-length run is 20 × 60 s = 72,000 steps', async () => {
  const run = await quietRun({}, (d) => { d.player.maxUptime = 1e9; });
  stepUntil(run, (r) => r.phase === 'ended', 72001);
  assertEqual(run.outcome, 'win');
  assertEqual(run.tick, 72000);
  assertEqual(run.elapsed, 1200);
});

test('run: levelSeconds override shortens every level', async () => {
  const run = await quietRun({ levelSeconds: 2 });
  steps(run, 120);
  assertEqual(run.difficultyLevel, 2);
  assertEqual(run.runLength, 40);
});
