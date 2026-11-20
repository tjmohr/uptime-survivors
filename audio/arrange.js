// Drum & bass arrangement (feature 007): every musical decision, as pure functions and a small state
// machine. No browser APIs — synth.js plays what this module decides, and tests run it in jsc.
// Rules: specs/007-drum-and-bass-music/research.md (M2–M6, M9) and data-model.md.

import { createRng } from '../engine/rng.js';
import { LEVELS } from './content.js';

const ORDER_SALT = 0x5eed0174; // decorrelates the soundtrack from the run's own random numbers (M3)

// The run's soundtrack: a seed-derived shuffle of the song ids. Uses its own generator; never run.rng.
export function songOrder(seed, songs) {
  const rng = createRng(((seed >>> 0) ^ ORDER_SALT) >>> 0);
  const ids = songs.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

const clampLevel = (level) => Math.min(LEVELS, Math.max(1, Math.floor(level)));
export const blockForLevel = (level, levelsPerSong = 4) => Math.floor((clampLevel(level) - 1) / levelsPerSong);
export const stageForLevel = (level, levelsPerSong = 4) => ((clampLevel(level) - 1) % levelsPerSong) + 1;
export const cycleBarOf = (songBar, music) => (songBar % music.cycleBars) + 1;

const DRUM_ROLES = new Set(['drums', 'fill', 'riser']);
export const isDrumRole = (role) => DRUM_ROLES.has(role);

// The parts that may sound in one bar of a song, each with the step range it may play [fromStep, toStep).
// Cumulative stages; the incident part only while an incident is active. 32-bar phrase cycle (M5,
// FR-013a/b): drums stop at step 8 on fill bars (8, 16, 24) and rest through the breakdown (29–32);
// fills play steps 8–15 of fill bars (32 included); the riser plays on bar 32 only. Bass, music and
// incident parts play through breakdowns.
export function partsForBar(song, songBar, stage, incident, music) {
  const steps = music.stepsPerBar;
  const cycleBar = cycleBarOf(songBar, music);
  const fillBar = music.fillBars.includes(cycleBar);
  const breakdown = music.breakdownBars.includes(cycleBar);
  const lastBar = cycleBar === music.cycleBars;
  const out = [];
  for (const part of song.parts) {
    if (part.role === 'incident') {
      if (incident) out.push({ part, fromStep: 0, toStep: steps });
      continue;
    }
    if (part.stage > stage) continue;
    if (part.role === 'drums') {
      if (!breakdown) out.push({ part, fromStep: 0, toStep: fillBar ? steps / 2 : steps });
    } else if (part.role === 'fill') {
      if (fillBar) out.push({ part, fromStep: steps / 2, toStep: steps });
    } else if (part.role === 'riser') {
      if (lastBar) out.push({ part, fromStep: 0, toStep: steps });
    } else {
      out.push({ part, fromStep: 0, toStep: steps });
    }
  }
  return out;
}

// For each part: the index of the hit at (bar of its pattern, step), so a pitched part's note list lines
// up with its hits and restarts with the pattern (M6).
const hitIndexCache = new WeakMap();
function hitIndex(part) {
  let table = hitIndexCache.get(part);
  if (!table) {
    let n = 0;
    table = part.pattern.map((bar) => [...bar].map((ch) => (ch === '.' ? -1 : n++)));
    hitIndexCache.set(part, table);
  }
  return table;
}

// The hits on one step: [{part, gainScale, note}] where note is a semitone offset, a chord (array),
// or null for unpitched parts.
export function hitsForStep(entries, songBar, step, music) {
  const hits = [];
  for (const { part, fromStep, toStep } of entries) {
    if (step < fromStep || step >= toStep) continue;
    const barIndex = songBar % part.pattern.length;
    const ch = part.pattern[barIndex][step];
    if (ch !== 'x' && ch !== 'o') continue;
    const k = hitIndex(part)[barIndex][step];
    hits.push({ part, gainScale: ch === 'o' ? music.ghostGain : 1, note: part.notes ? part.notes[k] : null });
  }
  return hits;
}

// Frequency of a note entry (semitones above the song's root).
export const noteHz = (rootHz, semitones) => rootHz * 2 ** (semitones / 12);

// Bus gains at a point in the 2-bar crossfade (M9): equal-power main fade across both bars; the bass is
// swapped at the bar-2 line, so both basses are never up together. fraction is the position in that bar.
export function crossfadeGains(barInFade, fraction = 0) {
  const t = Math.min(1, Math.max(0, (barInFade + fraction) / 2));
  const second = barInFade >= 1;
  return {
    outMain: Math.cos((t * Math.PI) / 2),
    inMain: Math.sin((t * Math.PI) / 2),
    outBass: second ? 0 : 1,
    inBass: second ? 1 : 0,
  };
}

// Sequencer state (data-model.md › Arrangement state). The caller plays bar 0 after start(), then calls
// advanceBar() at every following bar line; queued level and incident changes apply there.
export function createArrangement(music) {
  const perSong = music.levelsPerSong;
  const byId = new Map(music.songs.map((s) => [s.id, s]));
  let st = null;

  const current = () => st.live[st.live.length - 1];

  function start(seed, level = 1, order = null) {
    const lvl = clampLevel(level);
    const ord = order ?? songOrder(seed, music.songs);
    const songId = ord[blockForLevel(lvl, perSong)];
    st = {
      order: ord,
      bar: 0,
      level: lvl,
      pendingLevel: null,
      incident: false,
      pendingIncident: null,
      live: [{ songId, startBar: 0, stage: stageForLevel(lvl, perSong) }],
      crossfade: null,
      songStarts: [{ songId, bar: 0, level: lvl }],
    };
    return api.state();
  }

  function queueLevel(level) {
    const lvl = clampLevel(level);
    st.pendingLevel = lvl === st.level ? null : lvl;
  }

  function queueIncident(value) {
    st.pendingIncident = value === st.incident ? null : Boolean(value);
  }

  // Move to the next bar line and apply what was queued. Returns what changed, for synth's automation.
  function advanceBar() {
    st.bar += 1;
    const changes = { ended: null, cut: null, crossfade: null, songStart: null };
    if (st.crossfade && st.bar >= st.crossfade.startBar + music.crossfadeBars) {
      changes.ended = st.crossfade.from;
      st.live = st.live.filter((s) => s.songId !== st.crossfade.from);
      st.crossfade = null;
    }
    if (st.pendingIncident !== null) {
      st.incident = st.pendingIncident;
      st.pendingIncident = null;
    }
    if (st.pendingLevel !== null) {
      const lvl = st.pendingLevel;
      st.pendingLevel = null;
      const newBlock = blockForLevel(lvl, perSong);
      const oldBlock = blockForLevel(st.level, perSong);
      st.level = lvl;
      if (newBlock === oldBlock) {
        current().stage = stageForLevel(lvl, perSong);
      } else {
        if (st.crossfade) {
          // A second change mid-fade (FR-009): cut the outgoing song; the incoming one becomes outgoing.
          changes.cut = st.crossfade.from;
          st.live = st.live.filter((s) => s.songId !== st.crossfade.from);
        }
        const from = current().songId;
        const songId = st.order[newBlock];
        st.live.push({ songId, startBar: st.bar, stage: stageForLevel(lvl, perSong) });
        st.crossfade = { from, to: songId, startBar: st.bar };
        st.songStarts.push({ songId, bar: st.bar, level: lvl });
        changes.crossfade = { ...st.crossfade };
        changes.songStart = songId;
      }
    }
    return changes;
  }

  // What each live song plays in the current bar, with the bass swap applied (FR-008a): the outgoing
  // song has no bass after crossfade bar 1, the incoming song none before bar 2.
  function barPlan() {
    return st.live.map((s) => {
      const song = byId.get(s.songId);
      const songBar = st.bar - s.startBar;
      let entries = partsForBar(song, songBar, s.stage, st.incident, music);
      let role = 'current';
      if (st.crossfade) {
        const barInFade = st.bar - st.crossfade.startBar;
        if (s.songId === st.crossfade.from) {
          role = 'outgoing';
          if (barInFade >= 1) entries = entries.filter((e) => e.part.role !== 'bass');
        } else if (s.songId === st.crossfade.to && barInFade < 1) {
          entries = entries.filter((e) => e.part.role !== 'bass');
        }
      }
      return { song, songBar, stage: s.stage, role, entries };
    });
  }

  // Preview page only (T038): make the next bar of the current song be `cycleBar` of its 32-bar cycle.
  function jumpTo(cycleBar) {
    current().startBar = st.bar + 1 - (Math.max(1, Math.min(music.cycleBars, cycleBar)) - 1);
  }

  const api = {
    start,
    jumpTo,
    queueLevel,
    queueIncident,
    advanceBar,
    barPlan,
    live: () => st.live.map((s) => ({ ...s, role: st.crossfade && s.songId === st.crossfade.from ? 'outgoing' : 'current' })),
    state() {
      const cur = current();
      return {
        order: [...st.order],
        bar: st.bar,
        level: st.level,
        block: blockForLevel(st.level, perSong),
        stage: cur.stage,
        songId: cur.songId,
        cycleBar: cycleBarOf(st.bar - cur.startBar, music),
        incident: st.incident,
        crossfade: st.crossfade ? { ...st.crossfade } : null,
        liveSongs: st.live.map((s) => s.songId),
        songStarts: st.songStarts.map((s) => ({ ...s })),
      };
    },
  };
  return api;
}
