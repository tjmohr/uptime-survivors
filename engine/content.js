// Validates the authored game data before any run starts (FR-024, C6).
// Rules: specs/001-survivors-first-playable/data-model.md and contracts/game-data.md.
// Never throws; returns every error found, each naming the item id and path.

export const SHAPES = ['square', 'triangle', 'hexagon', 'diamond', 'octagon'];

export const TOOL_KIND_FIELDS = {
  'projectile-nearest': ['damage', 'cooldown', 'projectileSpeed', 'range', 'pierce'],
  orbit: ['damage', 'barriers', 'orbitRadius', 'rotationSpeed', 'hitCooldown'],
  pulse: ['damage', 'cooldown', 'radius'],
  spread: ['damage', 'cooldown', 'projectiles', 'projectileSpeed', 'range'],
  // Feature 006 (specs/006-late-game-upgrades/data-model.md › Tool Definition)
  chain: ['damage', 'cooldown', 'range', 'hops', 'hopRange'],
  aura: ['damage', 'tickInterval', 'radius', 'slowPercent'],
  zone: ['damage', 'tickInterval', 'cooldown', 'range', 'radius', 'duration'],
};
const INTEGER_RANK_FIELDS = new Set(['pierce', 'barriers', 'projectiles', 'hops']);
// Extra per-stat limits beyond "greater than 0" (feature 006).
const RANK_FIELD_MAX = { slowPercent: 80 };

export const PASSIVE_FIELDS = ['maxUptimeBonus', 'regenPerSecond', 'moveSpeedPercent', 'pickupRadiusPercent',
  'cooldownReductionPercent', 'damagePercent', 'telemetryGainPercent', 'damageReductionPercent'];
// Reductions must leave something: at most 50% per rank (feature 006 FR-010).
const PASSIVE_FIELD_MAX = { cooldownReductionPercent: 50, damageReductionPercent: 50 };
const REPEATABLE_FIELDS = ['id', 'name', 'concept', 'description', 'damagePercentPerTake'];

const BEHAVIOR_FIELDS = {
  chase: [],
  split: ['count', 'scale', 'maxGenerations'],
  blink: ['intervalSeconds', 'distance'],
};

const TOP_FIELDS = ['schemaVersion', 'player', 'caps', 'progression', 'levelUp', 'enemies', 'tools', 'passives', 'repeatable',
  'difficulty', 'incidentSpawnFactor', 'incidents'];
const PLAYER_FIELDS = ['maxUptime', 'moveSpeed', 'pickupRadius', 'invulnerableSeconds', 'startingTool', 'maxTools'];
const CAPS_FIELDS = ['enemies', 'pickups', 'projectiles'];
const PROGRESSION_FIELDS = ['base', 'perLevel'];
const LEVELUP_FIELDS = ['choices', 'fallbackHealPercent', 'toolFloor'];
const ENEMY_FIELDS = ['id', 'name', 'concept', 'description', 'shape', 'color', 'radius', 'health', 'speed',
  'contactDamagePerSecond', 'telemetry', 'behavior', 'debutLevel'];
const TOOL_FIELDS = ['id', 'name', 'concept', 'description', 'kind', 'ranks'];
const PASSIVE_ITEM_FIELDS = ['id', 'name', 'concept', 'description', 'ranks'];
const DIFFICULTY_FIELDS = ['level', 'durationSeconds', 'spawnPerSecond', 'healthMultiplier', 'damageMultiplier',
  'speedMultiplier', 'mix'];
const MULTIPLIERS = ['healthMultiplier', 'damageMultiplier', 'speedMultiplier'];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const LEVEL_COUNT = 20;

// Major Incidents (feature 004, specs/004-major-incidents/data-model.md).
export const INCIDENT_COUNT = 3;
export const INCIDENT_MAX_RADIUS = 80;
export const INCIDENT_FIELDS = ['id', 'name', 'concept', 'description', 'arrivalLevel', 'shape', 'color', 'radius', 'health',
  'speed', 'entrySpeed', 'entryDistance', 'contactDamagePerSecond', 'rewardTelemetry', 'behavior'];
