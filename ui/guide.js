// Field Guide content model (feature 005, data-model.md › Guide). DOM-free and read-only: built from
// validated data, the engineer's loadout, and run.encountered; it never changes the run (FR-015).

import { describeChange } from '../engine/progression.js';
import { TOOL_KIND_FIELDS, RANK_COUNT } from '../engine/content.js';
import { effectiveToolStats, repeatableBonus } from '../engine/stats.js';

const byLevel = (key) => (a, b) => a[key] - b[key];

function problemEntry(def, kind, encountered) {
  const locked = !encountered.includes(def.id);
  return {
    id: def.id,
    kind,
    locked,
    shape: def.shape,
    color: locked ? null : def.color,
    name: locked ? null : def.name,
    concept: locked ? null : def.concept,
    description: locked ? null : def.description,
    arrivalLevel: kind === 'incident' ? def.arrivalLevel : null,
  };
}

// The stats of one rank as level-up style records ({stat, from: null, to}).
function rankStats(def, kind, rank) {
  const values = def.ranks[rank - 1];
  const fields = kind === 'tool' ? TOOL_KIND_FIELDS[def.kind] : Object.keys(values);
  return fields.map((stat) => ({ stat, from: null, to: values[stat] }));
}

function loadoutEntry(run, def, kind) {
  const owned = (kind === 'tool' ? run.engineer.tools : run.engineer.passives).find((x) => x.id === def.id);
  const rank = owned ? owned.rank : 1;
  return {
    id: def.id,
    kind,
    name: def.name,
    concept: def.concept,
    description: def.description,
    owned: Boolean(owned),
    rank,
    stats: rankStats(def, kind, rank),
    next: owned && rank < RANK_COUNT ? describeChange(run.data, { kind, id: def.id, fromRank: rank, toRank: rank + 1 }) : null,
    offline: kind === 'tool' && Boolean(owned) && owned.offlineUntil > run.elapsed,
    // Feature 006: values after passive and Capacity Planning bonuses (owned tools only; null otherwise).
    effective: kind === 'tool' && owned ? effectiveToolStats(run, def.id, rank) : null,
    nextEffective: kind === 'tool' && owned && rank < RANK_COUNT ? effectiveToolStats(run, def.id, rank + 1) : null,
  };
}

// Capacity Planning (feature 006): times taken and the total all-tool damage bonus.
function capacityEntry(run) {
  const def = run.data.repeatable;
  if (!def) return null;
  return {
    id: def.id,
    kind: 'repeatable',
    name: def.name,
    concept: def.concept,
    description: def.description,
    timesTaken: run.engineer.capacityTakes ?? 0,
    totalPercent: repeatableBonus(run),
    perTakePercent: def.damagePercentPerTake,
  };
}

export function buildGuide(run) {
  const data = run.data;
  const encountered = run.encountered ?? [];
  // Stable sorts: data order breaks ties.
  const problems = [...data.enemies].sort(byLevel('debutLevel')).map((d) => problemEntry(d, 'enemy', encountered));
  const incidents = [...(data.incidents ?? [])].sort(byLevel('arrivalLevel')).map((d) => problemEntry(d, 'incident', encountered));
  const loadout = [
    ...data.tools.map((d) => loadoutEntry(run, d, 'tool')),
    ...data.passives.map((d) => loadoutEntry(run, d, 'passive')),
  ];
  return { problems, incidents, loadout, capacity: capacityEntry(run) };
}
