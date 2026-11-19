// Testing-only URL parameters (research.md R7, contracts/ui-controls.md):
//   ?seed=<positive integer>   fixed seed
//   ?levelSeconds=<number > 0> every difficulty level lasts this long
// Invalid values are ignored and reported so the HUD can say so.

export function readParams(search) {
  const q = new URLSearchParams(search);
  const result = { seed: null, levelSeconds: null, ignored: [] };

  if (q.has('seed')) {
    const v = Number(q.get('seed'));
    if (Number.isInteger(v) && v > 0 && v <= 0xffffffff) result.seed = v;
    else result.ignored.push('seed');
  }
  if (q.has('levelSeconds')) {
    const v = Number(q.get('levelSeconds'));
    if (Number.isFinite(v) && v > 0) result.levelSeconds = v;
    else result.ignored.push('levelSeconds');
  }
  return result;
}

export function describeParams(p) {
  const active = [];
  if (p.seed !== null) active.push(`seed=${p.seed}`);
  if (p.levelSeconds !== null) active.push(`levelSeconds=${p.levelSeconds}`);
  const parts = [];
  if (active.length) parts.push(`TEST SETTING: ${active.join(' ')}`);
  if (p.ignored.length) parts.push(`ignored test setting: ${p.ignored.join(', ')}`);
  return parts.join(' · ');
}
