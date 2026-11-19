// Load → validate → title; owns the frame loop and feeds input into the engine (plan.md, research.md R2, R9).

import { validateGameData } from './engine/content.js';
import { createRun, step, chooseUpgrade, pause, resume, STEP_SECONDS } from './engine/run.js';
import { readParams, describeParams } from './ui/params.js';
import { createScreens } from './ui/screens.js';
import { createTouchMode } from './ui/touchmode.js';
import { createHud } from './ui/hud.js';
import { createRenderer } from './ui/render.js';
import { createInput } from './ui/input.js';
import { buildGuide } from './ui/guide.js';
import { validateAudioData } from './audio/content.js';
import { createDirector } from './audio/director.js';
import { createAudio } from './audio/synth.js';

const MAX_STEPS_PER_FRAME = 5;
const params = readParams(location.search);
const touchMode = createTouchMode();
const screens = createScreens({ touchMode });

const state = {
  data: null,
  run: null,
  lastSeed: null,
  accumulator: 0,
  lastFrame: null,
  // Page-session audio settings (002 data-model.md › Audio Settings: AudioSettings.muted,
  // AudioSettings.musicVolume, AudioSettings.effectsVolume). Never stored; reset on reload (FR-014).
  sound: null,
};

let hud;
let renderer;
let input;
let audio;
let director;

// Pause-screen sound controls; `refresh` is filled in by the screen so M can update its label.
const pauseSound = {
  get settings() { return state.sound; },
  available: () => audio.status !== 'unavailable',
  onMute: () => toggleMute(),
  onMusic: (pct) => audio.setMusicVolume(pct),
  onEffects: (pct) => audio.setEffectsVolume(pct),
  refresh: null,
};

function showSoundStatus() {
  hud.setSound(audio.status, state.sound.muted);
}

function toggleMute() {
  audio.setMuted(!state.sound.muted);
  showSoundStatus();
  if (screens.current === 'paused' && pauseSound.refresh) pauseSound.refresh();
  screens.announce(audio.status === 'unavailable' ? 'Sound unavailable' : state.sound.muted ? 'Sound off' : 'Sound on');
}

// Called from Start / New Run / Replay Seed clicks: the click is the gesture browsers require (research A3).
function startSound() {
  if (audio.status !== 'idle') return;
  audio.start().then((status) => {
    showSoundStatus();
    if (status === 'unavailable') screens.announce('Sound unavailable');
  });
}

function freshSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] || 1;
}

function startRun(seed) {
  screens.close();
  screens.clearBanners();
  state.lastSeed = seed;
  startSound();
  director.reset();
  audio.startMusic(); // from bar 1 at level 1, for every new run (FR-009)
  state.run = createRun(state.data, { seed, levelSeconds: params.levelSeconds });
  state.accumulator = 0;
  input.clear();
  hud.show();
  showSoundStatus();
  handleEvents();
}

function quitToTitle() {
  state.run = null;
  input.stopSteering();
  drawJoystick();
  if (audio) audio.stopMusic();
  hud.hide();
  screens.clearBanners();
  screens.showTitle(() => startRun(params.seed ?? freshSeed()));
}

// Field Guide (feature 005): opened only from the pause screen; the run stays paused throughout.
function showPauseScreen(focusGuide = false) {
  screens.showPause(togglePause, quitToTitle, pauseSound, { onGuide: openGuide, focusGuide });
}

function openGuide() {
  const run = state.run;
  if (!run || run.phase !== 'paused') return;
  screens.showGuide(buildGuide(run), run.defs, { onBack: closeGuide });
}

function closeGuide() {
  if (state.run && state.run.phase === 'paused') showPauseScreen(true);
}

function togglePause() {
  const run = state.run;
  if (!run) return;
  if (screens.current === 'guide') return closeGuide(); // Esc / P go back to the pause screen, never resume
  if (run.phase === 'playing') {
    pause(run);
    showPauseScreen();
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
  // Sound reads the same events as the renderer and never changes the run (FR-017).
  const plan = director.consume(run.events, performance.now());
  if (plan.level !== null) audio.setLevel(plan.level);
  audio.setIncident(plan.incidentActive);
  if (plan.runEnded) audio.stopMusic();
  for (const name of plan.effects) audio.play(name);
  if (plan.runEnded) audio.play(plan.runEnded);
  for (const ev of run.events) {
    if (ev.type === 'incident-resolved') {
      screens.resolveIncidentAlert(ev.incidentId, `RESOLVED — ${run.defs.incident.get(ev.incidentId).name}`);
    } else if (ev.type === 'link-down') {
      screens.announce(`${run.defs.tool.get(ev.toolId).name} offline`);
    }
  }
  for (const ev of run.events) {
    if (ev.type === 'difficulty-up') {
      if (ev.level > 1) screens.showBanner(`Difficulty ${ev.level}`);
      for (const id of ev.debuts) {
        const def = run.defs.enemy.get(id);
        screens.showBanner(`New threat: ${def.name} — ${def.concept}`, true);
      }
    } else if (ev.type === 'run-ended') {
      screens.clearIncidentAlerts(); // the end screen reports any incident still active as unresolved
      screens.showEnd(run, {
        onNew: () => startRun(freshSeed()),
        onReplay: () => startRun(state.lastSeed),
      });
    }
  }
  // Major Incidents (feature 004; standing alerts since feature 006): a red line stays up until the
  // incident is resolved, then turns green. After the regular banners, so its announcement is the one
  // read for that step (the "Difficulty N" banner arrives on the same step).
  for (const ev of run.events) {
    if (ev.type !== 'incident-arrived') continue;
    const def = run.defs.incident.get(ev.incidentId);
    screens.showIncidentAlert(ev.incidentId, `MAJOR INCIDENT — ${def.name} — ${def.concept}`);
  }
  run.events.length = 0;
  if (run.phase === 'levelup' && screens.current !== 'levelup') screens.showLevelUp(run, choose);
}

// A touch button acts when the finger that pressed it lifts over it, even while another finger is
// steering (a second-finger tap does not always produce a click). Mouse and keyboard use click.
function touchButton(el, action) {
  let pressed = null;
  let suppressClickUntil = 0;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    pressed = ev.pointerId;
    try { el.releasePointerCapture(ev.pointerId); } catch {}
  });
  el.addEventListener('pointerup', (ev) => {
    if (ev.pointerType !== 'touch' || ev.pointerId !== pressed) return;
    pressed = null;
    suppressClickUntil = performance.now() + 600;
    action();
  });
  el.addEventListener('pointerleave', (ev) => { if (ev.pointerId === pressed) pressed = null; });
  el.addEventListener('click', () => { if (performance.now() >= suppressClickUntil) action(); });
}