export const INCIDENT_BEHAVIOR_FIELDS = {
  leak: ['intervalSeconds', 'burst', 'maxAlive', 'minionType'],
  'link-down': ['cooldownSeconds', 'warningSeconds', 'offlineSeconds'],
  infect: ['intervalSeconds', 'radius', 'healthMultiplier', 'speedMultiplier'],
};
const TEXT_LIMITS = { name: 40, concept: 80, description: 200 };
export const RANK_COUNT = 5;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function createChecker() {
  const errors = [];
  const add = (path, id, message) => errors.push({ path, id: id ?? null, message });

  const fields = (obj, allowed, path, id) => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) add(`${path}.${key}`, id, `unknown field '${key}'`);
    }
  };

  // Checks a required numeric field. opts: {min, max, gt, integer}
  const num = (obj, key, path, id, opts = {}) => {
    const p = `${path}.${key}`;
    const v = obj[key];
    if (v === undefined) return add(p, id, `missing required field '${key}'`), false;
    if (typeof v !== 'number' || !Number.isFinite(v)) return add(p, id, `'${key}' must be a number`), false;
    if (opts.integer && !Number.isInteger(v)) return add(p, id, `'${key}' must be a whole number`), false;
    if (opts.gt !== undefined && !(v > opts.gt)) return add(p, id, `'${key}' must be greater than ${opts.gt}`), false;
    if (opts.min !== undefined && v < opts.min) return add(p, id, `'${key}' must be at least ${opts.min}`), false;
    if (opts.max !== undefined && v > opts.max) return add(p, id, `'${key}' must be at most ${opts.max}`), false;
    if (opts.lt !== undefined && !(v < opts.lt)) return add(p, id, `'${key}' must be less than ${opts.lt}`), false;
    return true;
  };

  const str = (obj, key, path, id) => {
    const p = `${path}.${key}`;
    if (obj[key] === undefined) return add(p, id, `missing required field '${key}'`), false;
    if (typeof obj[key] !== 'string' || !obj[key].trim()) return add(p, id, `'${key}' must be non-empty text`), false;
    return true;
  };

  const section = (obj, key, allowed, path = key) => {
    if (!isObject(obj[key])) {
      add(path, null, obj[key] === undefined ? `missing required section '${key}'` : `'${key}' must be an object`);
      return null;
    }
    fields(obj[key], allowed, path, null);
    return obj[key];
  };

  return { errors, add, fields, num, str, section };
}

