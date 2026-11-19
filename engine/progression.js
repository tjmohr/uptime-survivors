// Telemetry, level-ups, upgrade offers, and passive stats (FR-011–FR-015).

import { TOOL_KIND_FIELDS, PASSIVE_FIELDS, RANK_COUNT } from './content.js';

export function telemetryToNext(data, level) {
  return data.progression.base + data.progression.perLevel * (level - 1);
}

export function passiveTotals(run) {
  const totals = Object.fromEntries(PASSIVE_FIELDS.map((k) => [k, 0]));
  for (const owned of run.engineer.passives) {
    const rank = run.defs.passive.get(owned.id).ranks[owned.rank - 1];
    for (const k of PASSIVE_FIELDS) totals[k] += rank[k] ?? 0;
  }
  return totals;
}

// Recomputes engineer stats from base settings plus passive ranks.
export function applyDerivedStats(run) {
  const e = run.engineer;
  const base = run.data.player;
  const t = passiveTotals(run);
  const newMax = base.maxUptime + t.maxUptimeBonus;
  if (newMax > e.maxUptime) e.uptime += newMax - e.maxUptime; // extra capacity arrives healthy
  e.maxUptime = newMax;
  e.uptime = Math.min(e.uptime, e.maxUptime);
  e.moveSpeed = base.moveSpeed * (1 + t.moveSpeedPercent / 100);
  e.pickupRadius = base.pickupRadius * (1 + t.pickupRadiusPercent / 100);
  e.regenPerSecond = t.regenPerSecond;
}

export function addTelemetry(run, amount) {
  const e = run.engineer;
  e.telemetry += amount;
  while (e.telemetry >= e.telemetryToNext) {
    e.telemetry -= e.telemetryToNext;
    e.level += 1;
    e.telemetryToNext = telemetryToNext(run.data, e.level);
    run.pendingLevelUps += 1;
    run.events.push({ type: 'level-up', level: e.level });
  }
}

// Every upgrade the engineer could take right now, in data order (deterministic).
export function candidates(run) {
  const { data, engineer: e } = run;
  const list = [];
  const ownedTools = new Map(e.tools.map((t) => [t.id, t.rank]));
  const ownedPassives = new Map(e.passives.map((p) => [p.id, p.rank]));
  for (const tool of data.tools) {
    const rank = ownedTools.get(tool.id);
    if (rank === undefined) {
      if (e.tools.length < data.player.maxTools) list.push({ kind: 'tool', id: tool.id, fromRank: 0, toRank: 1 });
    } else if (rank < RANK_COUNT) {
      list.push({ kind: 'tool', id: tool.id, fromRank: rank, toRank: rank + 1 });
    }
  }
  for (const passive of data.passives) {
    const rank = ownedPassives.get(passive.id) ?? 0;
    if (rank < RANK_COUNT) list.push({ kind: 'passive', id: passive.id, fromRank: rank, toRank: rank + 1 });
  }
  return list;
}

// The exact stat changes an offer item applies, taken from the same rank tables the engine uses.
export function describeChange(data, item) {
  if (item.kind === 'heal') return [{ stat: 'uptimeRestorePercent', from: null, to: data.levelUp.fallbackHealPercent }];
  if (item.kind === 'tool') {
    const def = data.tools.find((t) => t.id === item.id);
    const to = def.ranks[item.toRank - 1];
    const from = item.fromRank > 0 ? def.ranks[item.fromRank - 1] : null;
    return TOOL_KIND_FIELDS[def.kind]
      .filter((k) => !from || from[k] !== to[k])
      .map((k) => ({ stat: k, from: from ? from[k] : null, to: to[k] }));
  }
  const def = data.passives.find((p) => p.id === item.id);
  const to = def.ranks[item.toRank - 1];
  const from = item.fromRank > 0 ? def.ranks[item.fromRank - 1] : null;
  return Object.keys(to)
    .filter((k) => !from || from[k] !== to[k])
    .map((k) => ({ stat: k, from: from ? from[k] : 0, to: to[k] }));
}

export function buildOffer(run) {
  const pool = candidates(run);
  if (pool.length === 0) {
    const heal = { kind: 'heal', id: 'fallback-heal', fromRank: 0, toRank: 0 };
    return [{ ...heal, changes: describeChange(run.data, heal) }];
  }
  const n = Math.min(run.data.levelUp.choices, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + run.rng.int(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map((item) => ({ ...item, changes: describeChange(run.data, item) }));
}

export function applyUpgrade(run, item) {
  const e = run.engineer;
  if (item.kind === 'heal') {
    e.uptime = Math.min(e.maxUptime, e.uptime + (e.maxUptime * run.data.levelUp.fallbackHealPercent) / 100);
    return;
  }
  const list = item.kind === 'tool' ? e.tools : e.passives;
  const owned = list.find((x) => x.id === item.id);
  if (owned) owned.rank = item.toRank;
  else list.push(item.kind === 'tool' ? { id: item.id, rank: 1, cooldownLeft: 0 } : { id: item.id, rank: 1 });
  if (item.kind === 'passive') applyDerivedStats(run);
}
