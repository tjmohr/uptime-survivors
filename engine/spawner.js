// Enemy spawning by difficulty level (FR-017, FR-020, FR-026).

import { rowFor } from './difficulty.js';

// Enemies appear this far from the engineer — outside the visible area (ui/render.js sizes the view to fit).
export const SPAWN_DISTANCE = 720;

function pickWeighted(rng, mix) {
  const entries = Object.entries(mix);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng.next() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

export function spawnEnemy(run, typeId, x, y, row, { scale = 1, generation = 0 } = {}) {
  const def = run.defs.enemy.get(typeId);
  const health = def.health * row.healthMultiplier * scale;
  const enemy = {
    id: run.nextEntityId++,
    typeId,
    x,
    y,
    radius: def.radius * (generation > 0 ? Math.sqrt(scale) * 1.15 : 1),
    health,
    maxHealth: health,
    speed: def.speed * row.speedMultiplier,
    damagePerSecond: def.contactDamagePerSecond * row.damageMultiplier,
    telemetry: generation > 0 ? Math.max(1, Math.round(def.telemetry * scale)) : def.telemetry,
    generation,
    blinkTimer: def.behavior.kind === 'blink' ? def.behavior.intervalSeconds : 0,
    orbitReadyAt: 0,
    dead: false,
  };
  run.enemies.push(enemy);
  return enemy;
}

export function updateSpawner(run, dt) {
  const row = rowFor(run.data, run.difficultyLevel);
  const e = run.engineer;
  run.spawnAccumulator += row.spawnPerSecond * dt;
  while (run.spawnAccumulator >= 1) {
    run.spawnAccumulator -= 1;
    if (run.enemies.length >= run.data.caps.enemies) continue; // over the cap: skip, never queue
    const typeId = pickWeighted(run.rng, row.mix);
    const angle = run.rng.next() * Math.PI * 2;
    spawnEnemy(run, typeId, e.x + Math.cos(angle) * SPAWN_DISTANCE, e.y + Math.sin(angle) * SPAWN_DISTANCE, row);
  }
}
