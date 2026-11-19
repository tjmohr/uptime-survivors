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

test('determinism: pure audio modules use no browser APIs, timers, or Math.random', async () => {
  const banned = /Math\.random|\bdocument\b|\bwindow\b|\bfetch\b|AudioContext|setTimeout|setInterval|performance\.now|Date\.now/;
  for (const file of ['audio/content.js', 'audio/director.js']) {
    const src = await readSource(file);
    const m = src.match(banned);
    assert(!m, `${file} contains '${m && m[0]}'`);
  }
});

test('determinism: fire and pickup events are reported (A5)', async () => {
  const run = createRun(await loadGameData(), { seed: 7 });
  const seen = { fire: [], pickup: [] };
  const inputs = recordedInputs(3600);
  for (let i = 0; i < inputs.length && run.phase !== 'ended'; i++) {
    if (run.phase === 'levelup') chooseUpgrade(run, 0);
    const before = run.projectiles.length;
    step(run, inputs[i]);
    const fires = run.events.filter((e) => e.type === 'fire');
    for (const e of run.events) if (e.type in seen) seen[e.type].push(e);
    // One fire event per volley, never per projectile.
    assert(fires.length <= run.engineer.tools.length, `${fires.length} fire events in one step`);
    if (fires.length) assert(run.projectiles.length > before || run.projectiles.length > 0);
    run.events.length = 0;
  }
  assert(seen.fire.length > 0, 'no fire events');
  assert(seen.pickup.length > 0, 'no pickup events');
  const toolIds = new Set(run.data.tools.filter((t) => t.kind === 'projectile-nearest' || t.kind === 'spread').map((t) => t.id));
  assert(seen.fire.every((e) => toolIds.has(e.toolId)), 'fire from a non-projectile tool');
  assert(seen.pickup.every((e) => typeof e.value === 'number' && e.value > 0));
});

test('determinism: a director reading events never changes the run (A5, FR-017)', async () => {
  const { createDirector } = await import('../audio/director.js');
  const audio = JSON.parse(await readSource('data/audio.json'));
  const data = await loadGameData();
  const inputs = recordedInputs(1800);
  const plain = play(data, 99, inputs);
  const run = createRun(await loadGameData(), { seed: 99 });
  const director = createDirector(audio);
  let now = 0;
  for (const input of inputs) {
    if (run.phase === 'levelup') chooseUpgrade(run, run.tick % run.offer.length);
    step(run, input);
    director.consume(run.events, (now += 1000 / 60));
    run.events.length = 0;
  }
  assertEqual(hashRun(run), hashRun(plain));
  assert(Object.values(director.counts).some((n) => n > 0), 'director heard nothing');
});
