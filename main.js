// Load → validate → title; owns the frame loop and feeds input into the engine (plan.md, research.md R2, R9).

import { validateGameData } from './engine/content.js';
import { createRun, step, chooseUpgrade, pause, resume, STEP_SECONDS } from './engine/run.js';
import { readParams, describeParams } from './ui/params.js';
import { createScreens } from './ui/screens.js';
import { createHud } from './ui/hud.js';
import { createRenderer } from './ui/render.js';
import { createInput } from './ui/input.js';

const MAX_STEPS_PER_FRAME = 5;
const params = readParams(location.search);
const screens = createScreens();

const state = {
  data: null,
  run: null,
  lastSeed: null,
  accumulator: 0,
  lastFrame: null,
};

let hud;
let renderer;
let input;

function freshSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] || 1;
}

function startRun(seed) {
  screens.close();
  screens.clearBanners();
  state.lastSeed = seed;
  state.run = createRun(state.data, { seed, levelSeconds: params.levelSeconds });
  state.accumulator = 0;
  input.clear();
  hud.show();
  handleEvents();
}

function quitToTitle() {
  state.run = null;
  hud.hide();
  screens.clearBanners();
  screens.showTitle(() => startRun(params.seed ?? freshSeed()));
}

function togglePause() {
  const run = state.run;
  if (!run) return;
  if (run.phase === 'playing') {
    pause(run);
    screens.showPause(togglePause, quitToTitle);
  } else if (run.phase === 'paused') {
    resume(run);
    screens.close();
    state.accumulator = 0;
  }
}

function choose(index) {
  const run = state.run;
  if (!run || run.phase !== 'levelup') return;
  if (!chooseUpgrade(run, index).ok) return;
  if (run.phase === 'levelup') screens.showLevelUp(run, choose);
  else screens.close();
  state.accumulator = 0;
}

function handleEvents() {
  const run = state.run;
  renderer.handleEvents(run.events);
  for (const ev of run.events) {
    if (ev.type === 'difficulty-up') {
      if (ev.level > 1) screens.showBanner(`Difficulty ${ev.level}`);
      for (const id of ev.debuts) {
        const def = run.defs.enemy.get(id);
        screens.showBanner(`New threat: ${def.name} — ${def.concept}`, true);
      }
    } else if (ev.type === 'run-ended') {
      screens.showEnd(run, {
        onNew: () => startRun(freshSeed()),
        onReplay: () => startRun(state.lastSeed),
      });
    }
  }
  run.events.length = 0;
  if (run.phase === 'levelup' && screens.current !== 'levelup') screens.showLevelUp(run, choose);
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = state.lastFrame === null ? 0 : Math.min((now - state.lastFrame) / 1000, 0.25);
  state.lastFrame = now;
  const run = state.run;
  if (!run) return;

  if (run.phase === 'playing') {
    state.accumulator += elapsed;
    let n = 0;
    while (state.accumulator >= STEP_SECONDS && n < MAX_STEPS_PER_FRAME && run.phase === 'playing') {
      step(run, input.move());
      state.accumulator -= STEP_SECONDS;
      n++;
    }
    // After a stall, drop the backlog instead of spiralling.
    if (n === MAX_STEPS_PER_FRAME || run.phase !== 'playing') state.accumulator = Math.min(state.accumulator, STEP_SECONDS);
    handleEvents();
  }
  renderer.draw(run, elapsed);
  hud.update(run);
}

async function boot() {
  screens.showLoading();
  let raw;
  try {
    const res = await fetch('data/game.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    screens.showError([{ id: null, path: 'data/game.json', message: `could not be loaded or parsed (${err.message})` }]);
    return;
  }
  const result = validateGameData(raw);
  if (!result.ok) {
    screens.showError(result.errors);
    return;
  }
  state.data = result.data;
  hud = createHud(describeParams(params));
  renderer = createRenderer(document.getElementById('game'), state.data);
  input = createInput({
    onPauseKey: togglePause,
    onChoiceKey: choose,
    onFocusLost: () => {
      if (state.run && state.run.phase === 'playing') togglePause();
    },
  });
  quitToTitle();
  requestAnimationFrame(frame);
}

// Read-only handle for automated smoke checks; the game never reads it.
globalThis.__uptimeSurvivors = {
  get run() { return state.run; },
  get data() { return state.data; },
  get render() { return renderer ? renderer.stats() : null; },
};

boot();
