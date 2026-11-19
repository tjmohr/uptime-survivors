// HUD values from run state (FR-028).

import { levelEnd } from '../engine/difficulty.js';

export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createHud(testLabel) {
  const $ = (id) => document.getElementById(id);
  const root = $('hud');
  const els = {
    uptime: $('hud-uptime'),
    uptimeBar: $('hud-uptime-bar'),
    telemetryBar: $('hud-telemetry-bar'),
    level: $('hud-level'),
    difficulty: $('hud-difficulty'),
    levelTime: $('hud-level-time'),
    time: $('hud-time'),
    loadout: $('hud-loadout'),
    test: $('hud-test'),
    sound: $('hud-sound'),
    touchSound: $('touch-sound'),
    incidents: $('hud-incidents'),
    linkWarning: $('hud-link-warning'),
  };
  let incidentKey = '';
  if (testLabel) {
    els.test.textContent = testLabel;
    els.test.hidden = false;
  }
  let loadoutKey = '';

  function update(run) {
    const e = run.engineer;
    const pct = Math.max(0, (e.uptime / e.maxUptime) * 100);
    els.uptime.textContent = `${Math.ceil(pct)}%`;
    els.uptimeBar.style.width = `${pct}%`;
    els.uptimeBar.classList.toggle('low', pct < 30);
    els.telemetryBar.style.width = `${Math.min(100, (e.telemetry / e.telemetryToNext) * 100)}%`;
    els.level.textContent = `LVL ${e.level}`;
    els.difficulty.textContent = `Difficulty ${run.difficultyLevel} / ${run.data.difficulty.length}`;
    const left = levelEnd(run.data, run.difficultyLevel, run.testOverrides.levelSeconds ?? undefined) - run.elapsed;
    els.levelTime.textContent = `${Math.max(0, Math.ceil(left))}s left in level`;
    els.time.textContent = formatTime(run.elapsed);

    const offline = (t) => t.offlineUntil > run.elapsed;
    const key = [...e.tools.map((t) => `${t.id}:${t.rank}:${offline(t)}`), ...e.passives.map((p) => `${p.id}:${p.rank}`),
      e.capacityTakes ?? 0].join(',');
    if (key !== loadoutKey) {
      loadoutKey = key;
      els.loadout.replaceChildren(
        ...e.tools.map((t) => item(run.defs.tool.get(t.id).name, t.rank, offline(t))),
        ...e.passives.map((p) => item(run.defs.passive.get(p.id).name, p.rank)),
        ...(e.capacityTakes > 0 ? [repeatableItem(run.data.repeatable.name, e.capacityTakes)] : []),
      );
    }
    updateIncidents(run);
  }

  // Major Incidents (feature 004): one name + health bar per active incident, and the
  // Core Switch Failure warning line.
  function updateIncidents(run) {
    const active = run.enemies.filter((n) => n.incidentId !== undefined);
    const ids = active.map((n) => n.id).join(',');
    if (ids !== incidentKey) {
      incidentKey = ids;
      els.incidents.replaceChildren(...active.map((n) => {
        const def = run.defs.incident.get(n.incidentId);
        const row = document.createElement('div');
        row.className = 'incident-row';
        row.dataset.entity = String(n.id);
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', `Major incident: ${def.name}`);
        const name = document.createElement('span');
        name.className = 'incident-name';
        name.textContent = `⚠ ${def.name}`;
        const bar = document.createElement('div');
        bar.className = 'bar incident-bar';
        const fill = document.createElement('div');
        fill.className = 'bar-fill';
        fill.style.background = def.color;
        bar.append(fill);
        row.append(name, bar);
        return row;
      }));
      els.incidents.hidden = active.length === 0;
    }
    for (const row of els.incidents.children) {
      const n = active.find((x) => String(x.id) === row.dataset.entity);
      if (n) row.querySelector('.bar-fill').style.width = `${Math.max(0, (n.health / n.maxHealth) * 100)}%`;
    }
    const warn = active.find((n) => n.linkState === 'warning' && n.pendingTool);
    if (warn) {
      els.linkWarning.textContent = `Link down in ${Math.max(0, warn.timer).toFixed(1)} s: ${run.defs.tool.get(warn.pendingTool).name}`;
      els.linkWarning.hidden = false;
    } else if (!els.linkWarning.hidden) {
      els.linkWarning.hidden = true;
    }
  }

  // Capacity Planning (feature 006): times taken instead of rank pips.
  function repeatableItem(name, n) {
    const li = document.createElement('li');
    li.textContent = `${name} ×${n}`;
    li.setAttribute('aria-label', `${name}, taken ${n} times`);
    return li;
  }

  function item(name, rank, offline = false) {
    const li = document.createElement('li');
    li.textContent = `${name} ${'▮'.repeat(rank)}${'▯'.repeat(5 - rank)}${offline ? ' OFFLINE' : ''}`;
    li.setAttribute('aria-label', `${name} rank ${rank} of 5${offline ? ', offline' : ''}`);
    if (offline) li.className = 'offline';
    return li;
  }

  // contracts/ui-controls.md › HUD sound indicator.
  function setSound(status, muted) {
    els.sound.textContent = status === 'unavailable' ? 'Sound unavailable' : muted ? 'Sound off (M)' : '♪ Sound on (M)';
    els.sound.classList.toggle('off', status === 'unavailable' || muted);
    // Touch Sound button (003): ♪ on, ♪̸ off or unavailable; aria-pressed = sound on.
    const on = status !== 'unavailable' && !muted;
    els.touchSound.textContent = on ? '♪' : '♪\u0338';
    els.touchSound.setAttribute('aria-pressed', String(on));
    els.touchSound.setAttribute('aria-label', status === 'unavailable' ? 'Sound unavailable' : 'Sound');
  }

  return {
    update,
    setSound,
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
  };
}
