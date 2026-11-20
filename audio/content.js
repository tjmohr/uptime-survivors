// Validates data/audio.json before any run starts (FR-018, C6). Pure: no browser APIs.
// Rules: specs/002-procedural-audio/data-model.md and contracts/audio-data.md; the music section and
// the Voice extensions follow specs/007-drum-and-bass-music/data-model.md (schemaVersion 2).
// Never throws; returns every error found as {path, id, message}, like engine/content.js.

export const EFFECT_NAMES = ['fire', 'pulse', 'damage', 'hit', 'defeat', 'pickup', 'levelUp', 'newThreat', 'win', 'loss',
  'incidentAlarm', 'incidentResolved']; // the last two added by feature 004 (Major Incidents)
export const WAVES = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'];
export const STEPS_PER_BAR = 16;
export const LEVELS = 20;
const LONG_EFFECTS = new Set(['win', 'loss', 'incidentAlarm', 'incidentResolved']);
const EFFECT_MAX_MS = 1000;
const LONG_EFFECT_MAX_MS = 3000;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const TOP_FIELDS = ['schemaVersion', 'defaults', 'mix', 'effects', 'music'];
const DEFAULTS_FIELDS = ['musicVolume', 'effectsVolume', 'muted'];
const MIX_FIELDS = ['masterGain', 'duckFactor', 'maxConcurrentEffects'];
const EFFECT_FIELDS = ['minIntervalMs', 'voice'];
const VOICE_FIELDS = ['wave', 'gain', 'attackMs', 'filter', 'notes'];
const FILTER_FIELDS = ['type', 'hz'];
const NOTE_FIELDS = ['freq', 'toFreq', 'ms'];
const VOICE_FIELDS_007 = ['unison', 'detuneCents', 'lfo', 'drive']; // feature 007 Voice extensions
const FILTER_FIELDS_007 = ['toHz', 'q'];
const LFO_FIELDS = ['target', 'steps', 'depth'];
export const LFO_TARGETS = ['filter', 'gain'];

// Feature 007 music (data-model.md › Music, Song, Part).
const MUSIC_FIELDS = ['bpm', 'stepsPerBar', 'levelsPerSong', 'crossfadeBars', 'cycleBars', 'fillBars', 'breakdownBars',
  'ghostGain', 'songs'];
const SONG_FIELDS = ['id', 'name', 'style', 'rootHz', 'bassAudibility', 'gain', 'parts'];
const PART_FIELDS = ['id', 'role', 'instrument', 'register', 'stage', 'pattern', 'notes', 'voice'];
export const SONG_STYLES = ['liquid', 'jump-up', 'neurofunk', 'jungle', 'dancefloor'];
export const PART_ROLES = ['drums', 'fill', 'riser', 'bass', 'music', 'incident'];
export const DRUM_INSTRUMENTS = ['kick', 'snare', 'clap', 'hat', 'perc'];
export const BASS_REGISTERS = ['sub', 'upper'];
export const BASS_AUDIBILITY = ['speakers', 'headphones'];
export const SONG_COUNT = 5;
const PITCHED_ROLES = new Set(['bass', 'music', 'incident']);
const PATTERN_BARS = [1, 2, 4, 8];
const FIXED = { stepsPerBar: STEPS_PER_BAR, levelsPerSong: 4, crossfadeBars: 2, cycleBars: 32 };
const FILL_BARS = [8, 16, 24, 32];
const BREAKDOWN_BARS = [29, 30, 31, 32];
const MAX_PARTS = 14;
const MIN_PARTS = 4;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Total duration of a voice in ms (sum of its notes); 0 if malformed.
export function voiceDurationMs(voice) {
  if (!isObject(voice) || !Array.isArray(voice.notes)) return 0;
  return voice.notes.reduce((sum, n) => sum + (isObject(n) && isNum(n.ms) ? n.ms : 0), 0);
}

