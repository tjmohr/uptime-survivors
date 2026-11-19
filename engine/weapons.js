// Tool behaviors (FR-007, FR-022): projectile-nearest (Ping), orbit (Firewall Rule),
// pulse (Ansible Playbook), spread (Load Balancer); feature 006 adds chain (Traceroute), aura
// (Rate Limiter), and zone (Null Route). Projectile flight, hits, and zones live here too.
// Every tool fires with effectiveToolStats (engine/stats.js), the numbers the screens show.

import { bonusTotals, effectiveToolStats } from './stats.js';

export const PROJECTILE_RADIUS = 4;
export const BARRIER_RADIUS = 10;
export const MAX_ZONES = 8;
const MAX_ENEMY_RADIUS = 80; // covers Major Incidents (feature 004); hits are still checked exactly
const found = [];

export function damageEnemy(run, enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  run.events.push({ type: 'hit', x: enemy.x, y: enemy.y, amount });
  if (enemy.health <= 0) enemy.dead = true;
}

function nearestEnemy(run, range) {
  const e = run.engineer;
  let best = null;
  let bestD2 = range * range;
  for (const enemy of run.enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - e.x;
    const dy = enemy.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = enemy;
    }
  }
  return best;
}


function fireProjectile(run, toolId, angle, stats, pierce) {
  if (run.projectiles.length >= run.data.caps.projectiles) return;
  const e = run.engineer;
  run.projectiles.push({
    toolId,
    x: e.x,
    y: e.y,
    vx: Math.cos(angle) * stats.projectileSpeed,
    vy: Math.sin(angle) * stats.projectileSpeed,
    speed: stats.projectileSpeed,
    damage: stats.damage,
    pierceLeft: pierce,
    distanceLeft: stats.range,
    hitIds: [],
  });
}

export function orbitPositions(run, stats) {
  const e = run.engineer;
  const base = run.elapsed * stats.rotationSpeed;
  const out = [];
  for (let i = 0; i < stats.barriers; i++) {
    const a = base + (i * Math.PI * 2) / stats.barriers;
    out.push({ x: e.x + Math.cos(a) * stats.orbitRadius, y: e.y + Math.sin(a) * stats.orbitRadius, angle: a });
  }
  return out;
}

function enemiesNear(run, x, y, r) {
  found.length = 0;
  run.grid.queryCircle(x, y, r + MAX_ENEMY_RADIUS, found);
  return found;
}

// Problems whose centre-to-edge distance from (x, y) is within r, in run.enemies order.
function enemiesInside(run, x, y, r) {
  const out = [];
  for (const enemy of enemiesNear(run, x, y, r)) {
    if (enemy.dead) continue;
    const rr = r + enemy.radius;
    if ((enemy.x - x) ** 2 + (enemy.y - y) ** 2 <= rr * rr) out.push(enemy);
  }
  return out;
}

// Traceroute: nearest problem in range, then hop to the nearest not-yet-hit problem within hopRange.
function fireChain(run, tool, stats) {
  const e = run.engineer;
  let current = nearestEnemy(run, stats.range);
  if (!current) return false;
  const points = [{ x: e.x, y: e.y }];
  const hit = new Set();
  for (let n = 0; current && n <= stats.hops; n++) {
    damageEnemy(run, current, stats.damage);
    hit.add(current.id);
    points.push({ x: current.x, y: current.y });
    let next = null;
    let bestD2 = stats.hopRange * stats.hopRange;
    for (const cand of enemiesNear(run, current.x, current.y, stats.hopRange)) {
      if (cand.dead || hit.has(cand.id)) continue;
      const d2 = (cand.x - current.x) ** 2 + (cand.y - current.y) ** 2;
      if (d2 < bestD2 || (d2 === bestD2 && next && cand.id < next.id)) { bestD2 = d2; next = cand; }
    }
    current = next;
  }
  run.events.push({ type: 'chain', toolId: tool.id, points });
  run.events.push({ type: 'fire', toolId: tool.id });
  return true;
}

// Null Route: the problem in range with the most other problems within radius (ties → lowest id).
function placeZone(run, tool, stats) {
  const e = run.engineer;
  let best = null;
  let bestCount = -1;
  const r2 = stats.range * stats.range;
  for (const cand of run.enemies) {
    if (cand.dead || (cand.x - e.x) ** 2 + (cand.y - e.y) ** 2 > r2) continue;
    const count = enemiesInside(run, cand.x, cand.y, stats.radius).length;
    if (count > bestCount || (count === bestCount && cand.id < best.id)) { bestCount = count; best = cand; }
  }
  if (!best) return false;
  if (run.zones.length < MAX_ZONES) {
    run.zones.push({
      x: best.x, y: best.y, radius: stats.radius, damage: stats.damage, tickInterval: stats.tickInterval,
      expiresAt: run.elapsed + stats.duration, nextTickAt: run.elapsed,
    });
    run.events.push({ type: 'zone-placed', x: best.x, y: best.y, radius: stats.radius, duration: stats.duration });
  }
  return true;
}

