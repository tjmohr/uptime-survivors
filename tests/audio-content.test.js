// A1 (data/audio.json validation) and A6 (audio source fetches nothing) — specs/002-procedural-audio/quickstart.md.
import { test, assert, assertEqual, loadGameData, readSource } from './harness.js';
import { validateAudioData, EFFECT_NAMES } from '../audio/content.js';

let cached = null;
async function loadAudio() {
  if (!cached) cached = await readSource('data/audio.json');
  return JSON.parse(cached);
}

async function check(edit) {
  const audio = await loadAudio();
  const game = await loadGameData();
  edit(audio, game);
  return validateAudioData(audio, game);
}

function errorAt(result, path, pattern) {
  assert(!result.ok, 'expected validation to fail');
  const err = result.errors.find((e) => e.path === path && (!pattern || pattern.test(e.message)));
  assert(err, `expected an error at ${path}; got ${JSON.stringify(result.errors)}`);
  return err;
}

test('audio content: shipped data/audio.json is valid against data/game.json', async () => {
  const r = validateAudioData(await loadAudio(), await loadGameData());
  assert(r.ok, 'errors: ' + JSON.stringify(r.errors));
});

test('audio content: exactly the 10 effects, in a fixed order', () => {
  assertEqual(EFFECT_NAMES, ['fire', 'pulse', 'damage', 'hit', 'defeat', 'pickup', 'levelUp', 'newThreat', 'win', 'loss']);
});

test('audio content: never throws on non-object input', async () => {
  const game = await loadGameData();
  for (const bad of [null, undefined, 'text', 42, []]) {
    const r = validateAudioData(bad, game);
    assertEqual(r.ok, false);
    assert(r.errors.length > 0);
  }
  const r = validateAudioData({ effects: [], music: { layers: 'x' } }, null);
  assertEqual(r.ok, false);
});

test('audio content: missing and unknown effects are named', async () => {
  errorAt(await check((a) => delete a.effects.hit), 'effects.hit');
  errorAt(await check((a) => { a.effects.boom = a.effects.hit; }), 'effects.boom');
});

test('audio content: bad wave, bad filter, empty notes', async () => {
  errorAt(await check((a) => { a.effects.fire.voice.wave = 'piano'; }), 'effects.fire.voice.wave');
  errorAt(await check((a) => { a.effects.fire.voice.filter.type = 'comb'; }), 'effects.fire.voice.filter.type');
  errorAt(await check((a) => { a.effects.fire.voice.notes = []; }), 'effects.fire.voice.notes');
  errorAt(await check((a) => { a.effects.fire.voice.gain = 0; }), 'effects.fire.voice.gain');
  errorAt(await check((a) => { a.effects.fire.voice.notes[0].toFreq = -5; }), 'effects.fire.voice.notes[0].toFreq');
});

test('audio content: effect durations (≤ 1 s; win/loss ≤ 3 s)', async () => {
  errorAt(await check((a) => { a.effects.hit.voice.notes[0].ms = 1001; }), 'effects.hit.voice.notes', /at most 1000/);
  errorAt(await check((a) => { a.effects.win.voice.notes[0].ms = 3000; }), 'effects.win.voice.notes', /at most 3000/);
  const ok = await check((a) => { a.effects.loss.voice.notes = [{ freq: 200, ms: 2900 }]; });
  assert(ok.ok, JSON.stringify(ok.errors));
});

test('audio content: pattern must be 16 steps of x/. with at least one x', async () => {
  errorAt(await check((a) => { a.music.layers[0].pattern = 'x...x...'; }), 'music.layers[0].pattern');
  errorAt(await check((a) => { a.music.layers[0].pattern = 'x...x...x...x..o'; }), 'music.layers[0].pattern');
  errorAt(await check((a) => { a.music.layers[0].pattern = '................'; }), 'music.layers[0].pattern');
});

test('audio content: layer voice may last at most one beat at bpmStart', async () => {
  errorAt(await check((a) => { a.music.layers[0].voice.notes[0].ms = 600; }), 'music.layers[0].voice.notes', /at most/);
});

test('audio content: tempo must rise at least 30%', async () => {
  errorAt(await check((a) => { a.music.bpmEnd = a.music.bpmStart * 1.2; }), 'music.bpmEnd');
});

test('audio content: a layer must join at level 1 and at every debut level', async () => {
  errorAt(await check((a) => { a.music.layers = a.music.layers.filter((l) => l.joinLevel !== 1); }), 'music.layers', /level 1/);
  const r = await check((a, g) => {
    a.music.layers = a.music.layers.filter((l) => l.joinLevel !== 12);
  });
  const game = await loadGameData();
  const enemy = game.enemies.find((e) => e.debutLevel === 12);
  const err = errorAt(r, 'music.layers', /debut level 12/);
  assert(err.message.includes(enemy.id), err.message);
  // Moving an enemy's debut makes the cross-check follow game data.
  errorAt(await check((a, g) => { g.enemies[1].debutLevel = 5; }), 'music.layers', /debut level 5/);
});

test('audio content: duplicate layer id, unknown fields, defaults, mix', async () => {
  errorAt(await check((a) => { a.music.layers[1].id = a.music.layers[0].id; }), 'music.layers[1].id', /duplicate/);
  errorAt(await check((a) => { a.extra = 1; }), 'extra');
  errorAt(await check((a) => { a.music.layers[0].volume = 1; }), 'music.layers[0].volume');
  errorAt(await check((a) => { a.effects.hit.voice.notes[0].vel = 1; }), 'effects.hit.voice.notes[0].vel');
  errorAt(await check((a) => { a.defaults.musicVolume = 65; }), 'defaults.musicVolume');
  errorAt(await check((a) => { a.defaults.muted = 'no'; }), 'defaults.muted');
  errorAt(await check((a) => { a.mix.duckFactor = 1; }), 'mix.duckFactor');
  errorAt(await check((a) => { a.mix.maxConcurrentEffects = 0; }), 'mix.maxConcurrentEffects');
  errorAt(await check((a) => { a.schemaVersion = 2; }), 'schemaVersion');
  errorAt(await check((a) => { a.music.stepsPerBar = 8; }), 'music.stepsPerBar');
});

test('audio content: audio source loads nothing from the network (A6)', async () => {
  const banned = /\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|https?:\/\/|new\s+Audio\s*\(|\.(wav|mp3|ogg|flac|m4a|aac|opus)\b/;
  for (const name of ['content', 'director', 'synth']) {
    const src = await readSource(`audio/${name}.js`);
    const m = src.match(banned);
    assert(!m, `audio/${name}.js contains '${m && m[0]}'`);
  }
});
