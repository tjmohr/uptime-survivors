// Tool behaviors (FR-007, FR-022): projectile-nearest (Ping), orbit (Firewall Rule),
// pulse (Ansible Playbook), spread (Load Balancer). Projectile flight and hits live here too.

export const PROJECTILE_RADIUS = 4;
export const BARRIER_RADIUS = 10;
const MAX_ENEMY_RADIUS = 40;
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

function updateTool(run, tool, dt) {
  const def = run.defs.tool.get(tool.id);
  const stats = def.ranks[tool.rank - 1];
  const e = run.engineer;

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

  if (def.kind === 'projectile-nearest') {
    const target = nearestEnemy(run, stats.range);
    if (!target) {
      tool.cooldownLeft = 0; // stay ready until something is in range
      return;
    }
    fireProjectile(run, tool.id, Math.atan2(target.y - e.y, target.x - e.x), stats, stats.pierce);
  } else if (def.kind === 'spread') {
    const target = nearestEnemy(run, stats.range);
    const start = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing;
    for (let i = 0; i < stats.projectiles; i++) {
      fireProjectile(run, tool.id, start + (i * Math.PI * 2) / stats.projectiles, stats, 1);
    }
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
  for (const tool of run.engineer.tools) updateTool(run, tool, dt);
  updateProjectiles(run, dt);
}
