// Canvas 2D drawing of the play field in a network-diagram style (FR-025a, FR-025b, research.md R1, R6).
// Reads run state; never changes it.

import { orbitPositions, PROJECTILE_RADIUS, BARRIER_RADIUS } from '../engine/weapons.js';
import { ENGINEER_RADIUS } from '../engine/behaviors.js';
import { viewScale, viewHalfShort } from './view.js';

// The camera shows at least VIEW_RADIUS (660) game units across half the screen diagonal on desktop,
// kept below the engine's spawn distance (720) so enemies appear off-screen; on small screens it zooms
// out so the short side still shows at least 330 units each way (ui/view.js, feature 003 FR-015).

// Adaptive quality (003 data-model.md › Render Quality): average frame time over a 2 s window above
// 20 ms steps down one level; never steps up in a page session.
const QUALITY_DPR_CAP = [2, 1.5, 1, 1];
const QUALITY_WINDOW_MS = 2000;
const QUALITY_THRESHOLD_MS = 20;
const QUALITY_IGNORE_FRAME_MS = 500; // stalls from tab switches / pauses are not render cost
const GRID = 64;
const COLORS = {
  bg: '#05080f',
  grid: '#0b1626',
  gridMajor: '#13233c',
  engineer: '#e0f2fe',
  engineerHit: '#f87171',
  pickup: '#4ade80',
  barrier: '#22d3ee',
  pulse: '#a78bfa',
};
const PROJECTILE_COLORS = { ping: '#e2e8f0', 'load-balancer': '#a3e635' };

function shapePath(ctx, shape, r) {
  ctx.beginPath();
  const poly = (n, rot) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i * Math.PI * 2) / n;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  switch (shape) {
    case 'square': poly(4, Math.PI / 4); break;
    case 'triangle': poly(3, -Math.PI / 2); break;
    case 'hexagon': poly(6, 0); break;
    case 'diamond': poly(4, 0); break;
    case 'octagon': poly(8, Math.PI / 8); break;
    default: ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

// Pre-renders a glowing outlined shape once; drawn as an image every frame (no per-frame shadowBlur).
function makeSprite(shape, color, r) {
  const pad = 14;
  const size = Math.ceil((r + pad) * 2);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.shadowColor = color;
  g.shadowBlur = 10;
  g.lineWidth = 2;
  g.strokeStyle = color;
  g.fillStyle = color + '33';
  shapePath(g, shape, r);
  g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, 0, Math.max(1.5, r * 0.18), 0, Math.PI * 2);
  g.fill();
  return { canvas: c, size, r };
}

