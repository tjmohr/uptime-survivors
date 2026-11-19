// A2–A4: director mapping, limiting, tempo and layers — specs/002-procedural-audio/quickstart.md.
import { test, assert, assertEqual, loadGameData, readSource } from './harness.js';
import { createDirector, bpmForLevel, layersForLevel } from '../audio/director.js';
import { voiceDurationMs } from '../audio/content.js';

let cached = null;
async function loadAudio() {
  if (!cached) cached = await readSource('data/audio.json');
  return JSON.parse(cached);
}

test('director: each engine event maps to its effect (A2)', async () => {
  const cases = [
    [{ type: 'fire', toolId: 'ping' }, 'fire'],
    [{ type: 'pulse', x: 0, y: 0, radius: 50 }, 'pulse'],
    [{ type: 'player-hit', amount: 3 }, 'damage'],
    [{ type: 'hit', x: 0, y: 0, amount: 1 }, 'hit'],
    [{ type: 'enemy-defeated', typeId: 'x', x: 0, y: 0 }, 'defeat'],
    [{ type: 'pickup', value: 1 }, 'pickup'],
    [{ type: 'level-up', level: 2 }, 'levelUp'],
    [{ type: 'difficulty-up', level: 4, debuts: ['jitter'] }, 'newThreat'],
  ];
  for (const [ev, effect] of cases) {
    const d = createDirector(await loadAudio());
    assertEqual(d.consume([ev], 1000).effects, [effect], ev.type);
  }
});

test('director: difficulty change, run end, blink (A2)', async () => {
  const d = createDirector(await loadAudio());
  let plan = d.consume([{ type: 'difficulty-up', level: 5, debuts: [] }], 0);
  assertEqual(plan, { effects: [], level: 5, runEnded: null, incidentActive: false });
  plan = d.consume([{ type: 'blink', x: 0, y: 0 }], 10);
  assertEqual(plan, { effects: [], level: null, runEnded: null, incidentActive: false });
  plan = d.consume([{ type: 'run-ended', outcome: 'win' }], 20);
  assertEqual(plan.runEnded, 'win');
  assertEqual(plan.effects, []);
  assertEqual(d.counts.win, 1);
  plan = createDirector(await loadAudio()).consume([{ type: 'run-ended', outcome: 'loss' }], 0);
  assertEqual(plan.runEnded, 'loss');
});

test('director: several level-ups in one frame → one levelUp (A2, FR-004)', async () => {
  const d = createDirector(await loadAudio());
  const plan = d.consume([{ type: 'level-up', level: 2 }, { type: 'level-up', level: 3 }, { type: 'level-up', level: 4 }], 0);
  assertEqual(plan.effects, ['levelUp']);
  assertEqual(d.counts.levelUp, 1);
});

test('director: never mutates events', async () => {
  const d = createDirector(await loadAudio());
  const events = [{ type: 'hit', x: 1, y: 2, amount: 3 }, { type: 'run-ended', outcome: 'loss' }];
  const copy = JSON.parse(JSON.stringify(events));
  d.consume(events, 0);
  assertEqual(events, copy);
});

test('director: a hit flood plays at most once per 60 ms and never more than 8 at once (A3)', async () => {
  const audio = await loadAudio();
  const d = createDirector(audio);
  const played = [];
  // 500 hits over one second, delivered in 60 frames of ~16.7 ms.
  for (let f = 0; f < 60; f++) {
    const now = f * (1000 / 60);
    const events = [];
    for (let i = 0; i < 9; i++) events.push({ type: 'hit', x: 0, y: 0, amount: 1 });
    if (d.consume(events, now).effects.includes('hit')) played.push(now);
  }
  assert(played.length > 0);
  for (let i = 1; i < played.length; i++) assert(played[i] - played[i - 1] >= 60, `hits ${played[i - 1]} → ${played[i]}`);
  assert(played.length <= Math.ceil(1000 / 60), `${played.length} hits in 1 s`);
});

test('director: concurrency cap drops excess, never queues (A3)', async () => {
  const audio = await loadAudio();
  for (const name of Object.keys(audio.effects)) audio.effects[name].minIntervalMs = 0;
  const d = createDirector(audio);
  const all = ['fire', 'pulse', 'player-hit', 'hit', 'enemy-defeated', 'pickup', 'level-up'].map((type) => ({ type, debuts: [] }));
  const sounding = []; // [start, end]
  for (let f = 0; f < 120; f++) {
    const now = f * 5;
    const plan = d.consume(all, now);
    for (const name of plan.effects) {
      const dur = voiceDurationMs(audio.effects[name].voice);
      sounding.push([now, now + dur]);
    }
    const active = sounding.filter(([s, e]) => s <= now && e > now).length;
    assert(active <= audio.mix.maxConcurrentEffects, `${active} effects sounding at ${now} ms`);
  }
  // Dropped requests do not reappear later: a quiet frame plays nothing.
  const quiet = d.consume([], 10_000);
  assertEqual(quiet.effects, []);
});