// Length of one sequencer step in ms at a tempo.
export const stepMs = (bpm) => 60000 / bpm / 4;

export function validateAudioData(raw, gameData) {
  const errors = [];
  const add = (path, id, message) => errors.push({ path, id: id ?? null, message });
  const fields = (obj, allowed, path, id) => {
    for (const key of Object.keys(obj)) if (!allowed.includes(key)) add(`${path}.${key}`, id, `unknown field '${key}'`);
  };
  // opts: {gt, min, max, lt, integer, optional}
  const num = (obj, key, path, id, opts = {}) => {
    const p = `${path}.${key}`;
    const v = obj[key];
    if (v === undefined) {
      if (!opts.optional) add(p, id, `missing required field '${key}'`);
      return false;
    }
    if (!isNum(v)) return add(p, id, `'${key}' must be a number`), false;
    if (opts.integer && !Number.isInteger(v)) return add(p, id, `'${key}' must be a whole number`), false;
    if (opts.gt !== undefined && !(v > opts.gt)) return add(p, id, `'${key}' must be greater than ${opts.gt}`), false;
    if (opts.lt !== undefined && !(v < opts.lt)) return add(p, id, `'${key}' must be less than ${opts.lt}`), false;
    if (opts.min !== undefined && v < opts.min) return add(p, id, `'${key}' must be at least ${opts.min}`), false;
    if (opts.max !== undefined && v > opts.max) return add(p, id, `'${key}' must be at most ${opts.max}`), false;
    return true;
  };
  const obj = (parent, key, path, id) => {
    const v = parent[key];
    if (!isObject(v)) {
      add(`${path}.${key}`.replace(/^\./, ''), id, v === undefined ? `missing required field '${key}'` : `'${key}' must be an object`);
      return null;
    }
    return v;
  };

  // Voice and Note (data-model.md › Voice).
  const voice = (v, path, id, maxMs) => {
    if (!isObject(v)) return add(path, id, v === undefined ? "missing required field 'voice'" : "'voice' must be an object");
    fields(v, [...VOICE_FIELDS, ...VOICE_FIELDS_007], path, id);
    if (!WAVES.includes(v.wave)) add(`${path}.wave`, id, `'wave' must be one of ${WAVES.join(', ')}`);
    num(v, 'gain', path, id, { gt: 0, max: 1 });
    num(v, 'attackMs', path, id, { min: 0 });
    if (v.filter !== undefined) {
      const fp = `${path}.filter`;
      if (!isObject(v.filter)) add(fp, id, "'filter' must be an object");
      else {
        fields(v.filter, [...FILTER_FIELDS, ...FILTER_FIELDS_007], fp, id);
        if (!FILTER_TYPES.includes(v.filter.type)) add(`${fp}.type`, id, `'type' must be one of ${FILTER_TYPES.join(', ')}`);
        num(v.filter, 'hz', fp, id, { gt: 0 });
        num(v.filter, 'toHz', fp, id, { gt: 0, optional: true });
        num(v.filter, 'q', fp, id, { min: 0.1, max: 20, optional: true });
      }
    }
    // Feature 007 extensions (data-model.md › Voice).
    if (num(v, 'unison', path, id, { min: 1, max: 3, integer: true, optional: true }) && v.unison > 1 && v.wave === 'noise') {
      add(`${path}.unison`, id, "'unison' cannot be used with 'noise'");
    }
    num(v, 'detuneCents', path, id, { min: 0, max: 50, optional: true });
    num(v, 'drive', path, id, { min: 0, max: 1, optional: true });
    if (v.lfo !== undefined) {
      const lp = `${path}.lfo`;
      if (!isObject(v.lfo)) add(lp, id, "'lfo' must be an object");
      else {
        fields(v.lfo, LFO_FIELDS, lp, id);
        if (!LFO_TARGETS.includes(v.lfo.target)) add(`${lp}.target`, id, `'target' must be one of ${LFO_TARGETS.join(', ')}`);
        num(v.lfo, 'steps', lp, id, { min: 1, max: 32, integer: true });
        if (v.lfo.target === 'gain') num(v.lfo, 'depth', lp, id, { min: 0, max: 1 });
        else num(v.lfo, 'depth', lp, id, { min: 0, max: 4000 });
        if (v.lfo.target === 'filter' && v.filter === undefined) add(lp, id, "an 'lfo' with target 'filter' needs a 'filter'");
      }
    }
    if (!Array.isArray(v.notes) || v.notes.length === 0) {
      add(`${path}.notes`, id, "'notes' must be a non-empty list");
      return;
    }
    v.notes.forEach((n, i) => {
      const np = `${path}.notes[${i}]`;
      if (!isObject(n)) return add(np, id, 'note must be an object');
      fields(n, NOTE_FIELDS, np, id);
      num(n, 'freq', np, id, { gt: 0 });
      num(n, 'toFreq', np, id, { gt: 0, optional: true });
      num(n, 'ms', np, id, { gt: 0 });
    });
    const total = voiceDurationMs(v);
    if (maxMs !== undefined && total > maxMs) {
      add(`${path}.notes`, id, `voice lasts ${Math.round(total)} ms; at most ${Math.round(maxMs)} ms allowed`);
    }
  };

  if (!isObject(raw)) {
    add('', null, 'audio data must be a JSON object');
    return { ok: false, errors };
  }
  fields(raw, TOP_FIELDS, '', null);
  for (const e of errors) e.path = e.path.replace(/^\./, '');
  if (raw.schemaVersion !== 2) add('schemaVersion', null, "'schemaVersion' must be 2");

  const defaults = obj(raw, 'defaults', '', null);
  if (defaults) {
    fields(defaults, DEFAULTS_FIELDS, 'defaults', null);
    for (const k of ['musicVolume', 'effectsVolume']) {
      if (num(defaults, k, 'defaults', null, { min: 0, max: 100, integer: true }) && defaults[k] % 10 !== 0) {
        add(`defaults.${k}`, null, `'${k}' must be a multiple of 10`);
      }
    }
    if (typeof defaults.muted !== 'boolean') add('defaults.muted', null, "'muted' must be true or false");
  }

  const mix = obj(raw, 'mix', '', null);
  if (mix) {
    fields(mix, MIX_FIELDS, 'mix', null);
    num(mix, 'masterGain', 'mix', null, { gt: 0, max: 1 });
    num(mix, 'duckFactor', 'mix', null, { gt: 0, lt: 1 });
    num(mix, 'maxConcurrentEffects', 'mix', null, { min: 1, integer: true });
  }

  const effects = obj(raw, 'effects', '', null);
  if (effects) {
    for (const key of Object.keys(effects)) {
      if (!EFFECT_NAMES.includes(key)) add(`effects.${key}`, key, `unknown effect '${key}'`);
    }
    for (const name of EFFECT_NAMES) {
      const p = `effects.${name}`;
      const eff = effects[name];
      if (eff === undefined) { add(p, name, `missing effect '${name}'`); continue; }
      if (!isObject(eff)) { add(p, name, `effect '${name}' must be an object`); continue; }
      fields(eff, EFFECT_FIELDS, p, name);
      num(eff, 'minIntervalMs', p, name, { min: 0 });
      voice(eff.voice, `${p}.voice`, name, LONG_EFFECTS.has(name) ? LONG_EFFECT_MAX_MS : EFFECT_MAX_MS);
    }
  }

  const music = obj(raw, 'music', '', null);
  if (music) validateMusic(music, { add, fields, num, voice });

  return errors.length ? { ok: false, errors } : { ok: true, data: raw };
}

