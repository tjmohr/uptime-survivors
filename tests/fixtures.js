// Shared helpers for engine tests.
import { loadGameData } from './harness.js';
import { createRun, step } from '../engine/run.js';
import { spawnEnemy } from '../engine/spawner.js';
import { rowFor } from '../engine/difficulty.js';

// A run where enemies only appear when a test places them.
export async function quietRun(opts = {}, edit = () => {}) {
  const data = await loadGameData();
  for (const row of data.difficulty) row.spawnPerSecond = 1e-9;
  edit(data);
  return createRun(data, { seed: 1, ...opts });
}

export function place(run, typeId, x, y, level = run.difficultyLevel) {
  return spawnEnemy(run, typeId, x, y, rowFor(run.data, level));
}

export function steps(run, n, input = { dx: 0, dy: 0 }) {
  for (let i = 0; i < n; i++) step(run, input);
}

// Steps until predicate(run) is true or `max` steps pass; returns steps taken.
export function stepUntil(run, predicate, max = 3600, input = { dx: 0, dy: 0 }) {
  for (let i = 0; i < max; i++) {
    if (predicate(run)) return i;
    step(run, input);
  }
  throw new Error(`condition not reached within ${max} steps`);
}
