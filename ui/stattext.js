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
};
export const PLUS = new Set(['maxUptimeBonus', 'regenPerSecond', 'moveSpeedPercent', 'pickupRadiusPercent', 'uptimeRestorePercent']);

export const fmtValue = (stat, v) => `${PLUS.has(stat) ? '+' : ''}${v}${UNITS[stat] ?? ''}`;

export function describeStatChange(c) {
  const label = STAT_LABELS[c.stat] ?? c.stat;
  return c.from === null ? `${label} ${fmtValue(c.stat, c.to)}` : `${label} ${fmtValue(c.stat, c.from)} → ${fmtValue(c.stat, c.to)}`;
}
