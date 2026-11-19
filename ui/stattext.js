// Stat names, units, and change text shared by the level-up screen and the Field Guide
// (feature 005 research R3). DOM-free.

export const STAT_LABELS = {
  damage: 'Damage',
  cooldown: 'Cooldown',
  projectileSpeed: 'Projectile speed',
  range: 'Range',
  pierce: 'Pierce',
  barriers: 'Barriers',
  orbitRadius: 'Orbit radius',
  rotationSpeed: 'Rotation speed',
  hitCooldown: 'Hit cooldown',
  radius: 'Radius',
  projectiles: 'Projectiles',
  maxUptimeBonus: 'Max Uptime',
  regenPerSecond: 'Uptime regen',
  moveSpeedPercent: 'Move speed',
  pickupRadiusPercent: 'Pickup radius',
  uptimeRestorePercent: 'Restore Uptime',
  // Feature 006
  hops: 'Hops',
  hopRange: 'Hop range',
  slowPercent: 'Slow',
  tickInterval: 'Tick every',
  duration: 'Duration',
  cooldownReductionPercent: 'Cooldowns',
  damagePercent: 'Tool damage',
  telemetryGainPercent: 'Telemetry gain',
  damageReductionPercent: 'Damage taken',
  allDamagePercent: 'All tool damage',
};
export const UNITS = {
  cooldown: ' s',
  hitCooldown: ' s',
  rotationSpeed: ' rad/s',
  regenPerSecond: '/s',
  maxUptimeBonus: '',
  moveSpeedPercent: '%',
  pickupRadiusPercent: '%',
  uptimeRestorePercent: '%',
  slowPercent: '%',
  tickInterval: ' s',
  duration: ' s',
  cooldownReductionPercent: '%',
  damagePercent: '%',
  telemetryGainPercent: '%',
  damageReductionPercent: '%',
  allDamagePercent: '%',
};
export const PLUS = new Set(['maxUptimeBonus', 'regenPerSecond', 'moveSpeedPercent', 'pickupRadiusPercent', 'uptimeRestorePercent',
  'damagePercent', 'telemetryGainPercent', 'allDamagePercent']);
export const MINUS = new Set(['cooldownReductionPercent', 'damageReductionPercent']);

// Display rounding only (feature 006 FR-015a): at most 2 decimals, no trailing zeros.
export const round2 = (v) => Math.round(v * 100) / 100;

export const fmtValue = (stat, v) => `${PLUS.has(stat) ? '+' : MINUS.has(stat) ? '−' : ''}${round2(v)}${UNITS[stat] ?? ''}`;

// One argument only, so `changes.map(describeStatChange)` stays safe.
export function describeStatChange(c) {
  const label = STAT_LABELS[c.stat] ?? c.stat;
  return c.from === null ? `${label} ${fmtValue(c.stat, c.to)}` : `${label} ${fmtValue(c.stat, c.from)} → ${fmtValue(c.stat, c.to)}`;
}

// Feature 006 (FR-015a): `effective` is the value the game uses after passive and Capacity Planning
// bonuses; appended as " (X with bonuses)" when it differs from the rank value. Not passed by .map.
export function describeStatWithBonus(c, effective) {
  const text = describeStatChange(c);
  if (typeof effective !== 'number' || round2(effective) === round2(c.to)) return text;
  return `${text} (${fmtValue(c.stat, effective)} with bonuses)`;
}