function updateZones(run) {
  if (!run.zones || run.zones.length === 0) return;
  const kept = [];
  for (const z of run.zones) {
    while (z.nextTickAt <= run.elapsed + 1e-9 && z.nextTickAt < z.expiresAt - 1e-9) {
      for (const enemy of enemiesInside(run, z.x, z.y, z.radius)) damageEnemy(run, enemy, z.damage);
      z.nextTickAt += z.tickInterval;
    }
    if (run.elapsed < z.expiresAt - 1e-9) kept.push(z);
  }
  run.zones = kept;
}

const isOnline = (run, tool) => !(tool.offlineUntil > run.elapsed);

// Rate Limiter's field for this step (null when not owned or offline). Called before enemies move.
export function updateSlowField(run) {
  run.slowField = null;
  for (const tool of run.engineer.tools) {
    if (!isOnline(run, tool)) continue;
    const def = run.defs.tool.get(tool.id);
    if (def.kind !== 'aura') continue;
    const stats = def.ranks[tool.rank - 1];
    run.slowField = { x: run.engineer.x, y: run.engineer.y, radius: stats.radius, factor: 1 - stats.slowPercent / 100 };
  }
}

function updateTool(run, tool, dt, bonus) {
  const def = run.defs.tool.get(tool.id);
  const stats = effectiveToolStats(run, tool.id, tool.rank, bonus);
  const e = run.engineer;

  if (def.kind === 'aura') {
    if (tool.tickLeft === undefined) tool.tickLeft = stats.tickInterval;
    tool.tickLeft -= dt;
    if (tool.tickLeft > 1e-9) return;
    tool.tickLeft += stats.tickInterval;
    for (const enemy of enemiesInside(run, e.x, e.y, stats.radius)) damageEnemy(run, enemy, stats.damage);
    return;
  }

  if (def.kind === 'orbit') {
    for (const b of orbitPositions(run, stats)) {
      for (const enemy of enemiesNear(run, b.x, b.y, BARRIER_RADIUS)) {
        if (enemy.dead || enemy.orbitReadyAt > run.elapsed) continue;
        const r = enemy.radius + BARRIER_RADIUS;
        if ((enemy.x - b.x) ** 2 + (enemy.y - b.y) ** 2 > r * r) continue;
        damageEnemy(run, enemy, stats.damage);
        enemy.orbitReadyAt = run.elapsed + stats.hitCooldown;
      }
    }
    return;
  }

  tool.cooldownLeft -= dt;
  if (tool.cooldownLeft > 0) return;

  if (def.kind === 'chain' || def.kind === 'zone') {
    const fired = def.kind === 'chain' ? fireChain(run, tool, stats) : placeZone(run, tool, stats);
    if (!fired) {
      tool.cooldownLeft = 0; // stay ready until something is in range
      return;
    }
    tool.cooldownLeft += stats.cooldown;
    return;
  }

  if (def.kind === 'projectile-nearest') {
    const target = nearestEnemy(run, stats.range);
    if (!target) {
      tool.cooldownLeft = 0; // stay ready until something is in range
      return;
    }
    fireProjectile(run, tool.id, Math.atan2(target.y - e.y, target.x - e.x), stats, stats.pierce);
    run.events.push({ type: 'fire', toolId: tool.id });
  } else if (def.kind === 'spread') {
    const target = nearestEnemy(run, stats.range);
    const start = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing;
    for (let i = 0; i < stats.projectiles; i++) {
      fireProjectile(run, tool.id, start + (i * Math.PI * 2) / stats.projectiles, stats, 1);
    }
    run.events.push({ type: 'fire', toolId: tool.id }); // once per volley, not per projectile
  } else if (def.kind === 'pulse') {
    for (const enemy of enemiesNear(run, e.x, e.y, stats.radius)) {
      if (enemy.dead) continue;
      const r = stats.radius + enemy.radius;
      if ((enemy.x - e.x) ** 2 + (enemy.y - e.y) ** 2 <= r * r) damageEnemy(run, enemy, stats.damage);
    }
    run.events.push({ type: 'pulse', x: e.x, y: e.y, radius: stats.radius });
  }
  tool.cooldownLeft += stats.cooldown;
}

function updateProjectiles(run, dt) {
  const kept = [];
  for (const p of run.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.distanceLeft -= p.speed * dt;
    for (const enemy of enemiesNear(run, p.x, p.y, PROJECTILE_RADIUS)) {
      if (p.pierceLeft <= 0) break;
      if (enemy.dead || p.hitIds.includes(enemy.id)) continue;
      const r = enemy.radius + PROJECTILE_RADIUS;
      if ((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2 > r * r) continue;
      damageEnemy(run, enemy, p.damage);
      p.hitIds.push(enemy.id);
      p.pierceLeft -= 1;
    }
    if (p.pierceLeft > 0 && p.distanceLeft > 0) kept.push(p);
  }
  run.projectiles = kept;
}

export function updateWeapons(run, dt) {
  const bonus = bonusTotals(run);
  for (const tool of run.engineer.tools) {
    if (tool.offlineUntil > run.elapsed) continue; // taken offline by Core Switch Failure (feature 004)
    updateTool(run, tool, dt, bonus);
  }
  updateProjectiles(run, dt);
  updateZones(run);
}
