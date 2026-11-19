// Field Guide (feature 005): G1–G5 and the engine part of G2 (specs/005-field-guide/quickstart.md).
import { test, assert, assertEqual, loadGameData } from './harness.js';
import { createRun, step, chooseUpgrade } from '../engine/run.js';
import { hashRun } from '../engine/hash.js';
import { describeChange } from '../engine/progression.js';
import { TOOL_KIND_FIELDS, RANK_COUNT } from '../engine/content.js';
import { buildGuide } from '../ui/guide.js';
import { describeStatChange, describeStatWithBonus } from '../ui/stattext.js';
import { shapePoints, problemIcon, loadoutIcon, LOCKED_COLOR, TOOL_COLORS } from '../ui/icons.js';
import { quietRun, place } from './fixtures.js';

// A run with incidents and (almost) no ordinary spawning; short levels.
async function incidentRun(levelSeconds = 2) {
  const data = await loadGameData();
  for (const row of data.difficulty) row.spawnPerSecond = 1e-9;
  data.player.maxUptime = 1e12;
  return createRun(data, { seed: 3, levelSeconds });
}

function advance(run, n) {
  for (let i = 0; i < n && run.phase !== 'ended'; i++) {
    if (run.phase === 'levelup') chooseUpgrade(run, 0);
    run.engineer.uptime = run.engineer.maxUptime;
    step(run, { dx: 0, dy: 0 });
    run.events.length = 0;
  }
}
const untilLevel = (run, level) => { while (run.difficultyLevel < level && run.phase !== 'ended') advance(run, 1); };
const meetAll = (run) => { run.encountered.push(...run.data.enemies.map((e) => e.id), ...run.data.incidents.map((i) => i.id)); };

// ---- G2 engine part: the encounter record ----

test('guide G2: a new run has met nothing; first spawn of a type is recorded once', async () => {
  const run = await quietRun();
  assertEqual(run.encountered.length, 0);
  place(run, 'dropped-packet', 400, 0);
  place(run, 'dropped-packet', -400, 0);
  place(run, 'route-flap', 0, 400);
  assertEqual(run.encountered.join(','), 'dropped-packet,route-flap');
  const again = await quietRun();
  assertEqual(again.encountered.length, 0, 'a new run starts empty');
});

test('guide G2: Broadcast Storm split children count as the same, already-met type', async () => {
  const run = await quietRun();
  const storm = place(run, 'broadcast-storm', 50, 0);
  storm.health = 0;
  storm.dead = true;
  step(run, { dx: 0, dy: 0 });
  assert(run.enemies.some((e) => e.typeId === 'broadcast-storm' && e.generation === 1), 'storm split');
  assertEqual(run.encountered.filter((id) => id === 'broadcast-storm').length, 1);
});

test('guide G2: incident arrival and Route Leak minions are recorded', async () => {
  const run = await incidentRun();
  untilLevel(run, 7);
  assert(run.encountered.includes('route-leak'), 'incident recorded on arrival');
  assert(!run.encountered.includes('latency-spike'), 'no latency spike spawned yet');
  let guard = 0;
  while (!run.enemies.some((e) => e.leakedBy !== undefined) && guard++ < 2000) advance(run, 1);
  assert(run.encountered.includes('latency-spike'), 'Route Leak minion counts as meeting Latency Spike');
});

// ---- G1: content ----

test('guide G1: problems in debut order, incidents by arrival level, text equals data, no combat numbers', async () => {
  const run = await incidentRun();
  meetAll(run);
  const g = buildGuide(run);
  assertEqual(g.problems.map((p) => run.defs.enemy.get(p.id).debutLevel).join(','), '1,4,8,12,16');
  assertEqual(g.incidents.map((p) => p.arrivalLevel).join(','), '7,12,18');
  for (const p of [...g.problems, ...g.incidents]) {
    const def = p.kind === 'enemy' ? run.defs.enemy.get(p.id) : run.defs.incident.get(p.id);
    assert(!p.locked, `${p.id} unlocked`);
    for (const k of ['name', 'concept', 'description', 'shape', 'color']) assertEqual(p[k], def[k], `${p.id}.${k}`);
    for (const k of ['health', 'speed', 'contactDamagePerSecond', 'damagePerSecond', 'radius']) {
      assert(!(k in p), `${p.id} has no ${k}`);
    }
  }
});

