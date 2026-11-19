// Balance simulation for the late-game upgrades (specs/006-late-game-upgrades/quickstart.md S1–S4).
//   jsc -m tests/balance/upgrades.mjs -- s1            all seeds, one after another (slow)
//   jsc -m tests/balance/upgrades.mjs -- s1 23         one seed; prints a ROW line (for parallel runs)
//   python3 tests/balance/parallel.py upgrades s1      all seeds in parallel, then the verdict
//   node tests/balance/upgrades.mjs s1
//
// The bot moves like feature 004's (circles; orbits an active Major Incident). Unless noted it picks
// like a player building damage: a new tool if offered, else a tool rank-up, else the first choice
// (always choice 1 made early runs die with Ping alone once 6 passives share the pool).
// S1 (SC-001): invincible, tool-first picks. Difficulty at which the upgrade pool first runs out.
//     Pass: in ≥ 8 of 10 runs the pool still has upgrades at difficulty 12 (runs out at 13 or later, or never).
// S2 (SC-002): same runs, continued for 5 level-ups after the pool runs out. Pass: every offer that
//     contains Failover is exactly [Capacity Planning, Failover].
// S3 (SC-003): 20 seeds, invincible, choices picked by a separate seeded RNG. Pass: ≥ 10 distinct
//     4-tool builds.
// S4 (SC-004): not invincible, tool-first picks (same bot for both), new data vs. baseline (the new tools, passives, and
//     Capacity Planning removed; heal 20%). Pass: median difficulty reached within ±2 levels and wins
//     up by at most 2 of 10 (20 percentage points).
import { loadGameData } from '../harness.js';
import { createRun, step, chooseUpgrade } from '../../engine/run.js';
import { createRng } from '../../engine/rng.js';

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const out = (line) => (typeof print === 'function' && !isNode ? print(line) : console.log(line));
const argv = isNode ? process.argv.slice(2) : (typeof scriptArgs !== 'undefined' ? scriptArgs : (typeof arguments !== 'undefined' ? [...arguments] : []));
const mode = argv[0] ?? 's1';
const SEEDS10 = [11, 23, 37, 41, 53, 67, 79, 83, 97, 101];
const SEEDS20 = [...SEEDS10, 113, 127, 131, 139, 149, 151, 157, 163, 167, 173];
const NEW_TOOLS = ['traceroute', 'rate-limiter', 'null-route'];
const NEW_PASSIVES = ['qos-policy', 'link-aggregation', 'observability-stack', 'hardened-config'];

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
  return { dx: -uy + radial * ux * 1.5, dy: ux + radial * uy * 1.5 };
}

function toolFirst(run) {
  const o = run.offer;
  const fresh = o.findIndex((x) => x.kind === 'tool' && x.fromRank === 0);
  if (fresh >= 0) return fresh;
  const up = o.findIndex((x) => x.kind === 'tool');
  return up >= 0 ? up : 0;
}

// Plays one run. pick(run) → choice index. stop(run, state) → true to end early.
function play(data, seed, { invincible, pick = () => 0, stop = () => false }) {
  const run = createRun(data, { seed });
  const state = { exhaustedAt: null, offersAfter: [], afterCount: 0 };
  while (run.phase !== 'ended') {
    if (run.phase === 'levelup') {
      const kinds = run.offer.map((o) => o.kind);
      if (kinds.includes('heal')) {
        if (state.exhaustedAt === null) state.exhaustedAt = run.difficultyLevel;
        state.offersAfter.push(kinds.join(','));
        state.afterCount++;
      }
      chooseUpgrade(run, pick(run));
      if (stop(run, state)) break;
      continue;
    }
    if (invincible) run.engineer.uptime = run.engineer.maxUptime;
    step(run, botInput(run));
    run.events.length = 0;
    if (stop(run, state)) break;
  }
  return { run, state };
}

