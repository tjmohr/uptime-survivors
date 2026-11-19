import { test, assert, assertEqual, loadGameData } from './harness.js';
import { validateGameData } from '../engine/content.js';

function errorAt(result, path) {
  assert(!result.ok, 'expected validation to fail');
  const err = result.errors.find((e) => e.path === path);
  assert(err, `expected an error at ${path}; got ${JSON.stringify(result.errors)}`);
  return err;
}

test('content: shipped data/game.json is valid', async () => {
  const r = validateGameData(await loadGameData());
  assert(r.ok, 'errors: ' + JSON.stringify(r.errors));
});

test('content: never throws on non-object input', () => {
  for (const bad of [null, undefined, 'text', 42, []]) {
    const r = validateGameData(bad);
    assertEqual(r.ok, false);
    assert(r.errors.length > 0);
  }
});

test('content: missing field names the item and path', async () => {
  const d = await loadGameData();
  delete d.enemies[0].health;
  const err = errorAt(validateGameData(d), 'enemies[0].health');
  assertEqual(err.id, d.enemies[0].id);
});

test('content: duplicate enemy id is rejected', async () => {
  const d = await loadGameData();
  d.enemies[1].id = d.enemies[0].id;
  const err = errorAt(validateGameData(d), 'enemies[1].id');
  assert(/duplicate/i.test(err.message));
});

test('content: tool and passive ids must not collide', async () => {
  const d = await loadGameData();
  d.passives[0].id = d.tools[0].id;
  errorAt(validateGameData(d), 'passives[0].id');
});

test('content: unknown field is rejected', async () => {
  const d = await loadGameData();
  d.enemies[0].colour = '#ffffff';
  const err = errorAt(validateGameData(d), 'enemies[0].colour');
  assertEqual(err.id, d.enemies[0].id);
});

test('content: reused enemy shape is rejected', async () => {
  const d = await loadGameData();
  d.enemies[1].shape = d.enemies[0].shape;
  const err = errorAt(validateGameData(d), 'enemies[1].shape');
  assertEqual(err.id, d.enemies[1].id);
});

test('content: reused enemy colour is rejected (case-insensitive)', async () => {
  const d = await loadGameData();
  d.enemies[1].color = d.enemies[0].color.toUpperCase();
  errorAt(validateGameData(d), 'enemies[1].color');
});

test('content: unknown behavior kind is rejected', async () => {
  const d = await loadGameData();
  d.enemies[0].behavior = { kind: 'teleport' };
  errorAt(validateGameData(d), 'enemies[0].behavior.kind');
});

test('content: a tool must have exactly 5 ranks', async () => {
  const d = await loadGameData();
  d.tools[0].ranks.pop();
  const err = errorAt(validateGameData(d), 'tools[0].ranks');
  assertEqual(err.id, d.tools[0].id);
});

test('content: levelUp.choices must equal 3', async () => {
  const d = await loadGameData();
  d.levelUp.choices = 2;
  errorAt(validateGameData(d), 'levelUp.choices');
});

test('content: startingTool must exist', async () => {
  const d = await loadGameData();
  d.player.startingTool = 'telnet';
  errorAt(validateGameData(d), 'player.startingTool');
});

test('content: difficulty must have exactly 20 rows', async () => {
  const d = await loadGameData();
  d.difficulty.pop();
  errorAt(validateGameData(d), 'difficulty');
});

test('content: difficulty must not get easier', async () => {
  const d = await loadGameData();
  d.difficulty[5].spawnPerSecond = d.difficulty[4].spawnPerSecond - 0.1;
  errorAt(validateGameData(d), 'difficulty[5]');
});

test('content: an enemy cannot appear in a mix before its debut level', async () => {
  const d = await loadGameData();
  const late = d.enemies.find((e) => e.debutLevel > 1);
  d.difficulty[0].mix[late.id] = 1;
  errorAt(validateGameData(d), `difficulty[0].mix.${late.id}`);
});

test('content: level 20 must include every enemy', async () => {
  const d = await loadGameData();
  delete d.difficulty[19].mix[d.enemies[1].id];
  errorAt(validateGameData(d), 'difficulty[19].mix');
});