// ---- Feature 007: music (data-model.md › Music, Song, Part) ------------------------------------------
const PATTERN_RE = /^[xo.]{16}$/;
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
const hitCount = (pattern) => pattern.join('').replace(/\./g, '').length;
const noteValues = (notes) => (notes ?? []).flatMap((n) => (Array.isArray(n) ? n : [n]));

function validateMusic(music, { add, fields, num, voice }) {
  fields(music, MUSIC_FIELDS, 'music', null);
  const bpmOk = num(music, 'bpm', 'music', null, { gt: 0 });
  for (const [key, value] of Object.entries(FIXED)) {
    if (music[key] !== value) add(`music.${key}`, null, `'${key}' must be ${value}`);
  }
  if (!sameList(music.fillBars, FILL_BARS)) add('music.fillBars', null, `'fillBars' must be [${FILL_BARS.join(', ')}]`);
  if (!sameList(music.breakdownBars, BREAKDOWN_BARS)) {
    add('music.breakdownBars', null, `'breakdownBars' must be [${BREAKDOWN_BARS.join(', ')}]`);
  }
  num(music, 'ghostGain', 'music', null, { gt: 0, lt: 1 });
  // A music voice may last up to 2 bars at the tempo.
  const maxMs = bpmOk ? (60000 / music.bpm) * 4 * 2 : undefined;

  if (!Array.isArray(music.songs)) {
    add('music.songs', null, "'songs' must be a list");
    return;
  }
  if (music.songs.length !== SONG_COUNT) add('music.songs', null, `exactly ${SONG_COUNT} songs required (found ${music.songs.length})`);
  const songIds = new Set();
  const styleOwner = new Map();
  const signatures = [];
  let speakers = 0;
  music.songs.forEach((song, i) => {
    const p = `music.songs[${i}]`;
    if (!isObject(song)) return add(p, null, 'song must be an object');
    const sid = typeof song.id === 'string' ? song.id : null;
    fields(song, SONG_FIELDS, p, sid);
    if (!sid || !ID_PATTERN.test(sid)) add(`${p}.id`, sid, "'id' must be a kebab-case string");
    else if (songIds.has(sid)) add(`${p}.id`, sid, `duplicate song id '${sid}'`);
    else songIds.add(sid);
    if (typeof song.name !== 'string' || song.name.trim() === '') add(`${p}.name`, sid, "'name' must be a non-empty string");
    if (!SONG_STYLES.includes(song.style)) add(`${p}.style`, sid, `'style' must be one of ${SONG_STYLES.join(', ')}`);
    else if (styleOwner.has(song.style)) add(`${p}.style`, sid, `style '${song.style}' is already used by '${styleOwner.get(song.style)}'`);
    else styleOwner.set(song.style, sid);
    num(song, 'rootHz', p, sid, { min: 30, max: 110 });
    if (!BASS_AUDIBILITY.includes(song.bassAudibility)) {
      add(`${p}.bassAudibility`, sid, `'bassAudibility' must be one of ${BASS_AUDIBILITY.join(', ')}`);
    } else if (song.bassAudibility === 'speakers') speakers += 1;
    num(song, 'gain', p, sid, { gt: 0, max: 1.5 });
    if (!Array.isArray(song.parts)) return add(`${p}.parts`, sid, "'parts' must be a list");
    if (song.parts.length < MIN_PARTS || song.parts.length > MAX_PARTS) {
      add(`${p}.parts`, sid, `a song needs ${MIN_PARTS}–${MAX_PARTS} parts (found ${song.parts.length})`);
    }
    const partIds = new Set();
    const good = [];
    song.parts.forEach((part, j) => {
      const pp = `${p}.parts[${j}]`;
      if (!isObject(part)) return add(pp, sid, 'part must be an object');
      const pid = `${sid}/${typeof part.id === 'string' ? part.id : '?'}`;
      if (validatePart(part, pp, pid, partIds, maxMs, { add, fields, num, voice })) good.push(part);
    });
    if (good.length === song.parts.length) songRules(song, p, sid, add, signatures);
  });
  if (speakers < 3) add('music.songs', null, `at least 3 songs must have bassAudibility 'speakers' (found ${speakers})`);
}