function rowS1(data, seed) {
  const { state } = play(data, seed, { invincible: true, pick: toolFirst, stop: (r, s) => s.afterCount >= 5 });
  return { seed, exhaustedAt: state.exhaustedAt, offers: state.offersAfter };
}
function rowS3(data, seed) {
  const rng = createRng(seed + 1000);
  const { run } = play(data, seed, {
    invincible: true,
    pick: (r) => rng.int(r.offer.length),
    stop: (r) => r.engineer.tools.length >= r.data.player.maxTools || r.difficultyLevel >= 20,
  });
  return { seed, build: run.engineer.tools.map((t) => t.id).sort().join('+') };
}
function baseline(data) {
  const d = JSON.parse(JSON.stringify(data));
  d.tools = d.tools.filter((t) => !NEW_TOOLS.includes(t.id));
  d.passives = d.passives.filter((p) => !NEW_PASSIVES.includes(p.id));
  delete d.repeatable;
  d.levelUp.fallbackHealPercent = 20;
  delete d.levelUp.toolFloor; // today's game has no tool floor
  return d;
}
// makePick() gives each run its own picker, so the two runs never share random state.
function rowS4(data, seed, makePick = () => toolFirst) {
  const a = play(data, seed, { invincible: false, pick: makePick() }).run;
  const b = play(baseline(data), seed, { invincible: false, pick: makePick() }).run;
  return { seed, level: a.stats.highestDifficulty, win: a.outcome === 'win', baseLevel: b.stats.highestDifficulty, baseWin: b.outcome === 'win' };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function verdict(mode, rows) {
  const lines = [];
  let pass;
  if (mode === 's1') {
    const lasting = rows.filter((r) => r.exhaustedAt === null || r.exhaustedAt > 12).length;
    pass = lasting >= 8;
    lines.push(`S1 pool runs out at difficulty: ${rows.map((r) => `${r.seed}:${r.exhaustedAt ?? 'never'}`).join(', ')}`);
    lines.push(`${pass ? 'PASS' : 'FAIL'} S1: ${lasting}/${rows.length} runs still have upgrades at difficulty 12 (need ≥ 8)`);
  } else if (mode === 's2') {
    const offers = rows.flatMap((r) => r.offers);
    const bad = offers.filter((o) => o !== 'repeatable,heal');
    pass = bad.length === 0 && offers.length > 0;
    lines.push(`${pass ? 'PASS' : 'FAIL'} S2: ${offers.length} offers after the pool ran out, ${bad.length} not exactly [Capacity Planning, Failover]${bad.length ? ': ' + bad.join(' | ') : ''}`);
  } else if (mode === 's3') {
    const builds = new Map();
    for (const r of rows) builds.set(r.build, (builds.get(r.build) ?? 0) + 1);
    pass = builds.size >= 10;
    lines.push(`S3 builds: ${[...builds].map(([b, n]) => `${b}×${n}`).join('; ')}`);
    lines.push(`${pass ? 'PASS' : 'FAIL'} S3: ${builds.size} distinct 4-tool builds in ${rows.length} runs (need ≥ 10)`);
  } else if (mode.startsWith('s4')) {
    const m = median(rows.map((r) => r.level));
    const mb = median(rows.map((r) => r.baseLevel));
    const w = rows.filter((r) => r.win).length;
    const wb = rows.filter((r) => r.baseWin).length;
    pass = Math.abs(m - mb) <= 2 && w - wb <= Math.round(rows.length * 0.2);
    lines.push(`S4 end levels new: ${rows.map((r) => r.level).join(', ')} (median ${m}, ${w} wins)`);
    lines.push(`S4 end levels baseline: ${rows.map((r) => r.baseLevel).join(', ')} (median ${mb}, ${wb} wins)`);
    lines.push(`${pass ? 'PASS' : 'FAIL'} S4: median ${m} vs ${mb} (±2 allowed); wins ${w} vs ${wb} (at most +${Math.round(rows.length * 0.2)})`);
  }
  return { pass, lines };
}

// s4first: S4 with the "always take choice 1" bot (feature 004's), reported for comparison.
const randomPick = (seed) => { const rng = createRng(seed + 2000); return (r) => rng.int(r.offer.length); };
const ROW = {
  s1: rowS1, s2: rowS1, s3: rowS3, s4: rowS4,
  s4first: (d, seed) => rowS4(d, seed, () => () => 0),
  s4random: (d, seed) => rowS4(d, seed, () => randomPick(seed)), // a player choosing at random
};
const isMain = mode in ROW || mode === 'verdict';
if (isMain) {
  if (mode === 'verdict') {
    // jsc -m tests/balance/upgrades.mjs -- verdict s1 '<json rows>'
    const { pass, lines } = verdict(argv[1], JSON.parse(argv[2]));
    for (const l of lines) out(l);
    out(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  } else {
    const data = await loadGameData();
    if (argv[1]) {
      out('ROW ' + JSON.stringify(ROW[mode](data, Number(argv[1]))));
    } else {
      const seeds = mode === 's3' ? SEEDS20 : SEEDS10;
      const { pass, lines } = verdict(mode, seeds.map((s) => ROW[mode](data, s)));
      for (const l of lines) out(l);
      out(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
    }
  }
}
