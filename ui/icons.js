// Shape geometry and icons shared by the play field and the Field Guide (feature 005 research R5).
// DOM-free: icons are SVG markup strings, decorative (aria-hidden) and static.

// Play-field colours for each tool's visuals (render.js draws with these too).
export const TOOL_COLORS = {
  ping: '#e2e8f0',
  'load-balancer': '#a3e635',
  'firewall-rule': '#22d3ee',
  'ansible-playbook': '#a78bfa',
  traceroute: '#f472b6', // feature 006
  'rate-limiter': '#60a5fa',
  'null-route': '#f43f5e',
};
export const LOCKED_COLOR = '#64748b';

const POLYGONS = {
  square: [4, Math.PI / 4],
  triangle: [3, -Math.PI / 2],
  hexagon: [6, 0],
  diamond: [4, 0],
  octagon: [8, Math.PI / 8],
};

// Vertices of a shape of radius r centred on the origin; null for a circle (any unknown shape).
export function shapePoints(shape, r) {
  const poly = POLYGONS[shape];
  if (!poly) return null;
  const [n, rot] = poly;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

const fmt = (v) => String(Math.round(v * 100) / 100);
const svg = (size, body) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false">${body}</svg>`;

function shapeElement(shape, r, attrs) {
  const pts = shapePoints(shape, r);
  if (!pts) return `<circle cx="0" cy="0" r="${fmt(r)}" ${attrs}/>`;
  return `<polygon points="${pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}" ${attrs}/>`;
}

// Enemy or Major Incident: the play-field shape in its data colour, or a grey silhouette when locked.
export function problemIcon(entry, size = 40) {
  if (entry.locked || !entry.color) {
    return svg(size, shapeElement(entry.shape, 14, `fill="none" stroke="${LOCKED_COLOR}" stroke-width="2" stroke-dasharray="3 2"`));
  }
  const c = entry.color;
  return svg(size, shapeElement(entry.shape, 14, `fill="${c}33" stroke="${c}" stroke-width="2"`) +
    `<circle cx="0" cy="0" r="2.6" fill="${c}"/>`);
}

const TOOL_ICONS = {
  'projectile-nearest': (c) =>
    `<line x1="-14" y1="8" x2="2" y2="-2" stroke="${c}" stroke-width="2" stroke-opacity="0.4"/>` +
    `<circle cx="6" cy="-5" r="5" fill="${c}"/>`,
  orbit: (c) =>
    `<circle cx="0" cy="0" r="12" fill="none" stroke="${c}" stroke-width="1.5" stroke-opacity="0.4"/>` +
    `<circle cx="0" cy="0" r="3" fill="${c}"/>` +
    shapeElement('hexagon', 5, `transform="translate(12 0)" fill="${c}33" stroke="${c}" stroke-width="1.5"`) +
    shapeElement('hexagon', 5, `transform="translate(-12 0)" fill="${c}33" stroke="${c}" stroke-width="1.5"`),
  pulse: (c) =>
    `<circle cx="0" cy="0" r="15" fill="none" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="0" cy="0" r="8" fill="none" stroke="${c}" stroke-width="1.5" stroke-opacity="0.5"/>` +
    `<circle cx="0" cy="0" r="2.5" fill="${c}"/>`,
  spread: (c) =>
    `<circle cx="-10" cy="8" r="3" fill="${c}" fill-opacity="0.6"/>` +
    [-0.6, 0, 0.6].map((a) => {
      const x = -10 + Math.sin(a) * 20;
      const y = 8 - Math.cos(a) * 20;
      return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3.5" fill="${c}"/>`;
    }).join(''),
  // Feature 006
  chain: (c) =>
    `<polyline points="-14,10 -4,-8 6,6 14,-10" fill="none" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="-14" cy="10" r="3" fill="${c}"/><circle cx="-4" cy="-8" r="3" fill="${c}"/>` +
    `<circle cx="6" cy="6" r="3" fill="${c}"/><circle cx="14" cy="-10" r="3" fill="${c}"/>`,
  aura: (c) =>
    `<circle cx="0" cy="0" r="15" fill="${c}22" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/>` +
    `<circle cx="0" cy="0" r="3.5" fill="${c}"/>`,
  zone: (c) =>
    `<circle cx="0" cy="0" r="14" fill="#020617" stroke="${c}" stroke-width="3"/>` +
    `<circle cx="0" cy="0" r="6" fill="none" stroke="${c}" stroke-width="1.5" stroke-opacity="0.6"/>`,
};

const PASSIVE_COLOR = '#facc15';
const PASSIVE_ICONS = {
  'bandwidth-upgrade': (c) =>
    `<polyline points="-12,-10 -2,0 -12,10" fill="none" stroke="${c}" stroke-width="3"/>` +
    `<polyline points="0,-10 10,0 0,10" fill="none" stroke="${c}" stroke-width="3"/>`,
  'redundant-power-supply': (c) =>
    `<rect x="-14" y="-12" width="28" height="9" rx="2" fill="${c}33" stroke="${c}" stroke-width="2"/>` +
    `<rect x="-14" y="3" width="28" height="9" rx="2" fill="${c}33" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="9" cy="-7.5" r="1.8" fill="${c}"/><circle cx="9" cy="7.5" r="1.8" fill="${c}"/>`,
  // Feature 006
  'qos-policy': (c) =>
    `<rect x="-14" y="-13" width="28" height="6" rx="1" fill="${c}"/>` +
    `<rect x="-14" y="-3" width="20" height="6" rx="1" fill="${c}" fill-opacity="0.7"/>` +
    `<rect x="-14" y="7" width="12" height="6" rx="1" fill="${c}" fill-opacity="0.45"/>`,
  'link-aggregation': (c) =>
    `<line x1="-14" y1="-8" x2="4" y2="-8" stroke="${c}" stroke-width="2.5"/>` +
    `<line x1="-14" y1="0" x2="4" y2="0" stroke="${c}" stroke-width="2.5"/>` +
    `<line x1="-14" y1="8" x2="4" y2="8" stroke="${c}" stroke-width="2.5"/>` +
    `<path d="M4,-11 L14,0 L4,11 Z" fill="${c}"/>`,
  'observability-stack': (c) =>
    `<path d="M-14,8 A14,14 0 0 1 14,8" fill="none" stroke="${c}" stroke-width="2.5"/>` +
    `<line x1="0" y1="8" x2="8" y2="-4" stroke="${c}" stroke-width="2.5"/><circle cx="0" cy="8" r="3" fill="${c}"/>`,
  'hardened-config': (c) =>
    `<path d="M0,-15 L13,-9 L13,2 C13,9 7,13 0,16 C-7,13 -13,9 -13,2 L-13,-9 Z" fill="${c}33" stroke="${c}" stroke-width="2"/>` +
    `<polyline points="-6,1 -1,6 7,-5" fill="none" stroke="${c}" stroke-width="2.5"/>`,
};

// Capacity Planning (feature 006): a stacked-up arrow.
export function repeatableIcon(size = 40) {
  const c = '#4ade80';
  return svg(size, `<rect x="-14" y="6" width="28" height="7" rx="1" fill="${c}55" stroke="${c}" stroke-width="1.5"/>` +
    `<rect x="-10" y="-3" width="20" height="7" rx="1" fill="${c}55" stroke="${c}" stroke-width="1.5"/>` +
    `<path d="M0,-16 L8,-7 L-8,-7 Z" fill="${c}"/>`);
}

// Tool (by its kind, in its play-field colour) or passive (by id, generic circle if unknown).
export function loadoutIcon(def, size = 40) {
  if (def.kind && TOOL_ICONS[def.kind]) return svg(size, TOOL_ICONS[def.kind](TOOL_COLORS[def.id] ?? '#e2e8f0'));
  const draw = PASSIVE_ICONS[def.id];
  if (draw) return svg(size, draw(PASSIVE_COLOR));
  return svg(size, `<circle cx="0" cy="0" r="12" fill="${PASSIVE_COLOR}33" stroke="${PASSIVE_COLOR}" stroke-width="2"/>`);
}
