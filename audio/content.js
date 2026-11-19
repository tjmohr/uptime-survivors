// Validates data/audio.json before any run starts (FR-018, C6). Pure: no browser APIs.
// Rules: specs/002-procedural-audio/data-model.md and contracts/audio-data.md.
// Never throws; returns every error found as {path, id, message}, like engine/content.js.

export const EFFECT_NAMES = ['fire', 'pulse', 'damage', 'hit', 'defeat', 'pickup', 'levelUp', 'newThreat', 'win', 'loss'];
export const WAVES = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'];
export const STEPS_PER_BAR = 16;
export const LEVELS = 20;
const LONG_EFFECTS = new Set(['win', 'loss']);
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
const MUSIC_FIELDS = ['bpmStart', 'bpmEnd', 'stepsPerBar', 'layers'];
const LAYER_FIELDS = ['id', 'joinLevel', 'pattern', 'pitches', 'voice'];

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
    fields(v, VOICE_FIELDS, path, id);
    if (!WAVES.includes(v.wave)) add(`${path}.wave`, id, `'wave' must be one of ${WAVES.join(', ')}`);
    num(v, 'gain', path, id, { gt: 0, max: 1 });
    num(v, 'attackMs', path, id, { min: 0 });
    if (v.filter !== undefined) {
      const fp = `${path}.filter`;
      if (!isObject(v.filter)) add(fp, id, "'filter' must be an object");
      else {
        fields(v.filter, FILTER_FIELDS, fp, id);
        if (!FILTER_TYPES.includes(v.filter.type)) add(`${fp}.type`, id, `'type' must be one of ${FILTER_TYPES.join(', ')}`);
        num(v.filter, 'hz', fp, id, { gt: 0 });
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
  if (raw.schemaVersion !== 1) add('schemaVersion', null, "'schemaVersion' must be 1");

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
  if (music) {
    fields(music, MUSIC_FIELDS, 'music', null);
    const startOk = num(music, 'bpmStart', 'music', null, { gt: 0 });
    if (num(music, 'bpmEnd', 'music', null, { gt: 0 }) && startOk && music.bpmEnd < 1.3 * music.bpmStart) {
      add('music.bpmEnd', null, `'bpmEnd' must be at least 1.3 × bpmStart (${(1.3 * music.bpmStart).toFixed(1)})`);
    }
    if (music.stepsPerBar !== STEPS_PER_BAR) add('music.stepsPerBar', null, `'stepsPerBar' must be ${STEPS_PER_BAR}`);
    // A layer voice may last at most 4 steps (one beat) at bpmStart.
    const layerMaxMs = startOk ? stepMs(music.bpmStart) * 4 : undefined;
    const joins = new Set();
    if (!Array.isArray(music.layers) || music.layers.length === 0) {
      add('music.layers', null, "'layers' must be a non-empty list");
    } else {
      const seen = new Set();
      music.layers.forEach((layer, i) => {
        const p = `music.layers[${i}]`;
        if (!isObject(layer)) return add(p, null, 'layer must be an object');
        const id = typeof layer.id === 'string' ? layer.id : null;
        fields(layer, LAYER_FIELDS, p, id);
        if (!id || !ID_PATTERN.test(id)) add(`${p}.id`, id, "'id' must be a kebab-case string");
        else if (seen.has(id)) add(`${p}.id`, id, `duplicate layer id '${id}'`);
        else seen.add(id);
        if (num(layer, 'joinLevel', p, id, { min: 1, max: LEVELS, integer: true })) joins.add(layer.joinLevel);
        if (typeof layer.pattern !== 'string' || layer.pattern.length !== STEPS_PER_BAR || !/^[x.]+$/.test(layer.pattern)) {
          add(`${p}.pattern`, id, `'pattern' must be exactly ${STEPS_PER_BAR} characters of 'x' or '.'`);
        } else if (!layer.pattern.includes('x')) {
          add(`${p}.pattern`, id, "'pattern' must contain at least one 'x'");
        }
        if (layer.pitches !== undefined) {
          if (!Array.isArray(layer.pitches) || layer.pitches.length === 0 || !layer.pitches.every((f) => isNum(f) && f > 0)) {
            add(`${p}.pitches`, id, "'pitches' must be a non-empty list of numbers greater than 0");
          }
        }
        voice(layer.voice, `${p}.voice`, id, layerMaxMs);
      });
      if (!joins.has(1)) add('music.layers', null, 'no music layer joins at level 1');
      const enemies = isObject(gameData) && Array.isArray(gameData.enemies) ? gameData.enemies : [];
      const debuts = new Map();
      for (const e of enemies) {
        if (isObject(e) && Number.isInteger(e.debutLevel) && !debuts.has(e.debutLevel)) debuts.set(e.debutLevel, e.id);
      }
      for (const [level, enemyId] of [...debuts].sort((a, b) => a[0] - b[0])) {
        if (!joins.has(level)) add('music.layers', null, `no music layer joins at debut level ${level} (${enemyId})`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, data: raw };
}
