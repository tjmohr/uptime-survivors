// A1 (data/audio.json validation) and A6 (audio source fetches nothing) — specs/002-procedural-audio/quickstart.md;
// music section (schemaVersion 2): M-U8 — specs/007-drum-and-bass-music/contracts/music-data.md.
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

test('audio content: exactly the 12 effects, in a fixed order (10 from feature 002, 2 from 004)', () => {
  assertEqual(EFFECT_NAMES, ['fire', 'pulse', 'damage', 'hit', 'defeat', 'pickup', 'levelUp', 'newThreat', 'win', 'loss',
    'incidentAlarm', 'incidentResolved']);
});

test('audio content: incident sounds are validated (U7)', async () => {
  errorAt(await check((a) => delete a.effects.incidentAlarm), 'effects.incidentAlarm');
  errorAt(await check((a) => { a.effects.incidentResolved.voice.notes[0].ms = 3001; }), 'effects.incidentResolved.voice.notes', /at most 3000/);
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

// ---- Feature 007 music (M-U8) -------------------------------------------------------------------
const songAt = (a, id) => a.music.songs.findIndex((x) => x.id === id);
const partAt = (a, songId, partId) => a.music.songs[songAt(a, songId)].parts.findIndex((x) => x.id === partId);
const part = (a, songId, partId) => a.music.songs[songAt(a, songId)].parts[partAt(a, songId, partId)];
const partPath = (a, songId, partId) => `music.songs[${songAt(a, songId)}].parts[${partAt(a, songId, partId)}]`;

// Like errorAt, and also checks the error names the song (and part).
async function musicError(edit, pathOf, id, pattern) {
  const audio = await loadAudio();
  const path = pathOf(audio);
  const r = await check(edit);
  const err = errorAt(r, path, pattern);
  assertEqual(err.id, id, `id for ${path}`);
}

test('audio content: old music fields are unknown; grid constants are pinned (M-U8)', async () => {
  errorAt(await check((a) => { a.music.bpmStart = 118; }), 'music.bpmStart', /unknown field/);
  errorAt(await check((a) => { a.music.layers = []; }), 'music.layers', /unknown field/);
  errorAt(await check((a) => { a.schemaVersion = 1; }), 'schemaVersion');
  errorAt(await check((a) => { a.music.stepsPerBar = 8; }), 'music.stepsPerBar');
  errorAt(await check((a) => { a.music.crossfadeBars = 4; }), 'music.crossfadeBars');
  errorAt(await check((a) => { a.music.fillBars = [8, 16]; }), 'music.fillBars');
  errorAt(await check((a) => { a.music.breakdownBars = [25, 26, 27, 28]; }), 'music.breakdownBars');
  errorAt(await check((a) => { a.music.ghostGain = 1; }), 'music.ghostGain');
  errorAt(await check((a) => { a.music.bpm = 0; }), 'music.bpm');
});

test('audio content: five songs, one per style, ≥ 3 speaker songs (M-U8)', async () => {
  errorAt(await check((a) => { a.music.songs.pop(); }), 'music.songs', /exactly 5 songs/);
  await musicError((a) => { a.music.songs[songAt(a, 'dancefloor-uptime')].style = 'jungle'; },
    (a) => `music.songs[${songAt(a, 'dancefloor-uptime')}].style`, 'dancefloor-uptime', /already used by 'jungle-backbone'/);
  errorAt(await check((a) => { for (const s of a.music.songs) if (s.style !== 'jump-up' && s.style !== 'neurofunk') s.bassAudibility = 'headphones'; }),
    'music.songs', /at least 3 songs/);
  await musicError((a) => { a.music.songs[1].id = a.music.songs[0].id; }, () => 'music.songs[1].id', 'liquid-uplink', /duplicate/);
  await musicError((a) => { a.music.songs[0].rootHz = 200; }, () => 'music.songs[0].rootHz', 'liquid-uplink');
});

test('audio content: stage 1 is drums and bass only; risers there are noise-only (M-U8, FR-010)', async () => {
  await musicError((a) => { part(a, 'liquid-uplink', 'pad').stage = 1; }, (a) => `music.songs[${songAt(a, 'liquid-uplink')}].parts`,
    'liquid-uplink/pad', /stage 1 may only contain/);
  await musicError((a) => {
    a.music.songs[0].parts.push({ id: 'sweep', role: 'riser', stage: 1, pattern: ['x...............'],
      voice: { wave: 'sawtooth', gain: 0.05, attackMs: 100, notes: [{ freq: 200, toFreq: 800, ms: 1000 }] } });
  }, () => 'music.songs[0].parts', 'liquid-uplink/sweep', /noise/);
  errorAt(await check((a) => { for (const p of a.music.songs[0].parts) if (p.stage === 4) p.stage = 3; }), 'music.songs[0].parts', /stage 4/);
});

test('audio content: backbeat on steps 4 and 12; clap counts as a backbeat (M-U8, FR-002)', async () => {
  await musicError((a) => { part(a, 'jump-up-handshake', 'snare').pattern = ['....x...........']; },
    (a) => `music.songs[${songAt(a, 'jump-up-handshake')}].parts`, 'jump-up-handshake', /steps 4 and 12/);
  const dance = (await loadAudio()).music.songs.find((s) => s.id === 'dancefloor-uptime');
  assert(dance.parts.some((p) => p.instrument === 'clap' && p.stage === 1), 'the shipped Dancefloor song uses a clap backbeat');
  await musicError((a) => { part(a, 'liquid-uplink', 'kick').instrument = 'cowbell'; },
    (a) => `${partPath(a, 'liquid-uplink', 'kick')}.instrument`, 'liquid-uplink/kick');
});

test('audio content: patterns, notes and fills (M-U8)', async () => {
  const sub = (a) => partPath(a, 'jump-up-handshake', 'sub');
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').pattern = part(a, 'jump-up-handshake', 'sub').pattern.slice(0, 3); },
    (a) => `${sub(a)}.pattern`, 'jump-up-handshake/sub', /1, 2, 4 or 8 bars/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').pattern[0] = 'x...x...'; },
    (a) => `${sub(a)}.pattern`, 'jump-up-handshake/sub', /16 characters/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').notes.push(0); },
    (a) => `${sub(a)}.notes`, 'jump-up-handshake/sub', /notes for \d+ hits/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').notes[0] = 60; },
    (a) => `${sub(a)}.notes`, 'jump-up-handshake/sub', /semitone/);
  await musicError((a) => { delete part(a, 'jump-up-handshake', 'sub').notes; },
    (a) => `${sub(a)}.notes`, 'jump-up-handshake/sub', /need 'notes'/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'fill').pattern = ['..x.....x.x.x.xx']; },
    (a) => `${partPath(a, 'jump-up-handshake', 'fill')}.pattern`, 'jump-up-handshake/fill', /steps 8–15/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').voice.notes[0].ms = 3000; },
    (a) => `${sub(a)}.voice.notes`, 'jump-up-handshake/sub', /at most/);
  await musicError((a) => { part(a, 'jump-up-handshake', 'sub').volume = 1; },
    (a) => `${sub(a)}.volume`, 'jump-up-handshake/sub', /unknown field/);
});

