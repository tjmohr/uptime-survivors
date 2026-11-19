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
  };
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

    const key = [...e.tools, ...e.passives].map((x) => `${x.id}:${x.rank}`).join(',');
    if (key !== loadoutKey) {
      loadoutKey = key;
      els.loadout.replaceChildren(
        ...e.tools.map((t) => item(run.defs.tool.get(t.id).name, t.rank)),
        ...e.passives.map((p) => item(run.defs.passive.get(p.id).name, p.rank)),
      );
    }
  }

  function item(name, rank) {
    const li = document.createElement('li');
    li.textContent = `${name} ${'▮'.repeat(rank)}${'▯'.repeat(5 - rank)}`;
    li.setAttribute('aria-label', `${name} rank ${rank} of 5`);
    return li;
  }

  return {
    update,
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
  };
}
