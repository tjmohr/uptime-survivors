// Feature 007 — drum & bass arrangement rules (specs/007-drum-and-bass-music/quickstart.md, M-U1…M-U9).
import { test, assert, assertEqual, assertApprox, loadGameData, readSource } from './harness.js';
import { validateAudioData, SONG_STYLES } from '../audio/content.js';
import {
  songOrder, blockForLevel, stageForLevel, cycleBarOf, partsForBar, hitsForStep, crossfadeGains, createArrangement,
} from '../audio/arrange.js';
import { createRun, step } from '../engine/run.js';
import { hashRun } from '../engine/hash.js';

let cached = null;
async function loadAudio() {
  if (!cached) cached = await readSource('data/audio.json');
  return JSON.parse(cached);
}

// Run an arrangement bar by bar: levelsByBar[i] is the level in force from bar i (queued during bar i − 1).
function simulate(music, seed, levelsByBar) {
  const arr = createArrangement(music);
  arr.start(seed, levelsByBar[0] ?? 1);
  const bars = [{ state: arr.state(), plan: arr.barPlan(), changes: null }];
  for (let i = 1; i < levelsByBar.length; i++) {
    arr.queueLevel(levelsByBar[i]);
    const changes = arr.advanceBar();
    bars.push({ state: arr.state(), plan: arr.barPlan(), changes });
  }
  return bars;
}

// ---- M-U1: shipped data -----------------------------------------------------------------------
test('music: shipped audio data validates; 174 BPM; five styles; ≥ 3 speaker songs (M-U1)', async () => {
  const audio = await loadAudio();
  const result = validateAudioData(audio, await loadGameData());
  assert(result.ok, `validation errors: ${JSON.stringify(result.errors)}`);
  assertEqual(audio.schemaVersion, 2);
  assertEqual(audio.music.bpm, 174, 'fixed tempo (FR-001)');
  assertEqual(audio.music.songs.map((s) => s.style).sort(), [...SONG_STYLES].sort(), 'one song per style (FR-003)');
  assert(audio.music.songs.filter((s) => s.bassAudibility === 'speakers').length >= 3, '≥ 3 speaker songs (FR-002a)');
});