test('audio content: song rules — 8-bar part, incident part, loudest bass, speaker bass, distinct songs (M-U8)', async () => {
  await musicError((a) => {
    for (const p of a.music.songs[songAt(a, 'jungle-backbone')].parts) if (p.pattern.length === 8) p.pattern = p.pattern.slice(0, 4), p.notes = p.notes && p.notes.slice(0, p.pattern.join('').replace(/\./g, '').length);
  }, (a) => `music.songs[${songAt(a, 'jungle-backbone')}]`, 'jungle-backbone', /8-bar pattern/);
  errorAt(await check((a) => { a.music.songs[0].parts = a.music.songs[0].parts.filter((p) => p.role !== 'incident'); }),
    'music.songs[0].parts', /exactly one incident part/);
  await musicError((a) => { part(a, 'liquid-uplink', 'pad').voice.gain = 0.9; },
    () => 'music.songs[0].parts', 'liquid-uplink/pad', /loudest/);
  await musicError((a) => { part(a, 'neuro-packet-storm', 'reese').voice.wave = 'sine'; },
    (a) => `music.songs[${songAt(a, 'neuro-packet-storm')}]`, 'neuro-packet-storm', /speakers' song needs a stage-1 upper bass/);
  await musicError((a) => {
    const src = a.music.songs[songAt(a, 'liquid-uplink')];
    const dst = a.music.songs[songAt(a, 'jungle-backbone')];
    for (const id of ['kick', 'snare', 'sub']) dst.parts[dst.parts.findIndex((p) => p.id === id)] = JSON.parse(JSON.stringify(src.parts.find((p) => p.id === id)));
  }, (a) => `music.songs[${songAt(a, 'jungle-backbone')}]`, 'jungle-backbone', /same drum pattern and bass line as 'liquid-uplink'/);
});

test('audio content: extended Voice fields are validated (M-U8)', async () => {
  const v = (a) => part(a, 'neuro-packet-storm', 'reese').voice;
  const vp = (a) => `${partPath(a, 'neuro-packet-storm', 'reese')}.voice`;
  await musicError((a) => { v(a).unison = 5; }, (a) => `${vp(a)}.unison`, 'neuro-packet-storm/reese', /at most 3/);
  await musicError((a) => { v(a).detuneCents = 80; }, (a) => `${vp(a)}.detuneCents`, 'neuro-packet-storm/reese');
  await musicError((a) => { v(a).drive = 2; }, (a) => `${vp(a)}.drive`, 'neuro-packet-storm/reese');
  await musicError((a) => { v(a).filter.q = 50; }, (a) => `${vp(a)}.filter.q`, 'neuro-packet-storm/reese');
  await musicError((a) => { v(a).lfo.target = 'pitch'; }, (a) => `${vp(a)}.lfo.target`, 'neuro-packet-storm/reese');
  await musicError((a) => { v(a).lfo.steps = 0; }, (a) => `${vp(a)}.lfo.steps`, 'neuro-packet-storm/reese');
  errorAt(await check((a) => { a.effects.hit.voice.unison = 2; a.effects.hit.voice.wave = 'noise'; }), 'effects.hit.voice.unison', /noise/);
});

test('audio content: unknown fields, defaults, mix', async () => {
  errorAt(await check((a) => { a.extra = 1; }), 'extra');
  errorAt(await check((a) => { a.effects.hit.voice.notes[0].vel = 1; }), 'effects.hit.voice.notes[0].vel');
  errorAt(await check((a) => { a.defaults.musicVolume = 65; }), 'defaults.musicVolume');
  errorAt(await check((a) => { a.defaults.muted = 'no'; }), 'defaults.muted');
  errorAt(await check((a) => { a.mix.duckFactor = 1; }), 'mix.duckFactor');
  errorAt(await check((a) => { a.mix.maxConcurrentEffects = 0; }), 'mix.maxConcurrentEffects');
});

test('audio content: audio source loads nothing from the network (A6)', async () => {
  const banned = /\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|https?:\/\/|new\s+Audio\s*\(|\.(wav|mp3|ogg|flac|m4a|aac|opus)\b/;
  for (const name of ['content', 'director', 'synth']) {
    const src = await readSource(`audio/${name}.js`);
    const m = src.match(banned);
    assert(!m, `audio/${name}.js contains '${m && m[0]}'`);
  }
});
