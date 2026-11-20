// Decides what should sound: engine events → effect requests and rate limiting.
// Pure: no browser APIs, timers, or randomness; knows nothing about how sound is made
// (specs/002-procedural-audio/contracts/audio-api.md, data-model.md › Event → sound mapping).

import { EFFECT_NAMES, voiceDurationMs } from './content.js';

// When more effects want to sound than the concurrency cap allows, earlier names win.
const PRIORITY = ['levelUp', 'newThreat', 'damage', 'pulse', 'defeat', 'pickup', 'fire', 'hit'];

const EVENT_TO_EFFECT = {
  fire: 'fire',
  pulse: 'pulse',
  'player-hit': 'damage',
  hit: 'hit',
  'enemy-defeated': 'defeat',
  pickup: 'pickup',
  'level-up': 'levelUp',
  'zone-placed': 'pulse', // Null Route (feature 006); Traceroute and the other tools emit 'fire' or 'hit'
};

// Feature 007: tempo and music parts now come from audio/arrange.js (bpmForLevel/layersForLevel removed).

export function createDirector(audioData) {
  const durations = {};
  for (const name of EFFECT_NAMES) durations[name] = voiceDurationMs(audioData.effects[name].voice);
  const max = audioData.mix.maxConcurrentEffects;
  let lastPlayed = {};
  let playing = []; // end times of effects still sounding
  const counts = Object.fromEntries(EFFECT_NAMES.map((n) => [n, 0]));
  let incidentsActive = 0; // feature 004: drives the incident music layer

  function accept(name, nowMs) {
    const last = lastPlayed[name];
    if (last !== undefined && nowMs - last < audioData.effects[name].minIntervalMs) return false;
    playing = playing.filter((end) => end > nowMs);
    if (playing.length >= max) return false; // dropped, never queued
    lastPlayed[name] = nowMs;
    playing.push(nowMs + durations[name]);
    counts[name] += 1;
    return true;
  }

  // Always played, like win/loss: exempt from minIntervalMs and the concurrency cap (feature 004 FR-017).
  function always(name, nowMs) {
    lastPlayed[name] = nowMs;
    playing.push(nowMs + durations[name]);
    counts[name] += 1;
  }

  function consume(events, nowMs) {
    const wanted = new Set();
    let level = null;
    let runEnded = null;
    const urgent = [];
    for (const ev of events) {
      if (ev.type === 'incident-arrived') { urgent.push('incidentAlarm'); incidentsActive += 1; continue; }
      if (ev.type === 'incident-resolved') { urgent.push('incidentResolved'); incidentsActive = Math.max(0, incidentsActive - 1); continue; }
      const effect = EVENT_TO_EFFECT[ev.type];
      if (effect) wanted.add(effect);
      else if (ev.type === 'difficulty-up') {
        level = ev.level;
        if (ev.debuts && ev.debuts.length > 0) wanted.add('newThreat');
      } else if (ev.type === 'run-ended') {
        runEnded = ev.outcome === 'win' ? 'win' : 'loss';
      }
    }
    const effects = [];
    for (const name of urgent) {
      always(name, nowMs);
      effects.push(name);
    }
    if (runEnded) {
      // The end-of-run sound always plays (exactly one per run); it is not subject to the cap.
      lastPlayed[runEnded] = nowMs;
      playing.push(nowMs + durations[runEnded]);
      counts[runEnded] += 1;
    }
    for (const name of PRIORITY) {
      if (wanted.has(name) && accept(name, nowMs)) effects.push(name);
    }
    return { effects, level, runEnded, incidentActive: incidentsActive > 0 };
  }

  return {
    consume,
    reset() {
      lastPlayed = {};
      playing = [];
      incidentsActive = 0;
    },
    counts,
  };
}