export function createRenderer(canvas, data, { showFps = false, getInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 }) } = {}) {
  const ctx = canvas.getContext('2d');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const sprites = new Map();
  const enemyDefs = new Map(data.enemies.map((e) => [e.id, e]));
  const incidentDefs = new Map((data.incidents ?? []).map((i) => [i.id, i]));
  let pointers = []; // edge pointers drawn last frame (for checks)
  let rewardDrawRadius = 0;
  let w = 0;
  let h = 0;
  let scale = 1;
  let particles = [];
  let rings = [];
  let flash = 0;
  let shake = 0;
  let quality = 0;
  let qualityMs = 0;
  let qualityFrames = 0;
  let resizes = 0;
  const frameLog = []; // [timestamp ms, frame ms] for the last 5 s (fps overlay and stats)

  // Lowest quality also drops particles and the hit flash, like reduced motion.
  const reduced = () => motionQuery.matches || quality >= 3;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_DPR_CAP[quality]);
    const vv = window.visualViewport;
    w = window.innerWidth || (vv ? vv.width : 0);
    h = window.innerHeight || (vv ? vv.height : 0);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = viewScale(w, h) * dpr;
    resizes += 1;
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  function trackFrame(frameSeconds) {
    const ms = frameSeconds * 1000;
    if (ms <= 0) return;
    const now = performance.now();
    frameLog.push([now, ms]);
    while (frameLog.length && now - frameLog[0][0] > 5000) frameLog.shift();
    if (ms > QUALITY_IGNORE_FRAME_MS || quality >= 3) return;
    qualityMs += ms;
    qualityFrames += 1;
    if (qualityMs >= QUALITY_WINDOW_MS) {
      if (qualityMs / qualityFrames > QUALITY_THRESHOLD_MS) {
        quality += 1;
        if (QUALITY_DPR_CAP[quality] !== QUALITY_DPR_CAP[quality - 1]) resize();
        if (quality >= 3) { particles = []; flash = 0; shake = 0; }
      }
      qualityMs = 0;
      qualityFrames = 0;
    }
  }

  // Edge pointers (feature 004): screen-space arrows for off-screen incidents (their colour) and
  // uncollected reward pickups (telemetry green), kept inside the safe area and below the HUD.
  function drawPointers(run) {
    pointers = [];
    const e = run.engineer;
    const dpr = canvas.width / Math.max(1, w);
    const k = scale / dpr; // CSS px per game unit
    const ins = getInsets();
    const minX = ins.left + 18, maxX = w - ins.right - 18, minY = ins.top + 18, maxY = h - ins.bottom - 18;
    const targets = [];
    for (const n of run.enemies) {
      if (n.incidentId !== undefined) targets.push({ kind: 'incident', id: n.incidentId, x: n.x, y: n.y, color: incidentDefs.get(n.incidentId).color, r: n.radius });
    }
    for (const p of run.pickups) if (p.reward) targets.push({ kind: 'reward', id: 'reward', x: p.x, y: p.y, color: COLORS.pickup, r: rewardDrawRadius });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const t of targets) {
      const sx = w / 2 + (t.x - e.x) * k;
      const sy = h / 2 + (t.y - e.y) * k;
      const rr = t.r * k;
      if (sx + rr >= 0 && sx - rr <= w && sy + rr >= 0 && sy - rr <= h) continue; // visible
      const dx = sx - w / 2, dy = sy - h / 2;
      // Scale the direction until it touches the inner pointer box.
      const fx = dx > 0 ? (maxX - w / 2) / dx : dx < 0 ? (minX - w / 2) / dx : Infinity;
      const fy = dy > 0 ? (maxY - h / 2) / dy : dy < 0 ? (minY - h / 2) / dy : Infinity;
      const f = Math.max(0, Math.min(fx, fy));
      const px = w / 2 + dx * f, py = h / 2 + dy * f;
      const a = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#05080f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
      pointers.push({ kind: t.kind, id: t.id, x: px, y: py });
    }
  }

  function frameSummary() {
    if (!frameLog.length) return { fps: 0, p95: 0, worst: 0 };
    const times = frameLog.map((f) => f[1]);
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { fps: 1000 / avg, p95: sorted[Math.floor(sorted.length * 0.95)], worst: sorted[sorted.length - 1] };
  }
  resize();

  function sprite(key, shape, color, r) {
    let s = sprites.get(key);
    if (!s) sprites.set(key, (s = makeSprite(shape, color, r)));
    return s;
  }

  function drawSprite(s, x, y, r) {
    const k = r / s.r;
    const size = s.size * k;
    ctx.drawImage(s.canvas, x - size / 2, y - size / 2, size, size);
  }

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'enemy-defeated' && !reduced()) {
        const color = enemyDefs.get(ev.typeId)?.color ?? '#ffffff';
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2; // visual only, not game state
          const sp = 40 + Math.random() * 80;
          particles.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color });
        }
      } else if (ev.type === 'pulse') {
        rings.push({ x: ev.x, y: ev.y, r: ev.radius, life: 0.35 });
      } else if (ev.type === 'player-hit' && !reduced()) {
        flash = 0.25;
        shake = 0.15;
      }
    }
    if (particles.length > 400) particles = particles.slice(-400);
  }

  function draw(run, frameSeconds) {
    const e = run.engineer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let ox = 0;
    let oy = 0;
    if (shake > 0 && !reduced()) {
      ox = (Math.random() - 0.5) * 6;
      oy = (Math.random() - 0.5) * 6;
    }
    ctx.setTransform(scale, 0, 0, scale, canvas.width / 2 - e.x * scale + ox, canvas.height / 2 - e.y * scale + oy);

    // Grid background
    const halfW = canvas.width / 2 / scale;
    const halfH = canvas.height / 2 / scale;
    const x0 = Math.floor((e.x - halfW) / GRID) * GRID;
    const y0 = Math.floor((e.y - halfH) / GRID) * GRID;
    ctx.lineWidth = 1 / scale * 1.5;
    for (let x = x0; x <= e.x + halfW; x += GRID) {
      ctx.strokeStyle = Math.round(x / GRID) % 5 === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath(); ctx.moveTo(x, e.y - halfH); ctx.lineTo(x, e.y + halfH); ctx.stroke();
    }
    for (let y = y0; y <= e.y + halfH; y += GRID) {
      ctx.strokeStyle = Math.round(y / GRID) % 5 === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath(); ctx.moveTo(e.x - halfW, y); ctx.lineTo(e.x + halfW, y); ctx.stroke();
    }

    // Telemetry pickups. Incident rewards (feature 004) are 2.5× larger with a pulsing glow
    // (a steady glow under reduced motion).
    const pk = sprite('pickup', 'diamond', COLORS.pickup, 5);
    const pulse = reduced() ? 0.6 : 0.45 + 0.35 * Math.sin((performance.now() / 1200) * Math.PI * 2);
    for (const p of run.pickups) {
      const r = Math.min(9, 4 + Math.sqrt(p.value));
      if (p.reward) {
        rewardDrawRadius = 9 * 2.5;
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rewardDrawRadius * 2.2);
        halo.addColorStop(0, `rgba(74, 222, 128, ${pulse})`);
        halo.addColorStop(1, 'rgba(74, 222, 128, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(p.x, p.y, rewardDrawRadius * 2.2, 0, Math.PI * 2); ctx.fill();
        drawSprite(pk, p.x, p.y, rewardDrawRadius);
      } else {
        drawSprite(pk, p.x, p.y, r);
      }
    }

    // Enemies; Major Incidents get their own look, infected enemies a magenta ring (feature 004).
    for (const n of run.enemies) {
      if (n.incidentId !== undefined) {
        const def = incidentDefs.get(n.incidentId);
        const glow = reduced() ? 0.35 : 0.25 + 0.2 * Math.sin((performance.now() / 900) * Math.PI * 2);
        ctx.strokeStyle = def.color;
        ctx.globalAlpha = glow;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        drawSprite(sprite('incident-' + n.incidentId, def.shape, def.color, def.radius), n.x, n.y, n.radius);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      const def = enemyDefs.get(n.typeId);
      drawSprite(sprite(n.typeId, def.shape, def.color, def.radius), n.x, n.y, n.radius);
      if (n.infected) {
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Pulse rings (Ansible Playbook)
    for (const r of rings) {
      const t = r.life / 0.35;
      ctx.strokeStyle = COLORS.pulse;
      ctx.globalAlpha = t;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, reduced() ? r.r : r.r * (1.15 - 0.15 * t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Orbiting Firewall Rule barriers, linked to the engineer like a diagram
    for (const tool of e.tools) {
      const def = run.defs.tool.get(tool.id);
      if (def.kind !== 'orbit' || tool.offlineUntil > run.elapsed) continue; // offline: no barriers
      const barrier = sprite('barrier', 'hexagon', COLORS.barrier, BARRIER_RADIUS);
      ctx.strokeStyle = COLORS.barrier + '40';
      ctx.lineWidth = 1;
      for (const b of orbitPositions(run, def.ranks[tool.rank - 1])) {
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        drawSprite(barrier, b.x, b.y, BARRIER_RADIUS);
      }
    }

    // Projectiles
    for (const p of run.projectiles) {
      const color = PROJECTILE_COLORS[p.toolId] ?? '#e2e8f0';
      drawSprite(sprite('proj-' + p.toolId, 'circle', color, PROJECTILE_RADIUS), p.x, p.y, PROJECTILE_RADIUS);
    }

    // Engineer: a glowing terminal/cursor node; turns red while recovering from a hit.
    const hurt = run.elapsed < e.invulnerableUntil;
    drawSprite(sprite(hurt ? 'eng-hit' : 'eng', 'circle', hurt ? COLORS.engineerHit : COLORS.engineer, ENGINEER_RADIUS),
      e.x, e.y, ENGINEER_RADIUS);
    ctx.strokeStyle = hurt ? COLORS.engineerHit : '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x - 5, e.y - 4); ctx.lineTo(e.x - 1, e.y); ctx.lineTo(e.x - 5, e.y + 4);
    ctx.moveTo(e.x + 1, e.y + 4); ctx.lineTo(e.x + 6, e.y + 4);
    ctx.stroke();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Hit flash
    if (flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(248, 113, 113, ${flash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Advance visual-only effects
    const dt = Math.min(frameSeconds, 0.1);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    for (const r of rings) r.life -= dt;
    rings = rings.filter((r) => r.life > 0);
    flash = Math.max(0, flash - dt);
    shake = Math.max(0, shake - dt);

    drawPointers(run);
    trackFrame(frameSeconds);
    if (showFps) {
      // Test-only overlay (?fps=1) for measuring real phones (003 SC-004, quickstart H4).
      const f = frameSummary();
      const dpr = canvas.width / Math.max(1, w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '12px ui-monospace, Menlo, monospace';
      const text = `${f.fps.toFixed(0)} fps · p95 ${f.p95.toFixed(1)} ms · worst ${f.worst.toFixed(0)} ms · ` +
        `${run.enemies.length} enemies · q${quality}`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(8, h - 30, tw + 12, 20);
      ctx.fillStyle = '#facc15';
      ctx.fillText(text, 14, h - 16);
    }
  }

  // Effect counts for automated checks (e.g. reduced motion).
  const stats = () => ({
    particles: particles.length, rings: rings.length, flash, shake, reducedMotion: motionQuery.matches, scale,
    viewScale: viewScale(w, h), viewHalfShort: viewHalfShort(w, h), width: w, height: h,
    canvasWidth: canvas.width, canvasHeight: canvas.height, quality, resizes, frames: frameSummary(),
    pointers: pointers.map((p) => ({ ...p })), rewardDrawRadius,
  });

  return { draw, handleEvents, resize, stats };
}