function checkSettings(raw, c) {
  if (raw.schemaVersion !== 1) c.add('schemaVersion', null, 'schemaVersion must equal 1');

  const player = c.section(raw, 'player', PLAYER_FIELDS);
  if (player) {
    c.num(player, 'maxUptime', 'player', null, { gt: 0 });
    c.num(player, 'moveSpeed', 'player', null, { gt: 0 });
    c.num(player, 'pickupRadius', 'player', null, { gt: 0 });
    c.num(player, 'invulnerableSeconds', 'player', null, { min: 0 });
    c.num(player, 'maxTools', 'player', null, { min: 1, integer: true });
    if (typeof player.startingTool !== 'string') {
      c.add('player.startingTool', null, 'missing or invalid startingTool');
    } else if (!(Array.isArray(raw.tools) && raw.tools.some((t) => t && t.id === player.startingTool))) {
      c.add('player.startingTool', player.startingTool, `startingTool '${player.startingTool}' is not a defined tool`);
    }
  }

  const caps = c.section(raw, 'caps', CAPS_FIELDS);
  if (caps) for (const k of CAPS_FIELDS) c.num(caps, k, 'caps', null, { gt: 0, integer: true });

  const prog = c.section(raw, 'progression', PROGRESSION_FIELDS);
  if (prog) for (const k of PROGRESSION_FIELDS) c.num(prog, k, 'progression', null, { gt: 0 });

  const lu = c.section(raw, 'levelUp', LEVELUP_FIELDS);
  if (lu) {
    if (lu.choices !== 3) c.add('levelUp.choices', null, 'levelUp.choices must equal 3');
    c.num(lu, 'fallbackHealPercent', 'levelUp', null, { min: 0, max: 100 });
    // Feature 006: optional tool floor — from each difficulty, a level-up offers only new tools while the
    // engineer has fewer than `tools` tools. Difficulties strictly increase; tools never decrease.
    if (lu.toolFloor !== undefined) {
      if (!Array.isArray(lu.toolFloor)) c.add('levelUp.toolFloor', null, 'toolFloor must be a list');
      else {
        let prev = null;
        lu.toolFloor.forEach((f, i) => {
          const fp = `levelUp.toolFloor[${i}]`;
          if (!isObject(f)) return c.add(fp, null, 'toolFloor entry must be an object');
          c.fields(f, ['difficulty', 'tools'], fp, null);
          const okD = c.num(f, 'difficulty', fp, null, { min: 1, max: LEVEL_COUNT, integer: true });
          const okT = c.num(f, 'tools', fp, null, { min: 1, max: raw.player?.maxTools ?? 4, integer: true });
          if (okD && okT && prev) {
            if (f.difficulty <= prev.difficulty) c.add(`${fp}.difficulty`, null, 'toolFloor difficulties must increase');
            if (f.tools < prev.tools) c.add(`${fp}.tools`, null, 'toolFloor tools must not decrease');
          }
          if (okD && okT) prev = f;
        });
      }
    }
  }
}

function checkEnemies(raw, c) {
  if (!Array.isArray(raw.enemies) || raw.enemies.length === 0) {
    c.add('enemies', null, 'enemies must be a non-empty list');
    return;
  }
  const ids = new Map();
  const shapes = new Map();
  const colors = new Map();
  raw.enemies.forEach((e, i) => {
    const path = `enemies[${i}]`;
    if (!isObject(e)) return c.add(path, null, 'enemy must be an object');
    const id = typeof e.id === 'string' ? e.id : null;
    c.fields(e, ENEMY_FIELDS, path, id);
    if (!id || !ID_PATTERN.test(id)) c.add(`${path}.id`, id, 'id must be kebab-case text');
    else if (ids.has(id)) c.add(`${path}.id`, id, `duplicate enemy id '${id}'`);
    else ids.set(id, i);
    for (const k of ['name', 'concept', 'description']) c.str(e, k, path, id);

    if (!SHAPES.includes(e.shape)) c.add(`${path}.shape`, id, `shape must be one of ${SHAPES.join(', ')}`);
    else if (shapes.has(e.shape)) c.add(`${path}.shape`, id, `shape '${e.shape}' is already used by '${shapes.get(e.shape)}'`);
    else shapes.set(e.shape, id);

    if (typeof e.color !== 'string' || !COLOR_PATTERN.test(e.color)) c.add(`${path}.color`, id, 'color must look like #rrggbb');
    else {
      const key = e.color.toLowerCase();
      if (colors.has(key)) c.add(`${path}.color`, id, `color '${e.color}' is already used by '${colors.get(key)}'`);
      else colors.set(key, id);
    }

    for (const k of ['radius', 'health', 'speed', 'contactDamagePerSecond']) c.num(e, k, path, id, { gt: 0 });
    c.num(e, 'telemetry', path, id, { min: 1, integer: true });
    c.num(e, 'debutLevel', path, id, { min: 1, max: LEVEL_COUNT, integer: true });

    const b = e.behavior;
    const bp = `${path}.behavior`;
    if (!isObject(b)) c.add(bp, id, 'behavior must be an object with a kind');
    else if (!(b.kind in BEHAVIOR_FIELDS)) c.add(`${bp}.kind`, id, `unknown behavior kind '${b.kind}'`);
    else {
      c.fields(b, ['kind', ...BEHAVIOR_FIELDS[b.kind]], bp, id);
      if (b.kind === 'split') {
        c.num(b, 'count', bp, id, { min: 2, integer: true });
        c.num(b, 'scale', bp, id, { gt: 0, lt: 1 });
        c.num(b, 'maxGenerations', bp, id, { min: 1, integer: true });
      } else if (b.kind === 'blink') {
        c.num(b, 'intervalSeconds', bp, id, { gt: 0 });
        c.num(b, 'distance', bp, id, { gt: 0 });
      }
    }
  });
}