test('guide G1: loadout lists tools then passives in data order, text equals data', async () => {
  const run = await quietRun();
  const g = buildGuide(run);
  assertEqual(g.loadout.map((e) => e.id).join(','),
    [...run.data.tools.map((t) => t.id), ...run.data.passives.map((p) => p.id)].join(','));
  for (const e of g.loadout) {
    const def = (e.kind === 'tool' ? run.defs.tool : run.defs.passive).get(e.id);
    for (const k of ['name', 'concept', 'description']) assertEqual(e[k], def[k], `${e.id}.${k}`);
  }
});

// ---- G2 model part: locking ----

test('guide G2: unmet problems are locked with no text or colour; incidents keep arrival level', async () => {
  const run = await incidentRun();
  const g = buildGuide(run);
  for (const p of [...g.problems, ...g.incidents]) {
    assert(p.locked, `${p.id} locked at start`);
    assertEqual(p.name, null);
    assertEqual(p.concept, null);
    assertEqual(p.description, null);
    assertEqual(p.color, null);
    assert(typeof p.shape === 'string', 'silhouette keeps its shape');
  }
  assertEqual(g.incidents.map((p) => p.arrivalLevel).join(','), '7,12,18');
  run.encountered.push('latency-spike');
  const after = buildGuide(run);
  const spike = after.problems.find((p) => p.id === 'latency-spike');
  assert(!spike.locked && spike.name === 'Latency Spike', 'unlocks once met');
  assert(after.problems.find((p) => p.id === 'route-flap').locked, 'others stay locked');
});

// ---- G3: stats ----

test('guide G3: every rank of every tool and passive matches the engine tables and level-up wording', async () => {
  const run = await quietRun();
  run.engineer.tools = [];
  run.engineer.passives = [];
  for (const kind of ['tool', 'passive']) {
    for (const def of kind === 'tool' ? run.data.tools : run.data.passives) {
      // Not owned: rank 1 stats, no next line.
      let entry = buildGuide(run).loadout.find((e) => e.id === def.id);
      assert(!entry.owned && entry.rank === 1 && entry.next === null, `${def.id} not owned`);
      for (let rank = 1; rank <= RANK_COUNT; rank++) {
        const list = kind === 'tool' ? run.engineer.tools : run.engineer.passives;
        list.length = 0;
        list.push(kind === 'tool' ? { id: def.id, rank, cooldownLeft: 0 } : { id: def.id, rank });
        entry = buildGuide(run).loadout.find((e) => e.id === def.id);
        assert(entry.owned && entry.rank === rank, `${def.id} owned at rank ${rank}`);
        const values = def.ranks[rank - 1];
        const fields = kind === 'tool' ? TOOL_KIND_FIELDS[def.kind] : Object.keys(values);
        assertEqual(entry.stats.map((s) => `${s.stat}=${s.to}`).join(','), fields.map((k) => `${k}=${values[k]}`).join(','),
          `${def.id} rank ${rank} stats`);
        assert(entry.stats.every((s) => s.from === null), 'current stats have no from');
        if (rank === RANK_COUNT) {
          assertEqual(entry.next, null, `${def.id} has no next line at rank 5`);
        } else {
          // The same text the level-up screen shows for this upgrade offer.
          const offer = describeChange(run.data, { kind, id: def.id, fromRank: rank, toRank: rank + 1 });
          assertEqual(entry.next.map(describeStatChange).join(' · '), offer.map(describeStatChange).join(' · '),
            `${def.id} next rank ${rank}`);
          assert(entry.next.every((c) => c.from !== c.to), 'next lists only changed stats');
        }
        list.length = 0;
      }
    }
  }
});

test('guide G3: offline tools are flagged exactly while offlineUntil > elapsed', async () => {
  const run = await quietRun();
  run.engineer.tools = [{ id: 'ping', rank: 2, cooldownLeft: 0 }, { id: 'load-balancer', rank: 1, cooldownLeft: 0, offlineUntil: 5 }];
  run.elapsed = 4;
  let g = buildGuide(run);
  assert(g.loadout.find((e) => e.id === 'load-balancer').offline, 'offline');
  assert(!g.loadout.find((e) => e.id === 'ping').offline, 'ping online');
  run.elapsed = 5;
  g = buildGuide(run);
  assert(!g.loadout.find((e) => e.id === 'load-balancer').offline, 'back online at offlineUntil');
  assert(g.loadout.filter((e) => e.kind === 'passive').every((e) => e.offline === false), 'passives never offline');
});

test('guide G3: stat text uses the level-up wording', () => {
  assertEqual(describeStatChange({ stat: 'damage', from: null, to: 12 }), 'Damage 12');
  assertEqual(describeStatChange({ stat: 'cooldown', from: 0.7, to: 0.6 }), 'Cooldown 0.7 s → 0.6 s');
  assertEqual(describeStatChange({ stat: 'moveSpeedPercent', from: null, to: 10 }), 'Move speed +10%');
});