function validatePart(part, pp, pid, partIds, maxMs, { add, fields, num, voice }) {
  const before = { n: 0 };
  const err = (path, msg) => { before.n += 1; add(path, pid, msg); };
  fields(part, PART_FIELDS, pp, pid);
  if (typeof part.id !== 'string' || !ID_PATTERN.test(part.id)) err(`${pp}.id`, "'id' must be a kebab-case string");
  else if (partIds.has(part.id)) err(`${pp}.id`, `duplicate part id '${part.id}'`);
  else partIds.add(part.id);
  if (!PART_ROLES.includes(part.role)) {
    err(`${pp}.role`, `'role' must be one of ${PART_ROLES.join(', ')}`);
    return false;
  }
  if (part.role === 'drums' && !DRUM_INSTRUMENTS.includes(part.instrument)) {
    err(`${pp}.instrument`, `drum parts need 'instrument': one of ${DRUM_INSTRUMENTS.join(', ')}`);
  } else if (part.role !== 'drums' && part.instrument !== undefined && !DRUM_INSTRUMENTS.includes(part.instrument)) {
    err(`${pp}.instrument`, `'instrument' must be one of ${DRUM_INSTRUMENTS.join(', ')}`);
  }
  if (part.register !== undefined) {
    if (part.role !== 'bass') err(`${pp}.register`, "only bass parts have a 'register'");
    else if (!BASS_REGISTERS.includes(part.register)) err(`${pp}.register`, `'register' must be one of ${BASS_REGISTERS.join(', ')}`);
  }
  if (part.role === 'incident') {
    if (part.stage !== undefined) err(`${pp}.stage`, "the incident part has no 'stage'");
  } else if (!num(part, 'stage', pp, pid, { min: 1, max: 4, integer: true })) before.n += 1;
  // Pattern: 1, 2, 4 or 8 bars of 16 steps.
  const pat = part.pattern;
  let patternOk = false;
  if (!Array.isArray(pat) || !PATTERN_BARS.includes(pat.length)) err(`${pp}.pattern`, 'pattern must be 1, 2, 4 or 8 bars');
  else if (!pat.every((bar) => typeof bar === 'string' && PATTERN_RE.test(bar))) {
    err(`${pp}.pattern`, "each pattern bar must be exactly 16 characters of 'x', 'o' or '.'");
  } else if (hitCount(pat) === 0) err(`${pp}.pattern`, 'pattern must contain at least one hit');
  else if (part.role === 'fill' && pat.some((bar) => /[xo]/.test(bar.slice(0, 8)))) {
    err(`${pp}.pattern`, 'fill parts may only hit steps 8–15');
  } else patternOk = true;
  // Notes: one entry per hit for pitched parts.
  if (part.notes === undefined) {
    if (PITCHED_ROLES.has(part.role)) err(`${pp}.notes`, `${part.role} parts need 'notes'`);
  } else if (!Array.isArray(part.notes) || !part.notes.every((n) => (Array.isArray(n)
    ? n.length >= 2 && n.length <= 4 && n.every((x) => isNum(x) && x >= -24 && x <= 48)
    : isNum(n) && n >= -24 && n <= 48))) {
    err(`${pp}.notes`, "'notes' must be semitone offsets (−24…48) or chords of 2–4 offsets");
  } else if (patternOk && part.notes.length !== hitCount(pat)) {
    err(`${pp}.notes`, `${part.notes.length} notes for ${hitCount(pat)} hits`);
  }
  voice(part.voice, `${pp}.voice`, pid, maxMs);
  // Song-level rules only run on parts whose structure is sound (otherwise they would report noise).
  return before.n === 0 && patternOk && isObject(part.voice);
}