function checkRanks(item, path, id, c, allowedFields, rankCheck) {
  if (!Array.isArray(item.ranks) || item.ranks.length !== RANK_COUNT) {
    c.add(`${path}.ranks`, id, `must have exactly ${RANK_COUNT} ranks`);
    return;
  }
  item.ranks.forEach((r, ri) => {
    const rp = `${path}.ranks[${ri}]`;
    if (!isObject(r)) return c.add(rp, id, 'rank must be an object');
    c.fields(r, allowedFields, rp, id);
    rankCheck(r, rp);
  });
}

function checkToolsAndPassives(raw, c) {
  const ids = new Map();
  const claim = (id, path) => {
    if (!id || !ID_PATTERN.test(id)) return c.add(`${path}.id`, id, 'id must be kebab-case text');
    if (ids.has(id)) return c.add(`${path}.id`, id, `duplicate id '${id}' (also used by ${ids.get(id)})`);
    ids.set(id, path);
  };

  if (!Array.isArray(raw.tools) || raw.tools.length === 0) c.add('tools', null, 'tools must be a non-empty list');
  else raw.tools.forEach((t, i) => {
    const path = `tools[${i}]`;
    if (!isObject(t)) return c.add(path, null, 'tool must be an object');
    const id = typeof t.id === 'string' ? t.id : null;
    c.fields(t, TOOL_FIELDS, path, id);
    claim(id, path);
    for (const k of ['name', 'concept', 'description']) c.str(t, k, path, id);
    const kindFields = TOOL_KIND_FIELDS[t.kind];
    if (!kindFields) return c.add(`${path}.kind`, id, `kind must be one of ${Object.keys(TOOL_KIND_FIELDS).join(', ')}`);
    checkRanks(t, path, id, c, kindFields, (r, rp) => {
      for (const k of kindFields) c.num(r, k, rp, id, { gt: 0, integer: INTEGER_RANK_FIELDS.has(k), max: RANK_FIELD_MAX[k] });
    });
  });

  if (!Array.isArray(raw.passives)) c.add('passives', null, 'passives must be a list');
  else raw.passives.forEach((p, i) => {
    const path = `passives[${i}]`;
    if (!isObject(p)) return c.add(path, null, 'passive must be an object');
    const id = typeof p.id === 'string' ? p.id : null;
    c.fields(p, PASSIVE_ITEM_FIELDS, path, id);
    claim(id, path);
    for (const k of ['name', 'concept', 'description']) c.str(p, k, path, id);
    let firstKeys = null;
    checkRanks(p, path, id, c, PASSIVE_FIELDS, (r, rp) => {
      const keys = Object.keys(r).filter((k) => PASSIVE_FIELDS.includes(k)).sort().join(',');
      if (!keys) c.add(rp, id, 'rank must set at least one passive stat');
      if (firstKeys === null) firstKeys = keys;
      else if (keys !== firstKeys) c.add(rp, id, 'every rank must set the same stats');
      for (const k of Object.keys(r)) if (PASSIVE_FIELDS.includes(k)) c.num(r, k, rp, id, { min: 0, max: PASSIVE_FIELD_MAX[k] });
    });
  });

  // Feature 006: the one repeatable upgrade (Capacity Planning).
  const rep = c.section(raw, 'repeatable', REPEATABLE_FIELDS);
  if (rep) {
    const id = typeof rep.id === 'string' ? rep.id : null;
    claim(id, 'repeatable');
    for (const [k, max] of Object.entries(TEXT_LIMITS)) {
      if (c.str(rep, k, 'repeatable', id) && rep[k].length > max) c.add(`repeatable.${k}`, id, `'${k}' must be at most ${max} characters`);
    }
    c.num(rep, 'damagePercentPerTake', 'repeatable', id, { gt: 0 });
  }
}