test('director: reset forgets timing', async () => {
  const d = createDirector(await loadAudio());
  assertEqual(d.consume([{ type: 'hit' }], 0).effects, ['hit']);
  assertEqual(d.consume([{ type: 'hit' }], 10).effects, []);
  d.reset();
  assertEqual(d.consume([{ type: 'hit' }], 10).effects, ['hit']);
});

test('director: damage stream is limited too (player-hit every step)', async () => {
  const audio = await loadAudio();
  const d = createDirector(audio);
  let n = 0;
  for (let f = 0; f < 60; f++) if (d.consume([{ type: 'player-hit', amount: 1 }], f * (1000 / 60)).effects.length) n++;
  assert(n <= Math.ceil(1000 / audio.effects.damage.minIntervalMs), `${n} damage sounds in 1 s`);
});

test('director: tempo never decreases and is ≥ 30% faster at level 20 (A4)', async () => {
  const audio = await loadAudio();
  let prev = 0;
  for (let l = 1; l <= 20; l++) {
    const bpm = bpmForLevel(audio, l);
    assert(bpm >= prev, `bpm fell at level ${l}`);
    prev = bpm;
  }
  assertEqual(bpmForLevel(audio, 1), audio.music.bpmStart);
  assertEqual(bpmForLevel(audio, 20), audio.music.bpmEnd);
  assert(bpmForLevel(audio, 20) >= 1.3 * bpmForLevel(audio, 1));
});

test('director: a layer joins at every enemy debut level (A4, FR-007)', async () => {
  const audio = await loadAudio();
  const game = await loadGameData();
  assert(layersForLevel(audio, 1).length > 0, 'music audible at level 1');
  for (const e of game.enemies) {
    if (e.debutLevel === 1) continue;
    assert(layersForLevel(audio, e.debutLevel).length > layersForLevel(audio, e.debutLevel - 1).length,
      `no new layer at level ${e.debutLevel}`);
  }
  for (let l = 2; l <= 20; l++) assert(layersForLevel(audio, l).length >= layersForLevel(audio, l - 1).length);
});

test('director: incident sounds always play, even with 8 effects sounding (U7, 004 FR-017)', async () => {
  const audio = await loadAudio();
  for (const name of Object.keys(audio.effects)) audio.effects[name].minIntervalMs = 0;
  const d = createDirector(audio);
  const busy = ['fire', 'pulse', 'player-hit', 'hit', 'enemy-defeated', 'pickup', 'level-up'].map((type) => ({ type, debuts: [] }));
  d.consume(busy, 0);
  d.consume([{ type: 'difficulty-up', level: 4, debuts: ['x'] }], 1);
  let plan = d.consume([{ type: 'incident-arrived', incidentId: 'route-leak' }, ...busy], 2);
  assert(plan.effects.includes('incidentAlarm'), JSON.stringify(plan));
  assertEqual(plan.incidentActive, true);
  plan = d.consume([{ type: 'incident-arrived', incidentId: 'core-switch-failure' }], 3);
  plan = d.consume([{ type: 'incident-resolved', incidentId: 'route-leak' }, ...busy], 4);
  assert(plan.effects.includes('incidentResolved'));
  assertEqual(plan.incidentActive, true, 'one still active');
  plan = d.consume([{ type: 'incident-resolved', incidentId: 'core-switch-failure' }], 5);
  assertEqual(plan.incidentActive, false);
  assertEqual(d.counts.incidentAlarm, 2);
  assertEqual(d.counts.incidentResolved, 2);
  d.consume([{ type: 'incident-arrived', incidentId: 'x' }], 6);
  d.reset();
  assertEqual(d.consume([], 7).incidentActive, false, 'reset clears the incident count');
});

test('director: the incident layer is not a level layer (U7)', async () => {
  const audio = await loadAudio();
  for (let l = 1; l <= 20; l++) assert(!layersForLevel(audio, l).some((x) => x.trigger === 'incident'));
});

// Feature 006 (T040): the new tools sound through the existing effects.
test('director: Null Route placement plays pulse; a Traceroute chain plays fire (feature 006)', async () => {
  let d = createDirector(await loadAudio());
  assertEqual(d.consume([{ type: 'zone-placed', x: 0, y: 0, radius: 60, duration: 2.5 }], 1000).effects, ['pulse']);
  d = createDirector(await loadAudio());
  const chainStep = [{ type: 'chain', toolId: 'traceroute', points: [] }, { type: 'fire', toolId: 'traceroute' }];
  assertEqual(d.consume(chainStep, 1000).effects, ['fire'], 'chain itself is silent; its fire event sounds');
});