test('content: every error is collected, not just the first', async () => {
  const d = await loadGameData();
  delete d.enemies[0].health;
  d.levelUp.choices = 4;
  d.player.startingTool = 'telnet';
  const r = validateGameData(d);
  assert(r.errors.length >= 3, `expected ≥3 errors, got ${r.errors.length}`);
});

test('content: every description is one line of at most 120 characters and every item has a concept', async () => {
  const d = await loadGameData();
  for (const item of [...d.enemies, ...d.tools, ...d.passives]) {
    assert(typeof item.concept === 'string' && item.concept.trim(), `${item.id} needs a concept`);
    assert(item.description.length <= 120, `${item.id} description is ${item.description.length} chars`);
    assert(!item.description.includes('\n'), `${item.id} description must be one line`);
  }
});

// ---------- Feature 004: Major Incidents (U1) ----------

const inc = (d, id) => d.incidents.find((x) => x.id === id);

test('content: shipped incidents are valid, three of them at levels 7, 12, 18', async () => {
  const d = await loadGameData();
  assert(validateGameData(d).ok);
  assertEqual(d.incidents.map((i) => i.arrivalLevel), [7, 12, 18]);
});

test('content: broken incident data is rejected naming the incident (U1)', async () => {
  const cases = [
    [(d) => { delete d.incidents; }, 'incidents', null],
    [(d) => { d.incidents.pop(); }, 'incidents', null],
    [(d) => { d.incidents[1].arrivalLevel = 7; }, 'incidents[1].arrivalLevel', 'core-switch-failure'],
    [(d) => { d.incidents[0].id = 'dropped-packet'; }, 'incidents[0].id', 'dropped-packet'],
    [(d) => { d.incidents[0].id = 'ping'; }, 'incidents[0].id', 'ping'],
    [(d) => { d.incidents[0].behavior.kind = 'teleport'; }, 'incidents[0].behavior.kind', 'route-leak'],
    [(d) => { delete inc(d, 'core-switch-failure').behavior.offlineSeconds; }, 'incidents[1].behavior.offlineSeconds', 'core-switch-failure'],
    [(d) => { inc(d, 'ransomware-outbreak').behavior.burst = 3; }, 'incidents[2].behavior.burst', 'ransomware-outbreak'],
    [(d) => { inc(d, 'route-leak').behavior.minionType = 'packet-storm'; }, 'incidents[0].behavior.minionType', 'route-leak'],
    [(d) => { inc(d, 'core-switch-failure').behavior.cooldownSeconds = 5; }, 'incidents[1].behavior.cooldownSeconds', 'core-switch-failure'],
    [(d) => { inc(d, 'route-leak').radius = 20; }, 'incidents[0].radius', 'route-leak'],
    [(d) => { inc(d, 'route-leak').entrySpeed = 10; }, 'incidents[0].entrySpeed', 'route-leak'],
    [(d) => { d.incidentSpawnFactor = 0; }, 'incidentSpawnFactor', null],
    [(d) => { d.incidentSpawnFactor = 1.5; }, 'incidentSpawnFactor', null],
    [(d) => { delete d.incidentSpawnFactor; }, 'incidentSpawnFactor', null],
    [(d) => { inc(d, 'route-leak').contactDamagePerSecond = 5; }, 'incidents[0].contactDamagePerSecond', 'route-leak'],
    [(d) => { inc(d, 'route-leak').hp = 5; }, 'incidents[0].hp', 'route-leak'],
    [(d) => { inc(d, 'route-leak').name = 'x'.repeat(41); }, 'incidents[0].name', 'route-leak'],
    [(d) => { inc(d, 'route-leak').rewardTelemetry = 0; }, 'incidents[0].rewardTelemetry', 'route-leak'],
  ];
  for (const [edit, path, id] of cases) {
    const d = await loadGameData();
    edit(d);
    const r = validateGameData(d);
    const err = errorAt(r, path);
    if (id !== null) assertEqual(err.id, id, path);
  }
});
