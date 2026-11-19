// Run lifecycle and the fixed-step simulation (contracts/engine-api.md, data-model.md › State transitions).

import { createRng } from './rng.js';
import { createGrid } from './grid.js';
import { levelAt, runLength, debutsAt } from './difficulty.js';
import { telemetryToNext, applyDerivedStats, buildOffer, applyUpgrade } from './progression.js';
import { updateSpawner } from './spawner.js';
import { updateBehaviors } from './behaviors.js';
import { updateWeapons } from './weapons.js';
import { moveEngineer, resolveDefeats, applyContactDamage, applyRegen, updatePickups } from './combat.js';
import { createIncidentRecords, arriveIncidents, updateIncidents } from './incidents.js';

export const STEPS_PER_SECOND = 60;
export const STEP_SECONDS = 1 / STEPS_PER_SECOND;

export function createRun(data, { seed = 1, levelSeconds = null } = {}) {
  const p = data.player;
  const run = {
    data,
    defs: {
      enemy: new Map(data.enemies.map((x) => [x.id, x])),
      tool: new Map(data.tools.map((x) => [x.id, x])),
      passive: new Map(data.passives.map((x) => [x.id, x])),
      incident: new Map((data.incidents ?? []).map((x) => [x.id, x])),
    },
    incidents: createIncidentRecords(data),
    grid: createGrid(64),
    seed: seed >>> 0,
    rng: createRng(seed),
    phase: 'playing',
    tick: 0,
    elapsed: 0,
    difficultyLevel: 1,
    outcome: null,
    stats: { enemiesDefeated: 0, timeSurvived: 0, highestDifficulty: 1 },
    pendingLevelUps: 0,
    offer: null,
    testOverrides: { levelSeconds },
    runLength: runLength(data, levelSeconds ?? undefined),
    spawnAccumulator: 0,
    nextEntityId: 1,
    engineer: {
      x: 0,
      y: 0,
      facing: 0,
      uptime: p.maxUptime,
      maxUptime: p.maxUptime,
      moveSpeed: p.moveSpeed,
      pickupRadius: p.pickupRadius,
      regenPerSecond: 0,
      invulnerableUntil: 0,
      level: 1,
      telemetry: 0,
      telemetryToNext: telemetryToNext(data, 1),
      tools: [{ id: p.startingTool, rank: 1, cooldownLeft: 0 }],
      passives: [],
    },
    enemies: [],
    encountered: [], // enemy types and incidents met this run, in order (feature 005)
    projectiles: [],
    pickups: [],
    events: [],
  };
  applyDerivedStats(run);
  run.events.push({ type: 'difficulty-up', level: 1, debuts: debutsAt(data, 1) });
  return run;
}

function endRun(run, outcome) {
  run.phase = 'ended';
  run.outcome = outcome;
  run.events.push({ type: 'run-ended', outcome });
}

export function step(run, input = { dx: 0, dy: 0 }) {
  if (run.phase !== 'playing') return;
  const dt = STEP_SECONDS;
  run.tick += 1;
  run.elapsed = run.tick / STEPS_PER_SECOND;

  moveEngineer(run, input, dt);

  const level = levelAt(run.data, run.elapsed, run.testOverrides.levelSeconds ?? undefined);
  while (run.difficultyLevel < level) {
    run.difficultyLevel += 1;
    run.events.push({ type: 'difficulty-up', level: run.difficultyLevel, debuts: debutsAt(run.data, run.difficultyLevel) });
    arriveIncidents(run, run.difficultyLevel); // Major Incidents arrive on the step their level begins
  }
  run.stats.highestDifficulty = run.difficultyLevel;

  updateSpawner(run, dt);
  updateIncidents(run, dt);
  updateBehaviors(run, dt); // also rebuilds the collision grid
  updateWeapons(run, dt);
  resolveDefeats(run);
  run.grid.clear();
  for (const enemy of run.enemies) run.grid.insert(enemy);
  applyContactDamage(run, dt);
  applyRegen(run, dt);
  updatePickups(run, dt);
  run.stats.timeSurvived = run.elapsed;

  // Damage is applied before the win check: reaching 0 on the final step is a loss.
  if (run.engineer.uptime <= 0) return endRun(run, 'loss');
  if (run.elapsed >= run.runLength - 1e-9) return endRun(run, 'win');

  if (run.pendingLevelUps > 0) {
    run.phase = 'levelup';
    run.offer = buildOffer(run);
  }
}

export function chooseUpgrade(run, index) {
  if (run.phase !== 'levelup' || !run.offer) return { ok: false, reason: 'not choosing an upgrade' };
  if (!Number.isInteger(index) || index < 0 || index >= run.offer.length) return { ok: false, reason: 'no such choice' };
  applyUpgrade(run, run.offer[index]);
  run.pendingLevelUps -= 1;
  if (run.pendingLevelUps > 0) {
    run.offer = buildOffer(run);
  } else {
    run.offer = null;
    run.phase = 'playing';
  }
  return { ok: true };
}

export function pause(run) {
  if (run.phase === 'playing') run.phase = 'paused';
}

export function resume(run) {
  if (run.phase === 'paused') run.phase = 'playing';
}