function songRules(song, p, sid, add, signatures) {
  const parts = song.parts;
  const stage1 = parts.filter((x) => x.stage === 1);
  const bad = stage1.find((x) => !['drums', 'fill', 'riser', 'bass'].includes(x.role));
  if (bad) add(`${p}.parts`, `${sid}/${bad.id}`, 'stage 1 may only contain drums, fill, riser and bass parts');
  const synthRiser = stage1.find((x) => x.role === 'riser' && x.voice.wave !== 'noise');
  if (synthRiser) add(`${p}.parts`, `${sid}/${synthRiser.id}`, "a stage-1 riser must use wave 'noise'");
  const has = (pred) => parts.some(pred);
  if (!has((x) => x.stage === 1 && x.role === 'drums' && x.instrument === 'kick')) add(`${p}.parts`, sid, 'stage 1 needs a kick');
  const backbeat = stage1.filter((x) => x.role === 'drums' && (x.instrument === 'snare' || x.instrument === 'clap'));
  if (backbeat.length === 0) add(`${p}.parts`, sid, 'stage 1 needs a snare or clap');
  else if (!backbeat.some((x) => x.pattern.every((bar) => bar[4] === 'x' && bar[12] === 'x'))) {
    add(`${p}.parts`, sid, 'the stage-1 snare or clap must hit steps 4 and 12 of every bar');
  }
  if (!has((x) => x.stage === 1 && x.role === 'bass')) add(`${p}.parts`, sid, 'stage 1 needs a bass part');
  for (const s of [2, 3, 4]) if (!has((x) => x.stage === s)) add(`${p}.parts`, sid, `no part joins at stage ${s}`);
  if (!has((x) => x.role === 'drums' && x.instrument === 'hat' && x.stage <= 2)) add(`${p}.parts`, sid, 'a hat part must join by stage 2');
  if (!has((x) => x.role === 'fill' && x.stage === 1)) add(`${p}.parts`, sid, 'a fill part must join at stage 1');
  const incidents = parts.filter((x) => x.role === 'incident').length;
  if (incidents !== 1) add(`${p}.parts`, sid, `exactly one incident part required (found ${incidents})`);
  if (!has((x) => x.pattern.length === 8)) add(p, sid, 'at least one part must have an 8-bar pattern');
  const bassGain = Math.max(0, ...parts.filter((x) => x.role === 'bass').map((x) => x.voice.gain));
  const louder = parts.find((x) => (x.role === 'music' || x.role === 'incident') && x.voice.gain > bassGain);
  if (louder) add(`${p}.parts`, `${sid}/${louder.id}`, 'the bass must be the loudest pitched part');
  if (song.bassAudibility === 'speakers') {
    const audible = stage1.some((x) => {
      if (x.role !== 'bass' || x.register !== 'upper' || x.voice.wave === 'sine') return false;
      const lowest = Math.min(...noteValues(x.notes));
      const f = x.voice.filter;
      const cutoff = f ? Math.min(f.hz, f.toHz ?? f.hz) : Infinity;
      return lowest >= 12 || (f && f.type === 'lowpass' ? cutoff >= 300 : true);
    });
    if (!audible) {
      add(p, sid, "a 'speakers' song needs a stage-1 upper bass part (not sine, ≥ 12 semitones above root or filter ≥ 300 Hz)");
    }
  }
  // Distinct songs: no shared (kick + backbeat) pattern together with a shared sub bass line.
  const kick = parts.find((x) => x.stage === 1 && x.instrument === 'kick');
  const sub = parts.find((x) => x.stage === 1 && x.role === 'bass');
  const sig = { id: sid, drums: JSON.stringify([kick?.pattern, backbeat[0]?.pattern]), bass: JSON.stringify([sub?.pattern, sub?.notes]) };
  const twin = signatures.find((o) => o.drums === sig.drums && o.bass === sig.bass);
  if (twin) add(p, sid, `same drum pattern and bass line as '${twin.id}'`);
  signatures.push(sig);
}

