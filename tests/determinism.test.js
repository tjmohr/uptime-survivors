import { test, assert, assertEqual, loadGameData, readSource } from './harness.js';
import { createRun, step, chooseUpgrade, pause, resume } from '../engine/run.js';
import { createRng } from '../engine/rng.js';
import { hashRun } from '../engine/hash.js';

// A recorded input sequence: 3,600 steps (one minute) of scripted movement.
function recordedInputs(n) {
  const r = createRng(2024);
  const inputs = [];
  let current = { dx: 0, dy: 0 };
  for (let i = 0; i < n; i++) {
    if (i % 45 === 0) current = { dx: r.int(3) - 1, dy: r.int(3) - 1 };
    inputs.push(current);
  }
  return inputs;
}

function play(data, seed, inputs) {
  const run = createRun(data, { seed });
  for (const input of inputs) {
    if (run.phase === 'levelup') chooseUpgrade(run, run.tick % run.offer.length);
    step(run, input);
    run.events.length = 0;
  }
  return run;
}

test('determinism: same seed + same inputs → identical state hash', async () => {
  const data = await loadGameData();
  const inputs = recordedInputs(3600);
  const a = play(data, 777, inputs);
  const b = play(data, 777, inputs);
  assertEqual(hashRun(a), hashRun(b));
  assert(a.stats.enemiesDefeated > 0, 'the run should actually have done something');
});

test('determinism: a different seed gives a different run', async () => {
  const data = await loadGameData();
  const inputs = recordedInputs(1200);
  assert(hashRun(play(data, 1, inputs)) !== hashRun(play(data, 2, inputs)));
});

test('determinism: stepping while paused or choosing an upgrade leaves the hash unchanged', async () => {
  const data = await loadGameData();
  const run = createRun(data, { seed: 31 });
  for (let i = 0; i < 600; i++) step(run, { dx: 1, dy: 0 });
  if (run.phase === 'levelup') chooseUpgrade(run, 0);
  pause(run);
  const paused = hashRun(run);
  for (let i = 0; i < 100; i++) step(run, { dx: 1, dy: 1 });
  assertEqual(hashRun(run), paused);
  resume(run);
  assertEqual(run.phase, 'playing');
  run.phase = 'levelup';
  const choosing = hashRun(run);
  for (let i = 0; i < 100; i++) step(run, { dx: -1, dy: 0 });
  assertEqual(hashRun(run), choosing);
});

test('determinism: pause and resume only act in the right phases', async () => {
  const run = createRun(await loadGameData(), { seed: 3 });
  run.phase = 'ended';
  pause(run);
  assertEqual(run.phase, 'ended');
  run.phase = 'levelup';
  resume(run);
  assertEqual(run.phase, 'levelup');
});

const ENGINE_FILES = ['rng', 'content', 'run', 'difficulty', 'spawner', 'behaviors', 'weapons', 'combat',
  'progression', 'grid', 'hash'];

test('determinism: engine source uses no Math.random, DOM, or network APIs', async () => {
  const banned = /Math\.random|\bdocument\b|\bwindow\b|\bfetch\b/;
  for (const name of ENGINE_FILES) {
    const src = await readSource(`engine/${name}.js`);
    const m = src.match(banned);
    assert(!m, `engine/${name}.js contains '${m && m[0]}'`);
  }
});
