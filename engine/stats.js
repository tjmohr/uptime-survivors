// Effective tool stats after passive and repeatable bonuses (feature 006, research R1).
// The single source for these numbers: weapons.js fires with them and every screen shows them (C6).
// Pure: reads the run, never changes it.

const ownedPassiveRank = (run, field) => {
  let total = 0;
  for (const owned of run.engineer.passives) {
    const rank = run.defs.passive.get(owned.id).ranks[owned.rank - 1];
    total += rank[field] ?? 0;
  }
  return total;
};

// Capacity Planning: times taken × per-take percentage.
export function repeatableBonus(run) {
  const rep = run.data.repeatable;
  return rep ? (run.engineer.capacityTakes ?? 0) * rep.damagePercentPerTake : 0;
}

// Link Aggregation and Capacity Planning add together; QoS shortens cooldowns.
export function bonusTotals(run) {
  return {
    damagePercent: ownedPassiveRank(run, 'damagePercent') + repeatableBonus(run),
    cooldownReductionPercent: ownedPassiveRank(run, 'cooldownReductionPercent'),
  };
}

const COOLDOWN_STATS = ['cooldown', 'hitCooldown'];

// The stats a tool fires with at `rank` under the engineer's current bonuses. Only damage, cooldown,
// and hit cooldown change; Rate Limiter's tick interval is not a cooldown (spec FR-009).
export function effectiveToolStats(run, toolId, rank, bonus = bonusTotals(run)) {
  const base = run.defs.tool.get(toolId).ranks[rank - 1];
  const out = { ...base };
  if (bonus.damagePercent) out.damage = base.damage * (1 + bonus.damagePercent / 100);
  if (bonus.cooldownReductionPercent) {
    for (const k of COOLDOWN_STATS) if (k in base) out[k] = base[k] * (1 - bonus.cooldownReductionPercent / 100);
  }
  return out;
}