function checkDifficulty(raw, c) {
  const rows = raw.difficulty;
  if (!Array.isArray(rows) || rows.length !== LEVEL_COUNT) {
    c.add('difficulty', null, `difficulty must have exactly ${LEVEL_COUNT} levels`);
    if (!Array.isArray(rows)) return;
  }
  const enemies = Array.isArray(raw.enemies) ? raw.enemies.filter(isObject) : [];
  // First definition wins, so a duplicate id is reported once instead of cascading.
  const enemyById = new Map();
  for (const e of enemies) if (!enemyById.has(e.id)) enemyById.set(e.id, e);

  rows.forEach((row, i) => {
    const path = `difficulty[${i}]`;
    if (!isObject(row)) return c.add(path, null, 'level must be an object');
    const id = `level-${i + 1}`;
    c.fields(row, DIFFICULTY_FIELDS, path, id);
    if (row.level !== i + 1) c.add(`${path}.level`, id, `level must be ${i + 1} (levels are numbered 1–20 in order)`);
    c.num(row, 'durationSeconds', path, id, { gt: 0 });
    c.num(row, 'spawnPerSecond', path, id, { gt: 0 });
    for (const k of MULTIPLIERS) c.num(row, k, path, id, { min: 1 });
    if (!isObject(row.mix) || Object.keys(row.mix).length === 0) {
      c.add(`${path}.mix`, id, 'mix must list at least one enemy');
    } else {
      for (const [eid, w] of Object.entries(row.mix)) {
        const mp = `${path}.mix.${eid}`;
        const enemy = enemyById.get(eid);
        if (!enemy) c.add(mp, id, `unknown enemy '${eid}'`);
        else if (typeof enemy.debutLevel === 'number' && enemy.debutLevel > i + 1) {
          c.add(mp, id, `'${eid}' cannot appear before its debut level ${enemy.debutLevel}`);
        }
        if (typeof w !== 'number' || !(w > 0)) c.add(mp, id, 'weight must be a number greater than 0');
      }
    }
    // Each level must be at least as hard as the previous one, and harder in at least one measure.
    if (i > 0 && isObject(rows[i - 1])) {
      const prev = rows[i - 1];
      const keys = ['spawnPerSecond', ...MULTIPLIERS];
      if (keys.every((k) => typeof row[k] === 'number' && typeof prev[k] === 'number')) {
        const easier = keys.filter((k) => row[k] < prev[k]);
        if (easier.length) c.add(path, id, `level ${i + 1} is easier than level ${i} in ${easier.join(', ')}`);
        else if (!keys.some((k) => row[k] > prev[k])) c.add(path, id, `level ${i + 1} must be harder than level ${i} in at least one measure`);
      }
    }
  });

  // Each enemy must appear in the mix of its debut level, and level 20 must contain every enemy.
  for (const e of enemies) {
    const row = rows[e.debutLevel - 1];
    if (isObject(row) && isObject(row.mix) && !(e.id in row.mix)) {
      c.add(`difficulty[${e.debutLevel - 1}].mix`, e.id, `'${e.id}' must appear in the mix of its debut level ${e.debutLevel}`);
    }
  }
  const last = rows[LEVEL_COUNT - 1];
  if (isObject(last) && isObject(last.mix)) {
    const missing = enemies.filter((e) => !(e.id in last.mix)).map((e) => e.id);
    if (missing.length) c.add(`difficulty[${LEVEL_COUNT - 1}].mix`, `level-${LEVEL_COUNT}`, `level 20 must include every enemy; missing ${missing.join(', ')}`);
  }
}

