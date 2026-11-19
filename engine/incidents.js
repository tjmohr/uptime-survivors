// Major Incidents (feature 004): arrival, entry dash, signature behaviours, resolution, records.
// specs/004-major-incidents/contracts/engine-api.md, data-model.md. Pure and deterministic: all
// randomness comes from run.rng.

import { SPAWN_DISTANCE, spawnEnemy } from './spawner.js';
import { ENGINEER_RADIUS } from './behaviors.js';
import { rowFor } from './difficulty.js';
import { addPickup } from './combat.js';

const LEASH_DISTANCE = SPAWN_DISTANCE * 1.5;
const EPS = 1e-9;

export function createIncidentRecords(data) {
  return (data.incidents ?? []).map((i) => ({ id: i.id, state: 'not-reached', arrivedAt: null, resolvedAt: null }));
}

export const isIncident = (enemy) => enemy.incidentId !== undefined;

export function activeIncidentCount(run) {
  let n = 0;
  for (const e of run.enemies) if (e.incidentId !== undefined && !e.dead) n++;
  return n;
}

function initialTimer(b) {
  if (b.kind === 'leak' || b.kind === 'infect') return b.intervalSeconds;
  return b.cooldownSeconds / 2; // link-down: first warning half a cycle after arrival
}

// Called once for each new difficulty level (run.js), right after its difficulty-up event.
export function arriveIncidents(run, level) {
  const e = run.engineer;
  for (const def of run.data.incidents ?? []) {
    if (def.arrivalLevel !== level) continue;
    const record = run.incidents.find((r) => r.id === def.id);
    if (!record || record.state !== 'not-reached') continue;
    const angle = run.rng.next() * Math.PI * 2;
    const inc = {
      id: run.nextEntityId++,
      typeId: def.id,
      incidentId: def.id,
      x: e.x + Math.cos(angle) * SPAWN_DISTANCE,
      y: e.y + Math.sin(angle) * SPAWN_DISTANCE,
      radius: def.radius,
      health: def.health,
      maxHealth: def.health,
      speed: def.speed,
      damagePerSecond: def.contactDamagePerSecond,
      telemetry: 0,
      generation: 0,
      blinkTimer: 0,
      orbitReadyAt: 0,
      dead: false,
      phase: 'entering',
      timer: initialTimer(def.behavior),
      linkState: 'idle',
      pendingTool: null,
    };
    run.enemies.push(inc);
    record.state = 'active';
    record.arrivedAt = run.elapsed;
    run.events.push({ type: 'incident-arrived', incidentId: def.id, x: inc.x, y: inc.y });
  }
}

function moveIncident(run, inc, def, dt) {
  const eng = run.engineer;
  let dx = eng.x - inc.x;
  let dy = eng.y - inc.y;
  let d = Math.hypot(dx, dy);
  if (d > LEASH_DISTANCE) {
    // Left far behind: re-enter from the edge, like other enemies (feature 001 leash).
    const angle = run.rng.next() * Math.PI * 2;
    inc.x = eng.x + Math.cos(angle) * SPAWN_DISTANCE;
    inc.y = eng.y + Math.sin(angle) * SPAWN_DISTANCE;
    inc.phase = 'entering';
    dx = eng.x - inc.x;
    dy = eng.y - inc.y;
    d = Math.hypot(dx, dy);
  }
  if (inc.phase === 'entering' && d <= def.entryDistance) inc.phase = 'active';
  const speed = inc.phase === 'entering' ? def.entrySpeed : def.speed;
  const stopAt = inc.radius + ENGINEER_RADIUS - 2;
  if (d > stopAt) {
    const stepLen = Math.min(speed * dt, d - stopAt);
    inc.x += (dx / d) * stepLen;
    inc.y += (dy / d) * stepLen;
  }
  if (inc.phase === 'entering' && Math.hypot(eng.x - inc.x, eng.y - inc.y) <= def.entryDistance) inc.phase = 'active';
}

function leak(run, inc, b, dt) {
  inc.timer -= dt;
  if (inc.timer > EPS) return;
  inc.timer += b.intervalSeconds;
  let alive = 0;
  let ordinary = 0;
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (e.incidentId === undefined) ordinary++;
    if (e.leakedBy === inc.id) alive++;
  }
  const n = Math.min(b.burst, b.maxAlive - alive, run.data.caps.enemies - ordinary);
  if (n <= 0) return;
  const row = rowFor(run.data, run.difficultyLevel);
  const start = run.rng.next() * Math.PI * 2;
  const ring = inc.radius + 20;
  for (let k = 0; k < n; k++) {
    const a = start + (k * Math.PI * 2) / n;
    const m = spawnEnemy(run, b.minionType, inc.x + Math.cos(a) * ring, inc.y + Math.sin(a) * ring, row);
    m.leakedBy = inc.id;
  }
  run.events.push({ type: 'leak', incidentId: inc.incidentId, count: n });
}

