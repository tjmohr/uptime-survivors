// Web Audio synthesis: context, gain chain, voices, effects, and the music sequencer.
// Browser only. Every public method catches its own errors; a failure turns status into
// 'unavailable' and the game carries on silently (FR-020, contracts/audio-api.md).
// Feature 007: the sequencer plays drum & bass at a fixed tempo; audio/arrange.js decides what plays
// (specs/007-drum-and-bass-music/research.md M1, M2, M7, M9, M10).

import { EFFECT_NAMES } from './content.js';
import { createArrangement, hitsForStep, noteHz, crossfadeGains } from './arrange.js';

const RAMP_S = 0.02;          // gain changes ramp over 20 ms to avoid clicks (research A4)
const TICK_MS = 25;           // sequencer timer period (research A5)
const LOOKAHEAD_S = 0.2;      // schedule steps this far ahead on the audio clock (007 research M10)
const SILENT = 0.0001;        // exponential ramps cannot reach 0
const STEP_TIMES_KEPT = 64;   // recent scheduled step times, for the tempo checks (007 B5)
const FADE_POINTS = 24;       // ramp segments per equal-power crossfade

const volumeToGain = (pct) => (pct / 100) ** 2;

// options.context: an AudioContext to use instead of creating one (an OfflineAudioContext for the B11
// render check); options.outputFilters: filters between the master gain and the destination (B11 bands).
export function createAudio(audioData, settings, options = {}) {
  const { mix, music } = audioData;
  // data-model.md › AudioState.status: idle → running | unavailable; suspended while hidden.
  let status = 'idle';
  let ctx = null;
  let nodes = null;
  let noise = null;
  let ducked = false;
  let timer = null;
  const effectCounts = Object.fromEntries(EFFECT_NAMES.map((n) => [n, 0]));
  const stepS = 60 / music.bpm / 4;
  const barS = stepS * music.stepsPerBar;
  const songById = new Map(music.songs.map((s) => [s.id, s]));
  const arrangement = createArrangement(music);
  // Sequencer state. `started` is false until startMusic; `plan` is what each live song plays this bar.
  const seq = { playing: false, started: false, step: 0, nextTime: 0, firstBar: true, plan: [], buses: new Map(),
    fades: new Map(), partCounts: {}, stepTimes: [], skippedSteps: 0, level: 1, queuedIncident: false };
  const shaperCurves = new Map();

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

  // Soft-clipping curve for `drive` (007 research M7), cached per drive amount.
  function shaperCurve(drive) {
    let curve = shaperCurves.get(drive);
    if (!curve) {
      const k = drive * 50;
      curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      shaperCurves.set(drive, curve);
    }
    return curve;
  }

  // Plays one Voice (data-model.md › Voice, Note) at audio time `when` into `dest`.
  // `pitch`, when given, transposes every note so the first note lands on that frequency.
  // `gainScale` scales the peak (ghost hits). Feature 007 fields — unison/detuneCents, filter.toHz/q,
  // lfo, drive — are optional; without them the node graph is exactly feature 002's.
  function playVoice(voice, when, dest, pitch, gainScale = 1) {
    const total = voice.notes.reduce((s, n) => s + n.ms, 0) / 1000;
    const end = when + total;
    const ratio = pitch ? pitch / voice.notes[0].freq : 1;
    const sources = [];
    let mix;
    if (voice.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      sources.push(src);
      mix = src;
    } else {
      const unison = voice.unison ?? 1;
      const spread = voice.detuneCents ?? 0;
      mix = unison > 1 ? ctx.createGain() : null;
      for (let u = 0; u < unison; u++) {
        const src = ctx.createOscillator();
        src.type = voice.wave;
        if (unison > 1) src.detune.setValueAtTime((u - (unison - 1) / 2) * spread, when); // 2: ±s/2, 3: −s, 0, +s
        let t = when;
        for (const n of voice.notes) {
          src.frequency.setValueAtTime(n.freq * ratio, t);
          if (n.toFreq) src.frequency.exponentialRampToValueAtTime(n.toFreq * ratio, t + n.ms / 1000);
          t += n.ms / 1000;
        }
        sources.push(src);
        if (mix) src.connect(mix);
      }
      if (mix) mix.gain.value = 1 / Math.sqrt(unison);
      else mix = sources[0];
    }
    let out = mix;
    if (voice.drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = shaperCurve(voice.drive);
      out.connect(shaper);
      out = shaper;
    }
    const filterDef = voice.filter ?? (voice.wave === 'noise' ? { type: 'bandpass', hz: voice.notes[0].freq } : null);
    let filter = null;
    if (filterDef) {
      filter = ctx.createBiquadFilter();
      filter.type = filterDef.type;
      filter.frequency.setValueAtTime(filterDef.hz, when);
      if (filterDef.toHz) filter.frequency.exponentialRampToValueAtTime(filterDef.toHz, end);
      if (filterDef.q !== undefined) filter.Q.setValueAtTime(filterDef.q, when);
      out.connect(filter);
      out = filter;
    }
    const env = ctx.createGain();
    const peak = voice.gain * gainScale;
    const attack = Math.min(voice.attackMs / 1000, total / 2);
    env.gain.setValueAtTime(SILENT, when);
    env.gain.linearRampToValueAtTime(peak, when + Math.max(attack, 0.001));
    env.gain.exponentialRampToValueAtTime(SILENT, end);
    out.connect(env);
    let last = env;
    if (voice.lfo) {
      // Tempo-synced modulation: one cycle every `steps` sixteenth notes, starting on the note's grid time.
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(1 / (stepS * voice.lfo.steps), when);
      const depth = ctx.createGain();
      if (voice.lfo.target === 'filter' && filter) {
        depth.gain.setValueAtTime(voice.lfo.depth, when);
        lfo.connect(depth);
        depth.connect(filter.frequency);
      } else {
        // Gain wobble: a tremolo stage after the envelope, dipping by `depth`.
        const trem = ctx.createGain();
        trem.gain.setValueAtTime(1 - voice.lfo.depth / 2, when);
        depth.gain.setValueAtTime(voice.lfo.depth / 2, when);
        lfo.connect(depth);
        depth.connect(trem.gain);
        env.connect(trem);
        last = trem;
      }
      sources.push(lfo);
    }
    last.connect(dest);
    for (const src of sources) {
      src.start(when);
      src.stop(end + 0.02);
    }
  }

  // ---- music sequencer (002 research A5; 007 research M2, M9, M10) ---------------------------
  // Each live song has a main bus and a bass bus into the music gain, so crossfades can blend the main
  // parts while swapping the bass at the bar-2 line (FR-008, FR-008a).
  function createBuses(songId, initial) {
    const song = songById.get(songId);
    const main = ctx.createGain();
    const bass = ctx.createGain();
    main.gain.value = initial * song.gain;
    bass.gain.value = initial * song.gain;
    main.connect(nodes.music);
    bass.connect(nodes.music);
    const buses = { main, bass, gain: song.gain };
    seq.buses.set(songId, buses);
    return buses;
  }

  function dropBuses(songId, at) {
    const buses = seq.buses.get(songId);
    if (!buses) return;
    seq.buses.delete(songId);
    seq.fades.delete(songId);
    for (const node of [buses.main, buses.bass]) {
      node.gain.cancelScheduledValues(at);
      node.gain.setTargetAtTime(0, at, RAMP_S / 3);
    }
    const ms = Math.max(0, (at - ctx.currentTime) * 1000) + 200;
    setTimeout(() => { try { buses.main.disconnect(); buses.bass.disconnect(); } catch {} }, ms);
  }

  // The main-bus level a song is at, at time t, from the fade scheduled for it (1 if none).
  function mainLevelAt(songId, t) {
    const fade = seq.fades.get(songId);
    if (!fade) return 1;
    const pos = Math.min(1, Math.max(0, (t - fade.start) / fade.length));
    return fade.dir === 'in' ? Math.sin((pos * Math.PI) / 2) : fade.from * Math.cos((pos * Math.PI) / 2);
  }

  // An equal-power fade as plain linear-ramp segments. setValueCurveAtTime is avoided on purpose:
  // Firefox rejects a curve that touches another scheduled event, which silenced the music there.
  function scheduleFade(param, T, length, from, dir, gain) {
    param.cancelScheduledValues(T);
    const level = (i) => {
      const t = i / FADE_POINTS;
      const g = crossfadeGains(t < 0.5 ? 0 : 1, t < 0.5 ? t * 2 : t * 2 - 1);
      return gain * from * (dir === 'in' ? g.inMain : g.outMain);
    };
    param.setValueAtTime(level(0), T);
    for (let i = 1; i <= FADE_POINTS; i++) param.linearRampToValueAtTime(level(i), T + (length * i) / FADE_POINTS);
  }

  // Schedule a 2-bar crossfade starting at audio time T (a bar line).
  function scheduleCrossfade(fromId, toId, T) {
    const length = barS * music.crossfadeBars;
    const out = seq.buses.get(fromId);
    const inc = seq.buses.get(toId) ?? createBuses(toId, 0);
    const fromLevel = mainLevelAt(fromId, T);
    scheduleFade(out.main.gain, T, length, fromLevel, 'out', out.gain);
    seq.fades.set(fromId, { start: T, length, from: fromLevel, to: 0, dir: 'out' });
    scheduleFade(inc.main.gain, T, length, 1, 'in', inc.gain);
    seq.fades.set(toId, { start: T, length, from: 0, to: 1, dir: 'in' });
    // Bass swap on the bar-2 line: outgoing bass off, incoming bass on, with 20 ms ramps.
    const swap = T + barS;
    out.bass.gain.cancelScheduledValues(T);
    out.bass.gain.setValueAtTime(out.gain, T);
    out.bass.gain.setValueAtTime(out.gain, swap - RAMP_S);
    out.bass.gain.linearRampToValueAtTime(0, swap);
    inc.bass.gain.cancelScheduledValues(T);
    inc.bass.gain.setValueAtTime(0, T);
    inc.bass.gain.setValueAtTime(0, swap);
    inc.bass.gain.linearRampToValueAtTime(inc.gain, swap + RAMP_S);
  }

  // A new bar begins at audio time `when`: apply the arrangement's queued changes.
  function beginBar(when) {
    if (seq.firstBar) {
      seq.firstBar = false;
    } else {
      const changes = arrangement.advanceBar();
      if (changes.ended) dropBuses(changes.ended, when);
      if (changes.cut) dropBuses(changes.cut, when);
      if (changes.crossfade) scheduleCrossfade(changes.crossfade.from, changes.crossfade.to, when);
    }
    seq.plan = arrangement.barPlan();
  }

  function playStep(when) {
    for (const entry of seq.plan) {
      const buses = seq.buses.get(entry.song.id);
      if (!buses) continue;
      for (const hit of hitsForStep(entry.entries, entry.songBar, seq.step, music)) {
        if (seq.onlyRoles && !seq.onlyRoles.includes(hit.part.role)) continue;
        const dest = hit.part.role === 'bass' ? buses.bass : buses.main;
        const notes = hit.note === null ? [null] : Array.isArray(hit.note) ? hit.note : [hit.note];
        for (const n of notes) playVoice(hit.part.voice, when, dest, n === null ? undefined : noteHz(entry.song.rootHz, n), hit.gainScale);
        const key = `${entry.song.id}/${hit.part.id}`;
        seq.partCounts[key] = (seq.partCounts[key] ?? 0) + 1;
      }
    }
  }

  function schedule() {
    if (!seq.playing || status !== 'running') return;
    scheduleUntil(ctx.currentTime + LOOKAHEAD_S, ctx.currentTime);
  }

  function scheduleUntil(horizon, now) {
    while (seq.nextTime < horizon) {
      if (seq.step === 0) beginBar(seq.nextTime);
      // A step already more than one step late is skipped, never played late: the grid never shifts.
      if (seq.nextTime < now - stepS) {
        seq.skippedSteps += 1;
      } else {
        playStep(seq.nextTime);
        seq.stepTimes.push(seq.nextTime);
        if (seq.stepTimes.length > STEP_TIMES_KEPT) seq.stepTimes.shift();
      }
      seq.nextTime += stepS;
      seq.step = (seq.step + 1) % music.stepsPerBar;
    }
  }

  function stopAllSongs() {
    if (!ctx) return;
    for (const id of [...seq.buses.keys()]) dropBuses(id, ctx.currentTime);
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
        ctx = options.context ?? new Ctx();
        nodes = {
          master: ctx.createGain(),
          music: ctx.createGain(),
          duck: ctx.createGain(),
          effects: ctx.createGain(),
        };
        nodes.effects.connect(nodes.master);
        nodes.music.connect(nodes.duck);
        nodes.duck.connect(nodes.master);
        let tail = nodes.master;
        for (const def of options.outputFilters ?? []) {
          const f = ctx.createBiquadFilter();
          f.type = def.type;
          f.frequency.value = def.hz;
          tail.connect(f);
          tail = f;
        }
        tail.connect(ctx.destination);
        const g = targets();
        for (const k of Object.keys(g)) nodes[k].gain.value = g[k];
        noise = makeNoise();
        status = 'running';
      } catch (err) {
        fail(err);
        return Promise.resolve(status);
      }
      if (options.context) return Promise.resolve(status); // offline rendering: nothing to resume
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

    // Feature 007: the run's soundtrack starts from its seed (song order) and level (song and stage).
    startMusic: guard((seed = 1, level = 1, order = null) => {
      stopAllSongs();
      arrangement.start(seed, level, order);
      seq.playing = true;
      seq.started = true;
      seq.step = 0;
      seq.firstBar = true;
      seq.level = level;
      seq.queuedIncident = false;
      seq.partCounts = {};
      seq.stepTimes = [];
      seq.skippedSteps = 0;
      seq.plan = [];
      if (status !== 'running') return;
      for (const s of arrangement.live()) createBuses(s.songId, 1);
      seq.nextTime = ctx.currentTime + 0.05;
      startTimer();
    }),

    // ---- Preview page only (tests/music-preview.html, T038); the game never calls these. ----
    // Play one song (block 1) at a stage; "next" crossfades into the following song at the same stage.
    previewSong: guard((songId, stage = 4) => {
      const order = [songId, ...music.songs.map((s) => s.id).filter((id) => id !== songId)];
      api.startMusic(1, stage, order);
    }),
    previewStage: guard((stage) => {
      if (!seq.started) return;
      const { block } = arrangement.state();
      api.setLevel(block * music.levelsPerSong + stage);
    }),
    previewNext: guard(() => {
      if (!seq.started) return;
      const { block, stage } = arrangement.state();
      if (block < music.songs.length - 1) api.setLevel((block + 1) * music.levelsPerSong + stage);
    }),
    previewJump: guard((cycleBar) => { if (seq.started) arrangement.jumpTo(cycleBar); }),

    // B11 (T039): schedule `bars` bars of one song at a stage onto an OfflineAudioContext passed in
    // options.context, then render it. Resolves the rendered AudioBuffer.
    // onlyRoles (optional): play just those part roles, e.g. ['bass'] to measure the bass on its own.
    renderOffline(songId, stage, bars, onlyRoles = null) {
      if (status !== 'running') return Promise.reject(new Error(`audio ${status}`));
      const order = [songId, ...music.songs.map((s) => s.id).filter((id) => id !== songId)];
      arrangement.start(1, stage, order);
      seq.started = true;
      seq.step = 0;
      seq.firstBar = true;
      seq.partCounts = {};
      seq.onlyRoles = onlyRoles;
      for (const s of arrangement.live()) createBuses(s.songId, 1);
      seq.nextTime = 0.02;
      scheduleUntil(bars * barS, 0);
      return ctx.startRendering();
    },

    stopMusic: guard(() => {
      seq.playing = false;
      stopTimer();
      stopAllSongs();
    }),

    // Queued; applied on the next bar line (stage change, or a crossfade into the next block's song).
    setLevel: guard((level) => {
      if (!seq.started) return;
      seq.level = level;
      arrangement.queueLevel(level);
    }),

    // Feature 004/007: the current songs' incident parts join/leave at the next bar line.
    setIncident: guard((value) => {
      if (!seq.started || value === seq.queuedIncident) return;
      seq.queuedIncident = value;
      arrangement.queueIncident(value);
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
      const arr = seq.started ? arrangement.state() : null;
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
        musicPlaying: seq.playing && timer !== null,
        incidentMusic: arr ? arr.incident : false,
        effectCounts: { ...effectCounts },
        // Feature 007 (data-model.md › Statistics exposed for tests).
        music: {
          bpm: music.bpm,
          order: arr ? arr.order : [],
          songId: arr ? arr.songId : null,
          stage: arr ? arr.stage : null,
          block: arr ? arr.block : null,
          bar: arr ? arr.bar : null,
          cycleBar: arr ? arr.cycleBar : null,
          crossfade: arr ? arr.crossfade : null,
          liveSongs: arr ? arr.liveSongs : [],
          activeParts: seq.plan.flatMap((p) => p.entries.map((e) => `${p.song.id}/${e.part.id}`)),
          partCounts: { ...seq.partCounts },
          songStarts: arr ? arr.songStarts : [],
          skippedSteps: seq.skippedSteps,
          stepTimes: [...seq.stepTimes],
          barSeconds: barS,
          audioTime: ctx ? ctx.currentTime : null,
        },
        contextState: ctx ? ctx.state : null,
        lastError,
        targetGains: targets(),
        gains,
      };
    },
  };
  return api;
}
