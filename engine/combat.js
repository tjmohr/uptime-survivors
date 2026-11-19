// Movement, contact damage, defeats, pickups, and regeneration (FR-005, FR-008–FR-011, FR-020).

import { ENGINEER_RADIUS } from './behaviors.js';
import { spawnEnemy } from './spawner.js';
import { rowFor } from './difficulty.js';
import { addTelemetry } from './progression.js';

const PICKUP_SPEED = 420;
const PICKUP_COLLECT_DISTANCE = ENGINEER_RADIUS + 4;
const MAX_ENEMY_RADIUS = 40;
const touching = [];

// Any finite number, clamped to [-1, 1]; anything else (NaN, Infinity, non-numbers) counts as 0.
// Keyboard input is only -1/0/1, which passes through unchanged; touch gives any angle (feature 003).
const clampAxis = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

export function moveEngineer(run, input, dt) {
  const e = run.engineer;
  const dx = clampAxis(input?.dx ?? 0);
  const dy = clampAxis(input?.dy ?? 0);
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy); // direction only: always full speed, never faster on diagonals
  e.x += (dx / len) * e.moveSpeed * dt;
  e.y += (dy / len) * e.moveSpeed * dt;
  e.facing = Math.atan2(dy, dx);
}

export function addPickup(run, x, y, value) {
  const pickups = run.pickups;
  if (pickups.length >= run.data.caps.pickups && pickups.length >= 2) {
    // Over the cap: merge the two oldest so no telemetry is lost.
    pickups[0].value += pickups[1].value;
    pickups.splice(1, 1);
  }
  pickups.push({ x, y, value, magnet: false });
}

export function resolveDefeats(run) {
  if (!run.enemies.some((n) => n.dead)) return;
  const survivors = [];
  const fallen = [];
  for (const enemy of run.enemies) (enemy.dead ? fallen : survivors).push(enemy);
  run.enemies = survivors;
  const row = rowFor(run.data, run.difficultyLevel);
  for (const enemy of fallen) {
    run.stats.enemiesDefeated += 1;
    run.events.push({ type: 'enemy-defeated', typeId: enemy.typeId, x: enemy.x, y: enemy.y });
    addPickup(run, enemy.x, enemy.y, enemy.telemetry);
    const b = run.defs.enemy.get(enemy.typeId).behavior;
    if (b.kind === 'split' && enemy.generation < b.maxGenerations) {
      for (let i = 0; i < b.count; i++) {
        if (run.enemies.length >= run.data.caps.enemies) break;
        const a = run.rng.next() * Math.PI * 2;
        const off = enemy.radius;
        spawnEnemy(run, enemy.typeId, enemy.x + Math.cos(a) * off, enemy.y + Math.sin(a) * off, row, {
          scale: b.scale ** (enemy.generation + 1),
          generation: enemy.generation + 1,
        });
      }
    }
  }
}

// While touching, the engineer loses Uptime at the strongest touching enemy's damage rate,
// applied in hits spaced by the invulnerability period (FR-008, FR-009).
export function applyContactDamage(run, dt) {
  const e = run.engineer;
  if (run.elapsed < e.invulnerableUntil) return;
  touching.length = 0;
  run.grid.queryCircle(e.x, e.y, ENGINEER_RADIUS + MAX_ENEMY_RADIUS, touching);
  let rate = 0;
  for (const enemy of touching) {
    if (enemy.dead) continue;
    const r = enemy.radius + ENGINEER_RADIUS;
    if ((enemy.x - e.x) ** 2 + (enemy.y - e.y) ** 2 <= r * r) rate = Math.max(rate, enemy.damagePerSecond);
  }
  if (rate === 0) return;
  const iframeSeconds = run.data.player.invulnerableSeconds;
  const amount = iframeSeconds > 0 ? rate * iframeSeconds : rate * dt;
  e.uptime = Math.max(0, e.uptime - amount);
  e.invulnerableUntil = run.elapsed + iframeSeconds;
  run.events.push({ type: 'player-hit', amount });
}

export function applyRegen(run, dt) {
  const e = run.engineer;
  if (e.regenPerSecond > 0 && e.uptime > 0) e.uptime = Math.min(e.maxUptime, e.uptime + e.regenPerSecond * dt);
}

export function updatePickups(run, dt) {
  const e = run.engineer;
  const kept = [];
  for (const p of run.pickups) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (!p.magnet && d <= e.pickupRadius) p.magnet = true;
    if (p.magnet && d > 0) {
      const stepLen = Math.min(PICKUP_SPEED * dt, d);
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
    }
    if (Math.hypot(e.x - p.x, e.y - p.y) <= PICKUP_COLLECT_DISTANCE) {
      addTelemetry(run, p.value);
      run.events.push({ type: 'pickup', value: p.value });
    } else kept.push(p);
  }
  run.pickups = kept;
}
