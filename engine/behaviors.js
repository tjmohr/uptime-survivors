// Enemy movement behaviors: chase (all), blink (Route Flap). Split happens on defeat (combat.js).

import { SPAWN_DISTANCE } from './spawner.js';

export const ENGINEER_RADIUS = 12;
// Enemies left this far behind are moved back near the engineer, as is usual for the genre.
const LEASH_DISTANCE = SPAWN_DISTANCE * 1.5;
const MAX_ENEMY_RADIUS = 80; // covers Major Incidents (feature 004); hits are still checked exactly
const neighbours = [];

export function updateBehaviors(run, dt) {
  const eng = run.engineer;
  for (const enemy of run.enemies) {
    if (enemy.incidentId !== undefined) continue; // moved by engine/incidents.js
    const def = run.defs.enemy.get(enemy.typeId);
    let dx = eng.x - enemy.x;
    let dy = eng.y - enemy.y;
    let d = Math.hypot(dx, dy);

    if (d > LEASH_DISTANCE) {
      const angle = run.rng.next() * Math.PI * 2;
      enemy.x = eng.x + Math.cos(angle) * SPAWN_DISTANCE;
      enemy.y = eng.y + Math.sin(angle) * SPAWN_DISTANCE;
      continue;
    }

    if (def.behavior.kind === 'blink') {
      enemy.blinkTimer -= dt;
      if (enemy.blinkTimer <= 1e-9) { // tolerance for accumulated 1/60 s steps
        enemy.blinkTimer += def.behavior.intervalSeconds;
        const jump = Math.min(def.behavior.distance, Math.max(0, d - (enemy.radius + ENGINEER_RADIUS)));
        if (d > 0) {
          enemy.x += (dx / d) * jump;
          enemy.y += (dy / d) * jump;
          run.events.push({ type: 'blink', x: enemy.x, y: enemy.y });
        }
        dx = eng.x - enemy.x;
        dy = eng.y - enemy.y;
        d = Math.hypot(dx, dy);
      }
    }

    // Chase: move straight toward the engineer, stopping at contact.
    const stopAt = enemy.radius + ENGINEER_RADIUS - 2;
    if (d > stopAt) {
      // Rate Limiter (feature 006): ordinary enemies inside its field move slower this step.
      const f = run.slowField;
      const slow = f && (enemy.x - f.x) ** 2 + (enemy.y - f.y) ** 2 <= (f.radius + enemy.radius) ** 2 ? f.factor : 1;
      const stepLen = Math.min(enemy.speed * slow * dt, d - stopAt);
      enemy.x += (dx / d) * stepLen;
      enemy.y += (dy / d) * stepLen;
    }
  }

  // Light separation so hordes spread out instead of stacking on one point.
  run.grid.clear();
  for (const enemy of run.enemies) run.grid.insert(enemy);
  for (const a of run.enemies) {
    neighbours.length = 0;
    run.grid.queryCircle(a.x, a.y, a.radius + MAX_ENEMY_RADIUS, neighbours);
    for (const b of neighbours) {
      if (b.id <= a.id) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((min - d) / d) * 0.25;
      // Ordinary enemies make way for a Major Incident; it is not pushed around by them.
      const pa = a.incidentId !== undefined ? 0 : b.incidentId !== undefined ? 2 : 1;
      const pb = b.incidentId !== undefined ? 0 : a.incidentId !== undefined ? 2 : 1;
      a.x -= dx * push * pa;
      a.y -= dy * push * pa;
      b.x += dx * push * pb;
      b.y += dy * push * pb;
    }
  }
}