// Where edge pointers may be drawn (feature 004): inside the safe area and below the HUD (which also
// holds the touch Pause/Sound buttons). Measured at most every 250 ms.
let insetCache = { at: -1e9, value: { top: 0, right: 0, bottom: 0, left: 0 } };
function pointerInsets() {
  const now = performance.now();
  if (now - insetCache.at < 250) return insetCache.value;
  const css = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
  const hud = document.getElementById('hud');
  const hudBottom = hud.hidden ? 0 : hud.getBoundingClientRect().bottom;
  insetCache = { at: now, value: { top: Math.max(px('--sat'), hudBottom), right: px('--sar'), bottom: px('--sab'), left: px('--sal') } };
  // Incident alerts (feature 006) sit below the HUD, which grows on phones (loadout, touch buttons).
  document.documentElement.style.setProperty('--hud-bottom', `${Math.round(hudBottom)}px`);
  return insetCache.value;
}

const joystickEl = document.getElementById('joystick');
function drawJoystick() {
  const j = input.joystick();
  joystickEl.classList.toggle('active', j !== null);
  if (!j) return;
  joystickEl.style.transform = `translate(${j.base.x}px, ${j.base.y}px)`;
  const knob = joystickEl.firstElementChild;
  knob.style.transform = `translate(${j.point.x - j.base.x}px, ${j.point.y - j.base.y}px)`;
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
  audio.setDucked(run.phase === 'paused' || run.phase === 'levelup');
  if (run.phase !== 'playing') input.stopSteering(); // a held finger never steers into the next screen
  drawJoystick();
  renderer.draw(run, elapsed);
  hud.update(run);
}

async function boot() {
  screens.showLoading();
  const load = async (path) => {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { raw: await res.json() };
    } catch (err) {
      return { error: { id: null, path, message: `could not be loaded or parsed (${err.message})` } };
    }
  };
  const [game, sound] = await Promise.all([load('data/game.json'), load('data/audio.json')]);
  // Both files are validated before Start; all errors from both are listed together.
  const errors = [];
  let gameResult = null;
  if (game.error) errors.push(game.error);
  else {
    gameResult = validateGameData(game.raw);
    if (!gameResult.ok) errors.push(...gameResult.errors);
  }
  let soundResult = null;
  if (sound.error) errors.push(sound.error);
  else {
    soundResult = validateAudioData(sound.raw, gameResult && gameResult.ok ? gameResult.data : game.raw);
    if (!soundResult.ok) errors.push(...soundResult.errors.map((e) => ({ ...e, path: `data/audio.json › ${e.path || '(file)'}` })));
  }
  if (errors.length) {
    screens.showError(errors);
    return;
  }
  state.data = gameResult.data;
  const audioData = soundResult.data;
  state.sound = { ...audioData.defaults };
  audio = createAudio(audioData, Object.defineProperty(state.sound, 'forceFail', { value: params.audioFail, enumerable: false }));
  director = createDirector(audioData);
  hud = createHud(describeParams(params));
  renderer = createRenderer(document.getElementById('game'), state.data, { showFps: params.fps, getInsets: pointerInsets });
  input = createInput({
    canvas: document.getElementById('game'),
    isPlaying: () => state.run !== null && state.run.phase === 'playing',
    onPauseKey: togglePause,
    onChoiceKey: choose,
    onFocusLost: () => {
      if (state.run && state.run.phase === 'playing') togglePause();
      audio.suspend(); // silent until the player returns (spec Edge Cases)
    },
    onFocusGained: () => audio.resume(), // music comes back ducked: the game is paused
    onMuteKey: toggleMute,
  });
  // On-screen touch buttons (003 FR-006): same actions as Esc/P and M.
  touchButton(document.getElementById('touch-pause'), togglePause);
  touchButton(document.getElementById('touch-sound'), toggleMute);
  showSoundStatus();
  quitToTitle();
  requestAnimationFrame(frame);
}

// Read-only handle for automated smoke checks; the game never reads it.
globalThis.__uptimeSurvivors = {
  get run() { return state.run; },
  get data() { return state.data; },
  get render() { return renderer ? renderer.stats() : null; },
  get touchMode() { return touchMode.on; },
  get joystick() { return input ? input.joystick() : null; },
  get audio() { return audio ? { ...audio.stats(), directorCounts: { ...director.counts } } : null; },
};

boot();
