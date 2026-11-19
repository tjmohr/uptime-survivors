import { test, assertEqual, loadGameData } from './harness.js';
import { levelAt, runLength, debutsAt, levelEnd } from '../engine/difficulty.js';

test('difficulty: levelAt boundaries with 60-second levels', async () => {
  const d = await loadGameData();
  assertEqual(levelAt(d, 0), 1);
  assertEqual(levelAt(d, 59.99), 1);
  assertEqual(levelAt(d, 60), 2);
  assertEqual(levelAt(d, 1199), 20);
  assertEqual(levelAt(d, 5000), 20, 'clamps at 20');
});

test('difficulty: full run lasts 20 × 60 s = 1,200 s', async () => {
  assertEqual(runLength(await loadGameData()), 1200);
});

test('difficulty: levelSeconds override shortens the run', async () => {
  const d = await loadGameData();
  assertEqual(runLength(d, 2), 40);
  assertEqual(levelAt(d, 38, 2), 20);
  assertEqual(levelAt(d, 3.9, 2), 2);
  assertEqual(levelEnd(d, 1, 2), 2);
});

test('difficulty: debuts match each enemy debutLevel', async () => {
  const d = await loadGameData();
  for (let level = 1; level <= 20; level++) {
    const expected = d.enemies.filter((e) => e.debutLevel === level).map((e) => e.id);
    assertEqual(debutsAt(d, level), expected, `level ${level}`);
  }
});

test('difficulty: the first enemy debuts at level 1', async () => {
  const d = await loadGameData();
  assertEqual(debutsAt(d, 1), ['dropped-packet']);
});

test('difficulty: full roster debuts at levels 1, 4, 8, 12, 16 (FR-018)', async () => {
  const d = await loadGameData();
  const debuts = {};
  for (let level = 1; level <= 20; level++) for (const id of debutsAt(d, level)) debuts[id] = level;
  assertEqual(debuts, { 'dropped-packet': 1, 'latency-spike': 4, 'broadcast-storm': 8, 'route-flap': 12, 'ddos-botnet': 16 });
});

test('difficulty: level 20 contains all five enemies at the highest multipliers (FR-019)', async () => {
  const d = await loadGameData();
  const last = d.difficulty[19];
  assertEqual(Object.keys(last.mix).sort(), d.enemies.map((e) => e.id).sort());
  for (const k of ['spawnPerSecond', 'healthMultiplier', 'damageMultiplier', 'speedMultiplier']) {
    assertEqual(Math.max(...d.difficulty.map((r) => r[k])), last[k], k);
  }
});
