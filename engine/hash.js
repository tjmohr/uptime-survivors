// Stable hash of the simulation state, used by determinism tests (SC-006).

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function hashRun(run) {
  const e = run.engineer;
  const parts = [
    run.tick, run.rng.state(), run.phase, run.outcome, run.difficultyLevel, run.pendingLevelUps,
    e.x, e.y, e.uptime, e.maxUptime, e.level, e.telemetry, e.invulnerableUntil,
    e.tools.map((t) => `${t.id}:${t.rank}:${t.cooldownLeft}:${t.offlineUntil || 0}`).join('|'),
    e.passives.map((p) => `${p.id}:${p.rank}`).join('|'),
    run.enemies.map((n) => `${n.id}:${n.typeId}:${n.x}:${n.y}:${n.health}:${n.infected ? 1 : 0}` +
      (n.incidentId !== undefined ? `:${n.phase}:${n.timer}:${n.linkState}:${n.pendingTool}` : '')).join('|'),
    run.projectiles.map((p) => `${p.x}:${p.y}:${p.pierceLeft}`).join('|'),
    run.pickups.map((p) => `${p.x}:${p.y}:${p.value}${p.reward ? ':r' : ''}`).join('|'),
    (run.incidents ?? []).map((r) => `${r.id}:${r.state}`).join('|'),
    (run.encountered ?? []).join('|'),
    run.offer ? run.offer.map((o) => `${o.kind}:${o.id}:${o.toRank}`).join('|') : '',
    run.stats.enemiesDefeated,
  ];
  return fnv1a(parts.join(';'));
}