function checkIncidents(raw, c) {
  if (raw.incidentSpawnFactor === undefined) c.add('incidentSpawnFactor', null, "missing required field 'incidentSpawnFactor'");
  else c.num(raw, 'incidentSpawnFactor', '', null, { gt: 0, max: 1 }) || null;
  for (const e of c.errors) if (e.path === '.incidentSpawnFactor') e.path = 'incidentSpawnFactor';

  const list = raw.incidents;
  if (!Array.isArray(list)) return c.add('incidents', null, 'incidents must be a list of exactly 3 Major Incidents');
  if (list.length !== INCIDENT_COUNT) c.add('incidents', null, `incidents must have exactly ${INCIDENT_COUNT} entries`);

  const enemies = Array.isArray(raw.enemies) ? raw.enemies.filter(isObject) : [];
  const enemyIds = new Set(enemies.map((e) => e.id));
  const otherIds = new Map();
  for (const [key, label] of [['enemies', 'enemy'], ['tools', 'tool'], ['passives', 'passive']]) {
    if (Array.isArray(raw[key])) for (const x of raw[key]) if (isObject(x) && typeof x.id === 'string') otherIds.set(x.id, label);
  }
  if (isObject(raw.repeatable) && typeof raw.repeatable.id === 'string') otherIds.set(raw.repeatable.id, 'repeatable upgrade');
  const maxEnemyRadius = Math.max(0, ...enemies.map((e) => (typeof e.radius === 'number' ? e.radius : 0)));
  const ids = new Set();
  const levels = new Map();

  list.forEach((inc, i) => {
    const path = `incidents[${i}]`;
    if (!isObject(inc)) return c.add(path, null, 'incident must be an object');
    const id = typeof inc.id === 'string' ? inc.id : null;
    c.fields(inc, INCIDENT_FIELDS, path, id);
    if (!id || !ID_PATTERN.test(id)) c.add(`${path}.id`, id, 'id must be kebab-case text');
    else if (ids.has(id)) c.add(`${path}.id`, id, `duplicate incident id '${id}'`);
    else if (otherIds.has(id)) c.add(`${path}.id`, id, `id '${id}' is already used by a ${otherIds.get(id)}`);
    else ids.add(id);
    for (const [k, max] of Object.entries(TEXT_LIMITS)) {
      if (c.str(inc, k, path, id) && inc[k].length > max) c.add(`${path}.${k}`, id, `'${k}' must be at most ${max} characters`);
    }
    if (c.num(inc, 'arrivalLevel', path, id, { min: 2, max: LEVEL_COUNT, integer: true })) {
      if (levels.has(inc.arrivalLevel)) c.add(`${path}.arrivalLevel`, id, `arrival level ${inc.arrivalLevel} is already used by '${levels.get(inc.arrivalLevel)}'`);
      else levels.set(inc.arrivalLevel, id);
    }
    if (!SHAPES.includes(inc.shape)) c.add(`${path}.shape`, id, `shape must be one of ${SHAPES.join(', ')}`);
    if (typeof inc.color !== 'string' || !COLOR_PATTERN.test(inc.color)) c.add(`${path}.color`, id, 'color must look like #rrggbb');
    if (c.num(inc, 'radius', path, id, { gt: 0, max: INCIDENT_MAX_RADIUS }) && !(inc.radius > maxEnemyRadius)) {
      c.add(`${path}.radius`, id, `radius must be larger than every ordinary enemy (largest is ${maxEnemyRadius})`);
    }
    for (const k of ['health', 'speed', 'contactDamagePerSecond']) c.num(inc, k, path, id, { gt: 0 });
    if (c.num(inc, 'entrySpeed', path, id, { gt: 0 }) && typeof inc.speed === 'number' && inc.entrySpeed < inc.speed) {
      c.add(`${path}.entrySpeed`, id, "'entrySpeed' must be at least 'speed'");
    }
    c.num(inc, 'entryDistance', path, id, { gt: 0, lt: 720 });
    c.num(inc, 'rewardTelemetry', path, id, { min: 1, integer: true });

    // FR-007: contact hurts more than any ordinary enemy at the arrival level.
    const row = Array.isArray(raw.difficulty) ? raw.difficulty[inc.arrivalLevel - 1] : null;
    if (isObject(row) && typeof row.damageMultiplier === 'number' && typeof inc.contactDamagePerSecond === 'number') {
      const strongest = Math.max(0, ...enemies.map((e) => (typeof e.contactDamagePerSecond === 'number' ? e.contactDamagePerSecond : 0)))
        * row.damageMultiplier;
      if (!(inc.contactDamagePerSecond > strongest)) {
        c.add(`${path}.contactDamagePerSecond`, id,
          `must be greater than the strongest ordinary enemy at level ${inc.arrivalLevel} (${Math.round(strongest * 100) / 100}/s)`);
      }
    }

    const b = inc.behavior;
    const bp = `${path}.behavior`;
    if (!isObject(b)) return c.add(bp, id, 'behavior must be an object with a kind');
    if (!(b.kind in INCIDENT_BEHAVIOR_FIELDS)) return c.add(`${bp}.kind`, id, `unknown incident behavior kind '${b.kind}'`);
    c.fields(b, ['kind', ...INCIDENT_BEHAVIOR_FIELDS[b.kind]], bp, id);
    if (b.kind === 'leak') {
      c.num(b, 'intervalSeconds', bp, id, { gt: 0 });
      const burstOk = c.num(b, 'burst', bp, id, { min: 1, integer: true });
      if (c.num(b, 'maxAlive', bp, id, { min: 1, integer: true }) && burstOk && b.maxAlive < b.burst) {
        c.add(`${bp}.maxAlive`, id, "'maxAlive' must be at least 'burst'");
      }
      if (b.minionType === undefined) c.add(`${bp}.minionType`, id, "missing required field 'minionType'");
      else if (!enemyIds.has(b.minionType)) c.add(`${bp}.minionType`, id, `unknown enemy '${b.minionType}'`);
    } else if (b.kind === 'link-down') {
      const ok = ['cooldownSeconds', 'warningSeconds', 'offlineSeconds'].map((k) => c.num(b, k, bp, id, { gt: 0 }));
      if (ok.every(Boolean) && !(b.cooldownSeconds > b.warningSeconds + b.offlineSeconds)) {
        c.add(`${bp}.cooldownSeconds`, id, "'cooldownSeconds' must be greater than 'warningSeconds' + 'offlineSeconds'");
      }
    } else if (b.kind === 'infect') {
      c.num(b, 'intervalSeconds', bp, id, { gt: 0 });
      c.num(b, 'radius', bp, id, { gt: 0 });
      c.num(b, 'healthMultiplier', bp, id, { min: 1 });
      c.num(b, 'speedMultiplier', bp, id, { min: 1 });
    }
  });
}

export function validateGameData(raw) {
  const c = createChecker();
  try {
    if (!isObject(raw)) {
      c.add('', null, 'game data must be a JSON object');
      return { ok: false, errors: c.errors };
    }
    c.fields(raw, TOP_FIELDS, '', null);
    // Top-level unknown-field paths start with '.', normalise them.
    for (const e of c.errors) if (e.path.startsWith('.')) e.path = e.path.slice(1);
    checkSettings(raw, c);
    checkEnemies(raw, c);
    checkToolsAndPassives(raw, c);
    checkDifficulty(raw, c);
    checkIncidents(raw, c);
  } catch (err) {
    c.add('', null, `validator error: ${err && err.message}`);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, data: raw };
}
