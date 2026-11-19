// Balance simulation for Major Incidents (specs/004-major-incidents/quickstart.md S1–S2).
//   jsc -m tests/balance/incidents.mjs            (macOS JavaScriptCore; run from the repository root)
//   node tests/balance/incidents.mjs
// Optional argument: "s1", "s2", or "baseline" to run one part only.
//
// S1: 10 seeds, a scripted player that circles and takes the first offered upgrade at every level-up
//     (the spec's "typical build"), with test-only invincibility so every incident is reached.
//     Reports seconds from arrival to resolution and the reward as a share of the next level-up.
//     Target: 30–60 s in ≥ 7 of 10 seeds per incident; reward 0.8–1.5 level-ups.
// S2: the same player without invincibility; reports the difficulty level each run ends at, with and
//     without incidents (baseline). Target: ≥ 7 of 10 runs end at levels 7–14 and the median is at
//     most 1 level below the baseline median.
import { loadGameData } from '../harness.js';
import { createRun, step, chooseUpgrade } from '../../engine/run.js';

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const out = (line) => (typeof print === 'function' && !isNode ? print(line) : console.log(line));
// jsc passes script arguments (after `--`) in `arguments`; Node in process.argv.
const argv = isNode ? process.argv.slice(2) : (typeof scriptArgs !== 'undefined' ? scriptArgs : (typeof arguments !== 'undefined' ? [...arguments] : []));
const only = argv[0] ?? 'all';
const ALL_SEEDS = [11, 23, 37, 41, 53, 67, 79, 83, 97, 101];
// A second argument runs one seed only (so seeds can run in parallel processes).
const SEEDS = argv[1] ? [Number(argv[1])] : ALL_SEEDS;

// Scripted player. Without an incident it walks a slow circle (the usual kiting pattern). While a
// Major Incident is active it plays "focused": it keeps about FOCUS_DISTANCE from the nearest
// incident and circles it, so its tools are in range (the spec's "focused play", SC-002).
const FOCUS_DISTANCE = 150;
function botInput(run) {
  const e = run.engineer;
  let target = null;
  let best = Infinity;
  for (const n of run.enemies) {
    if (n.incidentId === undefined || n.dead) continue;
    const d = Math.hypot(n.x - e.x, n.y - e.y);
    if (d < best) { best = d; target = n; }
  }
  if (!target) {
    const a = run.tick / 140;
    return { dx: Math.cos(a), dy: Math.sin(a) };
  }
  const ux = (target.x - e.x) / best;
  const uy = (target.y - e.y) / best;
  const radial = best > FOCUS_DISTANCE + 25 ? 1 : best < FOCUS_DISTANCE - 25 ? -1 : 0;
  // Mostly sideways (orbit), plus a radial correction to hold the distance.
  return { dx: -uy + radial * ux * 1.5, dy: ux + radial * uy * 1.5 };
}

function simulate(data, seed, { invincible }) {
  const run = createRun(data, { seed });
  const rewards = {};
  while (run.phase !== 'ended') {
    if (run.phase === 'levelup') chooseUpgrade(run, 0);
    if (invincible) run.engineer.uptime = run.engineer.maxUptime;
    step(run, botInput(run));
    for (const ev of run.events) {
      if (ev.type === 'incident-resolved') {
        const def = data.incidents.find((i) => i.id === ev.incidentId);
        rewards[ev.incidentId] = def.rewardTelemetry / run.engineer.telemetryToNext;
      }
    }
    run.events.length = 0;
  }
  return { run, rewards };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (x) => (x === null ? '  —  ' : x.toFixed(1).padStart(5));

const data = await loadGameData();
let ok = true;

if (only === 'all' || only === 's1') {
  out('S1 · resolve time (s) and reward (level-ups), typical build, invincible bot');
  out('seed  | ' + data.incidents.map((i) => i.id.padEnd(28)).join('| '));
  const times = Object.fromEntries(data.incidents.map((i) => [i.id, []]));
  const rewards = Object.fromEntries(data.incidents.map((i) => [i.id, []]));
  for (const seed of SEEDS) {
    const { run, rewards: r } = simulate(data, seed, { invincible: true });
    const cells = data.incidents.map((i) => {
      const rec = run.incidents.find((x) => x.id === i.id);
      const t = rec.state === 'resolved' ? rec.resolvedAt - rec.arrivedAt : null;
      times[i.id].push(t);
      if (r[i.id] !== undefined) rewards[i.id].push(r[i.id]);
      return `${fmt(t)} s  reward ${r[i.id] !== undefined ? r[i.id].toFixed(2) : ' —  '}`.padEnd(28);
    });
    out(`${String(seed).padStart(5)} | ` + cells.join('| '));
  }
  for (const i of data.incidents) {
    const inWindow = times[i.id].filter((t) => t !== null && t >= 30 && t <= 60).length;
    const unresolved = times[i.id].filter((t) => t === null).length;
    const rw = rewards[i.id].length ? median(rewards[i.id]) : null;
    const pass = inWindow >= Math.ceil(SEEDS.length * 0.7) && rw !== null && rw >= 0.8 && rw <= 1.5;
    ok &&= pass;
    out(`${pass ? 'PASS' : 'FAIL'} ${i.id}: ${inWindow}/${SEEDS.length} resolved in 30–60 s (median ${fmt(median(times[i.id].map((t) => t ?? 9999)))} s, ` +
      `${unresolved} unresolved); median reward ${rw === null ? '—' : rw.toFixed(2)} level-ups`);
  }
}

if (only === 'all' || only === 's2' || only === 'baseline') {
  const ends = (d) => SEEDS.map((seed) => simulate(d, seed, { invincible: false }).run);
  const endLevels = (runs) => runs.map((r) => r.stats.highestDifficulty);
  const baseData = await loadGameData();
  baseData.incidents = [];
  const baseRuns = ends(baseData);
  const base = endLevels(baseRuns);
  const wins = (runs) => runs.filter((r) => r.outcome === 'win').length;
  out(`S2 baseline (no incidents): end levels ${base.join(', ')} (median ${median(base)}; ${wins(baseRuns)} wins)`);
  if (only !== 'baseline') {
    const incRuns = ends(data);
    const withInc = endLevels(incRuns);
    const inRange = withInc.filter((l) => l >= 7 && l <= 14).length;
    const pass = inRange >= Math.ceil(SEEDS.length * 0.7) && median(withInc) >= median(base) - 1;
    ok &&= pass;
    out(`${pass ? 'PASS' : 'FAIL'} S2 with incidents: end levels ${withInc.join(', ')} (median ${median(withInc)}); ` +
      `${inRange}/${SEEDS.length} in 7–14; ${wins(incRuns)} wins; baseline median ${median(base)}`);
  }
}

out(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
if (isNode) process.exit(ok ? 0 : 1);
else if (typeof quit === 'function') quit(ok ? 0 : 1);