// ---- G4: icons ----

test('guide G4: shapePoints gives the play-field vertices for every shape', () => {
  const expect = { square: [4, Math.PI / 4], triangle: [3, -Math.PI / 2], hexagon: [6, 0], diamond: [4, 0], octagon: [8, Math.PI / 8] };
  for (const [shape, [n, rot]] of Object.entries(expect)) {
    const pts = shapePoints(shape, 10);
    assertEqual(pts.length, n, shape);
    pts.forEach(([x, y], i) => {
      const a = rot + (i * Math.PI * 2) / n;
      assert(Math.abs(x - Math.cos(a) * 10) < 1e-9 && Math.abs(y - Math.sin(a) * 10) < 1e-9, `${shape} vertex ${i}`);
    });
  }
  assertEqual(shapePoints('circle', 10), null);
});

test('guide G4: icons use data colours, locked icons only the grey silhouette; all decorative and static', async () => {
  const run = await incidentRun();
  const locked = buildGuide(run);
  meetAll(run);
  const open = buildGuide(run);
  for (let i = 0; i < open.problems.length; i++) {
    const on = problemIcon(open.problems[i]);
    const off = problemIcon(locked.problems[i]);
    assert(on.includes(open.problems[i].color), `${open.problems[i].id} uses its colour`);
    assert(off.includes(LOCKED_COLOR) && !off.includes(open.problems[i].color), `${open.problems[i].id} silhouette is grey only`);
  }
  for (const def of run.data.tools) assert(loadoutIcon(def).includes(TOOL_COLORS[def.id]), `${def.id} icon colour`);
  const all = [...open.problems, ...open.incidents, ...locked.incidents].map((p) => problemIcon(p))
    .concat([...run.data.tools, ...run.data.passives, { id: 'unknown' }].map((d) => loadoutIcon(d)));
  for (const s of all) {
    assert(s.includes('aria-hidden="true"'), 'aria-hidden');
    assert(!/<animate/.test(s), 'no animation');
  }
});

// ---- G5: building the guide changes nothing ----

test('guide G5: buildGuide leaves the run hash unchanged mid-run with incidents and offline tools', async () => {
  const run = await incidentRun();
  untilLevel(run, 12);
  advance(run, 600);
  run.engineer.tools.push({ id: 'load-balancer', rank: 2, cooldownLeft: 0, offlineUntil: run.elapsed + 3 });
  run.enemies[0] && (run.enemies[0].infected = true);
  const before = hashRun(run);
  const json = JSON.stringify(run.encountered);
  buildGuide(run);
  buildGuide(run);
  assertEqual(hashRun(run), before);
  assertEqual(JSON.stringify(run.encountered), json);
  assert(run.enemies.filter((e) => e.incidentId !== undefined).length >= 2, 'two incidents active');
});

// ---- Feature 006: new items, effective values, Capacity Planning ----

test('guide (006): 7 tools, 6 passives, Capacity Planning entry; owned tools carry effective values', async () => {
  const run = await quietRun();
  run.engineer.passives.push({ id: 'link-aggregation', rank: 2 });
  run.engineer.capacityTakes = 3;
  const g = buildGuide(run);
  assertEqual(g.loadout.filter((e) => e.kind === 'tool').length, 7);
  assertEqual(g.loadout.filter((e) => e.kind === 'passive').length, 6);
  assertEqual(g.capacity.timesTaken, 3);
  assertEqual(g.capacity.totalPercent, 15);
  const ping = g.loadout.find((e) => e.id === 'ping');
  // Link Aggregation rank 2 + 3 × 5%, read from the data.
  const la = run.defs.passive.get('link-aggregation').ranks[1].damagePercent;
  const want = 10 * (1 + (la + 15) / 100);
  assertEqual(Math.round(ping.effective.damage * 1000) / 1000, Math.round(want * 1000) / 1000);
  assertEqual(describeStatWithBonus(ping.stats[0], ping.effective.damage), `Damage 10 (${Math.round(want * 100) / 100} with bonuses)`);
  assertEqual(ping.stats.map(describeStatChange)[0], 'Damage 10', 'map() never adds a bonus');
  assert(g.loadout.filter((e) => !e.owned).every((e) => e.effective === null), 'unowned: no effective values');
  for (const def of run.data.tools) assert(loadoutIcon(def).includes(TOOL_COLORS[def.id]), `${def.id} icon`);
});