// ---- M-U3: blocks and stages ------------------------------------------------------------------
test('music: block and stage for every level; songs change exactly at 5, 9, 13, 17 (M-U3)', () => {
  const blocks = [];
  for (let level = 1; level <= 20; level++) {
    blocks.push(blockForLevel(level));
    assertEqual(stageForLevel(level), ((level - 1) % 4) + 1, `stage at level ${level}`);
  }
  assertEqual(blocks, [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
  const changes = [];
  for (let level = 2; level <= 20; level++) if (blockForLevel(level) !== blockForLevel(level - 1)) changes.push(level);
  assertEqual(changes, [5, 9, 13, 17]);
  assertEqual(blockForLevel(0), 0, 'clamped below');
  assertEqual(blockForLevel(25), 4, 'clamped above');
});

// ---- M-U2: song order -------------------------------------------------------------------------
test('music: song order is a seeded permutation; seeds 1–30 vary it (M-U2, SC-002, SC-003)', async () => {
  const songs = (await loadAudio()).music.songs;
  const ids = songs.map((s) => s.id).sort();
  const orders = new Set();
  const firsts = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const order = songOrder(seed, songs);
    assertEqual([...order].sort(), ids, `permutation for seed ${seed}`);
    assertEqual(songOrder(seed, songs), order, `same order again for seed ${seed}`);
    orders.add(order.join(','));
    firsts.add(order[0]);
  }
  assert(orders.size >= 10, `only ${orders.size} distinct orders across seeds 1–30`);
  assertEqual(firsts.size, songs.length, 'every song opens the run for some seed');
});

test('music: a full run plays each song once, in the seed order (SC-002)', async () => {
  const music = (await loadAudio()).music;
  // 6 bars per level, levels 1..20.
  const levels = [];
  for (let level = 1; level <= 20; level++) for (let b = 0; b < 6; b++) levels.push(level);
  const bars = simulate(music, 7, levels);
  const starts = bars[bars.length - 1].state.songStarts;
  assertEqual(starts.map((s) => s.level), [1, 5, 9, 13, 17]);
  assertEqual(starts.map((s) => s.songId), songOrder(7, music.songs));
});

// ---- M-U6: crossfade gains ---------------------------------------------------------------------
test('music: crossfade gains are equal-power for main and a step swap for bass (M-U6, FR-008a)', () => {
  for (let i = 0; i <= 20; i++) {
    const pos = (i / 20) * 2;
    const bar = Math.min(1, Math.floor(pos));
    const g = crossfadeGains(bar, pos - bar);
    assertApprox(g.outMain ** 2 + g.inMain ** 2, 1, 1e-9, `equal power at ${pos}`);
    assert(!(g.outBass > 0 && g.inBass > 0), `both basses up at ${pos}`);
  }
  assertEqual(crossfadeGains(0, 0).outMain, 1);
  assertEqual(crossfadeGains(0, 0).inMain, 0);
  assertApprox(crossfadeGains(1, 1).inMain, 1, 1e-9);
  assertEqual([crossfadeGains(0, 0.9).outBass, crossfadeGains(0, 0.9).inBass], [1, 0]);
  assertEqual([crossfadeGains(1, 0).outBass, crossfadeGains(1, 0).inBass], [0, 1]);
});

// ---- M-U7: arrangement state machine -----------------------------------------------------------
test('music: a block change crossfades for exactly 2 bars with the bass swapped (M-U7, FR-008, FR-008a)', async () => {
  const music = (await loadAudio()).music;
  const bars = simulate(music, 3, [1, 1, 4, 4, 5, 5, 5, 5, 5]);
  // Level 5 is queued during bar 3 → the new song starts on bar 4.
  const b4 = bars[4];
  assert(b4.changes.crossfade && b4.changes.crossfade.startBar === 4, 'crossfade starts on the bar after the change');
  assertEqual(b4.state.liveSongs.length, 2);
  const bass = (plan, role) => plan.filter((p) => p.role === role).flatMap((p) => p.entries).filter((e) => e.part.role === 'bass');
  const incoming = (bar) => bar.plan.filter((p) => p.role === 'current').flatMap((p) => p.entries).filter((e) => e.part.role === 'bass');
  assert(bass(b4.plan, 'outgoing').length > 0, 'outgoing bass plays in crossfade bar 1');
  assertEqual(incoming(b4).length, 0, 'no incoming bass in crossfade bar 1');
  assertEqual(bass(bars[5].plan, 'outgoing').length, 0, 'no outgoing bass in crossfade bar 2');
  assert(incoming(bars[5]).length > 0, 'incoming bass enters on crossfade bar 2');
  assertEqual(bars[6].changes.ended, b4.changes.crossfade.from, 'outgoing song removed after 2 bars');
  assertEqual(bars[6].state.liveSongs.length, 1);
  assertEqual(bars[6].state.crossfade, null);
  // The outgoing song keeps the stage it had (4), the incoming song starts at stage 1.
  assertEqual(b4.plan.find((p) => p.role === 'outgoing').stage, 4);
  assertEqual(b4.state.stage, 1);
});

test('music: level changes apply on the next bar line; two levels in one bar both count (M-U7, FR-011)', async () => {
  const music = (await loadAudio()).music;
  const arr = createArrangement(music);
  arr.start(1, 1);
  arr.queueLevel(2);
  assertEqual(arr.state().stage, 1, 'not before the bar line');
  arr.queueLevel(3); // a second level inside the same bar
  arr.advanceBar();
  assertEqual(arr.state().stage, 3, 'latest level applied at the bar line');
  const parts = arr.barPlan()[0].entries.map((e) => e.part.id);
  const song = music.songs.find((s) => s.id === arr.state().songId);
  for (const p of song.parts) {
    if (p.stage && p.stage <= 3 && p.role !== 'fill' && p.role !== 'riser') assert(parts.includes(p.id), `stage-${p.stage} part ${p.id} joined`);
  }
});

test('music: a song change during a crossfade cuts the outgoing song; never more than two live (M-U7, FR-009)', async () => {
  const music = (await loadAudio()).music;
  const arr = createArrangement(music);
  arr.start(9, 4);
  const order = arr.state().order;
  arr.queueLevel(5);
  arr.advanceBar(); // crossfade order[0] → order[1]
  arr.queueLevel(9);
  const changes = arr.advanceBar(); // next block during the crossfade
  assertEqual(changes.cut, order[0]);
  assertEqual(arr.state().liveSongs, [order[1], order[2]]);
  assertEqual(arr.state().crossfade.from, order[1]);
  for (let i = 0; i < 4; i++) {
    arr.advanceBar();
    assert(arr.state().liveSongs.length <= 2);
  }
  assertEqual(arr.state().liveSongs, [order[2]]);
});

test('music: hits follow the pattern; ghost hits are quieter; notes line up with hits (M-U6/M6)', () => {
  const music = { ghostGain: 0.35, stepsPerBar: 16 };
  const part = { id: 'b', role: 'bass', stage: 1, pattern: ['x...o...........', 'x...............'], notes: [0, 3, 7] };
  const entries = [{ part, fromStep: 0, toStep: 16 }];
  const at = (bar, s) => hitsForStep(entries, bar, s, music);
  assertEqual(at(0, 0).map((h) => [h.gainScale, h.note]), [[1, 0]]);
  assertEqual(at(0, 4).map((h) => [h.gainScale, h.note]), [[0.35, 3]]);
  assertEqual(at(0, 1), []);
  assertEqual(at(1, 0)[0].note, 7, 'second bar');
  assertEqual(at(2, 0)[0].note, 0, 'pattern loops with its notes');
  assertEqual(hitsForStep([{ part, fromStep: 8, toStep: 16 }], 0, 4, music), [], 'outside the step range');
  assertEqual(cycleBarOf(0, { cycleBars: 32 }), 1);
  assertEqual(cycleBarOf(33, { cycleBars: 32 }), 2);
});

test('music: stages are cumulative; the incident part plays only during an incident', async () => {
  const music = (await loadAudio()).music;
  for (const song of music.songs) {
    let prev = -1;
    for (let stage = 1; stage <= 4; stage++) {
      const ids = partsForBar(song, 0, stage, false, music).map((e) => e.part.id);
      assert(ids.length > prev, `${song.id}: stage ${stage} adds parts`);
      assert(!ids.some((id) => song.parts.find((p) => p.id === id).role === 'incident'), `${song.id}: no incident part`);
      prev = ids.length;
    }
    const withIncident = partsForBar(song, 0, 1, true, music).map((e) => e.part.role);
    assert(withIncident.includes('incident'), `${song.id}: incident part joins`);
  }
});

// ---- M-U9: purity and determinism ---------------------------------------------------------------
test('music: arrange.js uses no browser APIs; the soundtrack never touches the game RNG (M-U9, FR-007)', async () => {
  const banned = /Math\.random|\bdocument\b|\bwindow\b|\bfetch\b|AudioContext|setTimeout|setInterval|performance\.now|Date\.now/;
  const src = await readSource('audio/arrange.js');
  const m = src.match(banned);
  assert(!m, `audio/arrange.js contains '${m && m[0]}'`);
  const data = await loadGameData();
  const music = (await loadAudio()).music;
  const run = (withMusic) => {
    const r = createRun(data, { seed: 11 });
    for (let i = 0; i < 600; i++) {
      if (withMusic && i % 60 === 0) {
        songOrder(r.seed, music.songs);
        createArrangement(music).start(r.seed, r.difficultyLevel);
      }
      step(r, { dx: 1, dy: 0 });
      r.events.length = 0;
    }
    return hashRun(r);
  };
  assertEqual(run(true), run(false));
});

// ---- M-U4 / M-U5: build-up stages and the 32-bar phrase cycle (US3) -----------------------------
test('music: stage 1 is drums and bass only (noise-only risers); parts never decrease (M-U4, FR-010, SC-005)', async () => {
  const music = (await loadAudio()).music;
  for (const song of music.songs) {
    for (const p of song.parts.filter((x) => x.stage === 1)) {
      assert(['drums', 'fill', 'riser', 'bass'].includes(p.role), `${song.id}/${p.id} at stage 1`);
      if (p.role === 'riser') assertEqual(p.voice.wave, 'noise', `${song.id}/${p.id}: stage-1 riser is noise-only`);
    }
    // Over a whole cycle, the set of parts heard at stage s+1 contains the set at stage s.
    for (let s = 1; s < 4; s++) {
      for (let bar = 0; bar < 32; bar++) {
        const lo = partsForBar(song, bar, s, false, music).map((e) => e.part.id);
        const hi = partsForBar(song, bar, s + 1, false, music).map((e) => e.part.id);
        assert(lo.every((id) => hi.includes(id)), `${song.id}: stage ${s + 1} drops a part at bar ${bar + 1}`);
      }
    }
  }
});

test('music: fills on bars 8/16/24/32, breakdown on 29–32, drums back on the drop (M-U5, FR-013a)', async () => {
  const music = (await loadAudio()).music;
  for (const song of music.songs) {
    const at = (songBar, role) => partsForBar(song, songBar, 4, false, music).filter((e) => e.part.role === role);
    for (let cycle = 0; cycle < 2; cycle++) {
      for (let bar = 1; bar <= 32; bar++) {
        const songBar = cycle * 32 + bar - 1;
        const drums = at(songBar, 'drums');
        const fills = at(songBar, 'fill');
        const risers = at(songBar, 'riser');
        const label = `${song.id} cycle bar ${bar}`;
        if (bar >= 29) assertEqual(drums.length, 0, `${label}: drums rest in the breakdown`);
        else if ([8, 16, 24].includes(bar)) assert(drums.length > 0 && drums.every((e) => e.toStep === 8), `${label}: drums stop at step 8`);
        else assert(drums.length > 0 && drums.every((e) => e.fromStep === 0 && e.toStep === 16), `${label}: full drums`);
        if ([8, 16, 24, 32].includes(bar)) assert(fills.length > 0 && fills.every((e) => e.fromStep === 8), `${label}: fill`);
        else assertEqual(fills.length, 0, `${label}: no fill`);
        if (bar !== 32) assertEqual(risers.length, 0, `${label}: no riser`);
        assert(at(songBar, 'bass').length > 0, `${label}: bass keeps playing`);
      }
    }
  }
});

test('music: a stage change during a breakdown adds its drums first at the drop (M-U5, FR-013b)', async () => {
  const music = (await loadAudio()).music;
  const song = music.songs.find((s) => s.parts.some((p) => p.role === 'drums' && p.stage === 2));
  const stage2Drums = song.parts.filter((p) => p.role === 'drums' && p.stage === 2).map((p) => p.id);
  const ids = (songBar, stage) => partsForBar(song, songBar, stage, false, music).map((e) => e.part.id);
  assert(!stage2Drums.some((id) => ids(29, 2).includes(id)), 'stage-2 drums silent in the breakdown (bar 30)');
  assert(stage2Drums.every((id) => ids(32, 2).includes(id)), 'stage-2 drums heard at the drop (bar 33)');
  // The incident part plays through breakdowns.
  assert(partsForBar(song, 29, 1, true, music).some((e) => e.part.role === 'incident'), 'incident part in the breakdown');
});

test('music: starting above level 1 places the song and stage for that level (US3 scenario 5)', async () => {
  const music = (await loadAudio()).music;
  for (const [level, block, stage] of [[6, 1, 2], [17, 4, 1], [20, 4, 4]]) {
    const arr = createArrangement(music);
    arr.start(5, level);
    const st = arr.state();
    assertEqual(st.songId, songOrder(5, music.songs)[block], `song at level ${level}`);
    assertEqual(st.stage, stage, `stage at level ${level}`);
    assertEqual(st.songStarts, [{ songId: st.songId, bar: 0, level }]);
  }
});