const onlineTools = (run) => run.engineer.tools.filter((t) => !(t.offlineUntil > run.elapsed));

function linkDown(run, inc, b, dt) {
  inc.timer -= dt;
  if (inc.timer > EPS) return;
  if (inc.linkState === 'idle') {
    const online = onlineTools(run);
    if (online.length < 2) {
      inc.timer += 1; // never take the last working tool; look again in a second
      return;
    }
    const tool = online[run.rng.int(online.length)];
    inc.pendingTool = tool.id;
    inc.linkState = 'warning';
    inc.timer += b.warningSeconds;
    run.events.push({ type: 'link-warning', incidentId: inc.incidentId, toolId: tool.id, inSeconds: b.warningSeconds });
    return;
  }
  // Warning over: take the named tool down if that still leaves another tool working.
  const online = onlineTools(run);
  const tool = online.find((t) => t.id === inc.pendingTool);
  if (tool && online.length >= 2) {
    tool.offlineUntil = run.elapsed + b.offlineSeconds;
    run.events.push({ type: 'link-down', incidentId: inc.incidentId, toolId: tool.id, seconds: b.offlineSeconds });
  }
  inc.linkState = 'idle';
  inc.pendingTool = null;
  inc.timer += b.cooldownSeconds - b.warningSeconds; // warnings are cooldownSeconds apart
}

function infect(run, inc, b, dt) {
  inc.timer -= dt;
  if (inc.timer > EPS) return;
  inc.timer += b.intervalSeconds;
  let count = 0;
  for (const e of run.enemies) {
    if (e.dead || e.incidentId !== undefined || e.infected) continue;
    const r = b.radius + e.radius;
    if ((e.x - inc.x) ** 2 + (e.y - inc.y) ** 2 > r * r) continue;
    e.infected = true;
    e.baseSpeed = e.speed;
    e.baseMaxHealth = e.maxHealth;
    e.maxHealth *= b.healthMultiplier;
    e.health *= b.healthMultiplier;
    e.speed *= b.speedMultiplier;
    count++;
  }
  if (count) run.events.push({ type: 'infected', count });
}

const BEHAVIORS = { leak, 'link-down': linkDown, infect };

// Runs every step after spawning, before ordinary movement (run.js).
export function updateIncidents(run, dt) {
  // Tools whose outage has ended come back online.
  for (const t of run.engineer.tools) {
    if (t.offlineUntil > 0 && run.elapsed >= t.offlineUntil - EPS) {
      t.offlineUntil = 0;
      run.events.push({ type: 'link-restored', toolId: t.id });
    }
  }
  for (const inc of run.enemies) {
    if (inc.incidentId === undefined || inc.dead) continue;
    const def = run.defs.incident.get(inc.incidentId);
    moveIncident(run, inc, def, dt);
    BEHAVIORS[def.behavior.kind](run, inc, def.behavior, dt);
  }
}

// Called from resolveDefeats for a defeated incident (combat.js).
export function resolveIncident(run, inc) {
  const def = run.defs.incident.get(inc.incidentId);
  const record = run.incidents.find((r) => r.id === inc.incidentId);
  if (record) {
    record.state = 'resolved';
    record.resolvedAt = run.elapsed;
  }
  run.events.push({ type: 'incident-resolved', incidentId: inc.incidentId, x: inc.x, y: inc.y });
  const stillActive = (kind) => run.enemies.some((e) => e !== inc && e.incidentId !== undefined && !e.dead
    && run.defs.incident.get(e.incidentId).behavior.kind === kind);

  if (def.behavior.kind === 'link-down' && !stillActive('link-down')) {
    for (const t of run.engineer.tools) {
      if (t.offlineUntil > 0) {
        t.offlineUntil = 0;
        run.events.push({ type: 'link-restored', toolId: t.id });
      }
    }
  }
  if (def.behavior.kind === 'infect' && !stillActive('infect')) {
    let count = 0;
    for (const e of run.enemies) {
      if (!e.infected) continue;
      e.infected = false;
      e.speed = e.baseSpeed;
      e.maxHealth = e.baseMaxHealth;
      e.health = Math.min(e.health, e.baseMaxHealth);
      count++;
    }
    run.events.push({ type: 'infection-cleared', count });
  }
  addPickup(run, inc.x, inc.y, def.rewardTelemetry, { reward: true });
}
