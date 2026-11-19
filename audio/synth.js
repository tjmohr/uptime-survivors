// Web Audio synthesis: context, gain chain, voices, effects, and the music sequencer.
// Browser only. Every public method catches its own errors; a failure turns status into
// 'unavailable' and the game carries on silently (FR-020, contracts/audio-api.md).

import { EFFECT_NAMES } from './content.js';
import { bpmForLevel, layersForLevel } from './director.js';

const RAMP_S = 0.02;          // gain changes ramp over 20 ms to avoid clicks (research A4)
const TICK_MS = 25;           // sequencer timer period (research A5)
const LOOKAHEAD_S = 0.12;     // schedule steps this far ahead on the audio clock
const SILENT = 0.0001;        // exponential ramps cannot reach 0

const volumeToGain = (pct) => (pct / 100) ** 2;

export function createAudio(audioData, settings) {
  const { mix, music } = audioData;
  // data-model.md › AudioState.status: idle → running | unavailable; suspended while hidden.
  let status = 'idle';
  let ctx = null;
  let nodes = null;
  let noise = null;
  let ducked = false;
  let timer = null;
  const effectCounts = Object.fromEntries(EFFECT_NAMES.map((n) => [n, 0]));
  const layerCounts = Object.fromEntries(music.layers.map((l) => [l.id, 0]));
  const seq = { playing: false, step: 0, nextTime: 0, level: 1, pendingLevel: null, bpm: music.bpmStart, layers: [], pitchIndex: {},
    incident: false, pendingIncident: null };
  const incidentLayers = music.layers.filter((l) => l.trigger === 'incident'); // feature 004

  let lastError = null;
  function fail(err) {
    status = 'unavailable';
    lastError = err ? String(err.message || err) : null;
    stopTimer();
    if (err && typeof console !== 'undefined') console.warn('Sound unavailable:', err);
  }

  function guard(fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (err) {
        fail(err);
        return undefined;
      }
    };
  }

  const targets = () => ({
    master: settings.muted ? 0 : mix.masterGain,
    music: volumeToGain(settings.musicVolume),
    effects: volumeToGain(settings.effectsVolume),
    duck: ducked ? mix.duckFactor : 1,
  });

  // Glide to `value` (time constant RAMP_S / 3: ~95% there after RAMP_S). setTargetAtTime starts from
  // wherever the gain is now, so it never jumps, even when a previous change is still in flight.
  function ramp(param, value) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setTargetAtTime(value, t, RAMP_S / 3);
  }

  function applyGains() {
    if (!nodes) return;
    const g = targets();
    ramp(nodes.master.gain, g.master);
    ramp(nodes.music.gain, g.music);
    ramp(nodes.effects.gain, g.effects);
    ramp(nodes.duck.gain, g.duck);
  }

  function makeNoise() {
    const length = ctx.sampleRate; // one second, looped
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let x = 0x9e3779b9; // fixed xorshift seed: noise is audio-only and needs no game randomness
    for (let i = 0; i < length; i++) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      data[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  // Plays one Voice (data-model.md › Voice, Note) at audio time `when` into `dest`.
  // `pitch`, when given, transposes every note so the first note lands on that frequency.
  function playVoice(voice, when, dest, pitch) {
    const total = voice.notes.reduce((s, n) => s + n.ms, 0) / 1000;
    const end = when + total;
    const ratio = pitch ? pitch / voice.notes[0].freq : 1;
    let src;
    if (voice.wave === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
    } else {
      src = ctx.createOscillator();
      src.type = voice.wave;
      let t = when;
      for (const n of voice.notes) {
        src.frequency.setValueAtTime(n.freq * ratio, t);
        if (n.toFreq) src.frequency.exponentialRampToValueAtTime(n.toFreq * ratio, t + n.ms / 1000);
        t += n.ms / 1000;
      }
    }
    let out = src;
    const filterDef = voice.filter ?? (voice.wave === 'noise' ? { type: 'bandpass', hz: voice.notes[0].freq } : null);
    if (filterDef) {
      const f = ctx.createBiquadFilter();
      f.type = filterDef.type;
      f.frequency.setValueAtTime(filterDef.hz, when);
      out.connect(f);
      out = f;
    }
    const env = ctx.createGain();
    const attack = Math.min(voice.attackMs / 1000, total / 2);
    env.gain.setValueAtTime(SILENT, when);
    env.gain.linearRampToValueAtTime(voice.gain, when + Math.max(attack, 0.001));
    env.gain.exponentialRampToValueAtTime(SILENT, end);
    out.connect(env);
    env.connect(dest);
    src.start(when);
    src.stop(end + 0.02);
  }

  // ---- music sequencer (research A5) -------------------------------------------------
  function applyLevel(level) {
    seq.level = level;
    seq.bpm = bpmForLevel(audioData, level);
    seq.layers = layersForLevel(audioData, level);
  }

  function schedule() {
    if (!seq.playing || status !== 'running') return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    while (seq.nextTime < horizon) {
      if (seq.step === 0 && seq.pendingLevel !== null) {
        applyLevel(seq.pendingLevel); // tempo and layers change only on a bar boundary
        seq.pendingLevel = null;
      }
      if (seq.step === 0 && seq.pendingIncident !== null) {
        seq.incident = seq.pendingIncident;
        seq.pendingIncident = null;
      }
      for (const layer of seq.incident ? [...seq.layers, ...incidentLayers] : seq.layers) {
        if (layer.pattern[seq.step] !== 'x') continue;
        let pitch;
        if (layer.pitches) {
          const i = seq.pitchIndex[layer.id] ?? 0;
          pitch = layer.pitches[i % layer.pitches.length];
          seq.pitchIndex[layer.id] = i + 1;
        }
        playVoice(layer.voice, seq.nextTime, nodes.music, pitch);
        layerCounts[layer.id] += 1;
      }
      seq.nextTime += 60 / seq.bpm / 4;
      seq.step = (seq.step + 1) % music.stepsPerBar;
    }
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(guard(schedule), TICK_MS);
  }

  function stopTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  // ---- public API --------------------------------------------------------------------
  const api = {
    get status() { return status; },

    // Must be called from a user gesture (the Start click). Resolves 'running' or 'unavailable'.
    start() {
      if (status !== 'idle') return Promise.resolve(status);
      try {
        if (settings.forceFail) throw new Error('forced by ?audioFail=1');
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) throw new Error('Web Audio is not supported');
        ctx = new Ctx();
        nodes = {
          master: ctx.createGain(),
          music: ctx.createGain(),
          duck: ctx.createGain(),
          effects: ctx.createGain(),
        };
        nodes.effects.connect(nodes.master);
        nodes.music.connect(nodes.duck);
        nodes.duck.connect(nodes.master);
        nodes.master.connect(ctx.destination);
        const g = targets();
        for (const k of Object.keys(g)) nodes[k].gain.value = g[k];
        noise = makeNoise();
        status = 'running';
      } catch (err) {
        fail(err);
        return Promise.resolve(status);
      }
      return ctx.resume().then(
        () => {
          if (ctx.state !== 'running' && status === 'running') fail(new Error(`audio context is ${ctx.state}`));
          return status;
        },
        (err) => { fail(err); return status; },
      );
    },

    play: guard((name) => {
      if (status !== 'running') return;
      playVoice(audioData.effects[name].voice, ctx.currentTime + 0.005, nodes.effects);
      effectCounts[name] += 1;
    }),

    startMusic: guard(() => {
      seq.playing = true;
      seq.step = 0;
      seq.pendingLevel = null;
      seq.incident = false;
      seq.pendingIncident = null;
      seq.pitchIndex = {};
      applyLevel(1);
      if (status !== 'running') return;
      seq.nextTime = ctx.currentTime + 0.05;
      startTimer();
    }),

    stopMusic: guard(() => {
      seq.playing = false;
      stopTimer();
    }),

    setLevel: guard((level) => {
      if (level !== seq.level || seq.pendingLevel !== null) seq.pendingLevel = level;
    }),

    // Feature 004: the incident layer joins/leaves at the next bar boundary.
    setIncident: guard((value) => {
      if (value === (seq.pendingIncident ?? seq.incident)) return;
      seq.pendingIncident = value;
    }),

    setDucked: guard((value) => {
      if (value === ducked) return;
      ducked = value;
      if (status === 'running') ramp(nodes.duck.gain, targets().duck);
    }),

    // Before start() these only change settings, so the run starts with them.
    setMuted: guard((value) => { settings.muted = value; if (status === 'running') applyGains(); }),
    setMusicVolume: guard((pct) => { settings.musicVolume = pct; if (status === 'running') applyGains(); }),
    setEffectsVolume: guard((pct) => { settings.effectsVolume = pct; if (status === 'running') applyGains(); }),

    suspend: guard(() => {
      if (status !== 'running') return;
      status = 'suspended';
      stopTimer();
      ctx.suspend().catch(fail);
    }),

    resume: guard(() => {
      if (status !== 'suspended') return;
      status = 'running';
      ctx.resume().catch(fail);
      if (seq.playing) {
        seq.nextTime = Math.max(seq.nextTime, ctx.currentTime + 0.05);
        startTimer();
      }
    }),

    stats() {
      const gains = nodes ? {
        master: nodes.master.gain.value,
        music: nodes.music.gain.value,
        effects: nodes.effects.gain.value,
        duck: nodes.duck.gain.value,
      } : null;
      return {
        status,
        muted: settings.muted,
        musicVolume: settings.musicVolume,
        effectsVolume: settings.effectsVolume,
        ducked,
        level: seq.level,
        bpm: seq.bpm,
        musicPlaying: seq.playing && timer !== null,
        activeLayers: (seq.incident ? [...seq.layers, ...incidentLayers] : seq.layers).map((l) => l.id),
        incidentMusic: seq.incident,
        effectCounts: { ...effectCounts },
        layerCounts: { ...layerCounts },
        contextState: ctx ? ctx.state : null,
        lastError,
        targetGains: targets(),
        gains,
      };
    },
  };
  return api;
}
