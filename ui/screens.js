// HTML overlays: loading, error, title, level-up, pause, end; banners; live-region announcements
// (contracts/ui-controls.md › Screens).

import { formatTime } from './hud.js';

const STAT_LABELS = {
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
const UNITS = {
  cooldown: ' s',
  hitCooldown: ' s',
  rotationSpeed: ' rad/s',
  regenPerSecond: '/s',
  maxUptimeBonus: '',
  moveSpeedPercent: '%',
  pickupRadiusPercent: '%',
  uptimeRestorePercent: '%',
};
const PLUS = new Set(['maxUptimeBonus', 'regenPerSecond', 'moveSpeedPercent', 'pickupRadiusPercent', 'uptimeRestorePercent']);

const fmtValue = (stat, v) => `${PLUS.has(stat) ? '+' : ''}${v}${UNITS[stat] ?? ''}`;

export function describeStatChange(c) {
  const label = STAT_LABELS[c.stat] ?? c.stat;
  return c.from === null ? `${label} ${fmtValue(c.stat, c.to)}` : `${label} ${fmtValue(c.stat, c.from)} → ${fmtValue(c.stat, c.to)}`;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'onclick') node.addEventListener('click', v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export function createScreens() {
  const overlay = document.getElementById('overlay');
  const live = document.getElementById('live');
  const banner = document.getElementById('banner');
  let current = null;
  let bannerQueue = [];
  let bannerTimer = null;

  function announce(text) {
    live.textContent = '';
    // Re-setting on the next frame makes screen readers announce repeated text too.
    requestAnimationFrame(() => { live.textContent = text; });
  }

  function open(name, panel, spoken) {
    current = name;
    overlay.replaceChildren(panel);
    overlay.classList.add('open');
    const first = panel.querySelector('button');
    if (first) first.focus();
    if (spoken) announce(spoken);
  }

  function close() {
    current = null;
    overlay.classList.remove('open');
    overlay.replaceChildren();
  }

  function showLoading() {
    open('loading', el('div', { className: 'panel' }, el('p', { className: 'prompt' }, 'Loading…')), 'Loading');
  }

  function showError(errors) {
    const list = el('ul', { className: 'errors' },
      ...errors.map((e) => el('li', {}, `${e.id ?? '—'} · ${e.path || '(file)'}: ${e.message}`)));
    open('error', el('div', { className: 'panel error', role: 'alert' },
      el('h2', {}, 'Game data has errors'),
      el('p', {}, 'The game cannot start until data/game.json is fixed:'),
      list), `Game data has ${errors.length} errors`);
  }

  function showTitle(onStart) {
    open('title', el('div', { className: 'panel' },
      el('h1', {}, 'UPTIME SURVIVORS'),
      el('p', { className: 'prompt' }, 'Network problems are inbound. Keep the network up for 20 levels.'),
      el('ul', { className: 'controls' },
        el('li', {}, 'Move: WASD or arrow keys — your tools fire on their own'),
        el('li', {}, 'Level-up: press 1, 2, or 3 to choose'),
        el('li', {}, 'Pause: Esc or P')),
      el('div', { className: 'btn-row' }, el('button', { onclick: onStart }, 'Start'))),
    'Uptime Survivors. Press Enter to start.');
  }

  function showLevelUp(run, onChoose) {
    const items = run.offer.map((o, i) => {
      let name;
      let desc;
      let rank;
      if (o.kind === 'heal') {
        name = 'Failover';
        desc = 'Everything is fully upgraded. Fail over to healthy links to restore Uptime.';
        rank = '';
      } else {
        const def = (o.kind === 'tool' ? run.defs.tool : run.defs.passive).get(o.id);
        name = def.name;
        desc = `${def.description} (${def.concept})`;
        rank = o.fromRank === 0 ? 'New' : `Rank ${o.fromRank} → ${o.toRank}`;
      }
      const btn = el('button', { className: 'choice', onclick: () => onChoose(i) },
        el('span', {}, el('span', { className: 'key' }, `[${i + 1}] `), el('span', { className: 'name' }, name),
          rank ? el('span', { className: 'rank' }, ` · ${rank}`) : ''),
        el('span', { className: 'desc' }, desc),
        el('span', { className: 'changes' }, o.changes.map(describeStatChange).join(' · ')));
      return el('li', {}, btn);
    });
    const spoken = `Level ${run.engineer.level}. Choose an upgrade: ` +
      run.offer.map((o, i) => `${i + 1}, ${o.kind === 'heal' ? 'Failover' : (o.kind === 'tool' ? run.defs.tool : run.defs.passive).get(o.id).name}`).join('; ');
    open('levelup', el('div', { className: 'panel' },
      el('h2', {}, `Level up — LVL ${run.engineer.level}`),
      el('p', {}, 'Choose one (press 1, 2, or 3):'),
      el('ul', { className: 'choices' }, ...items)), spoken);
  }

  function showPause(onResume, onQuit) {
    open('paused', el('div', { className: 'panel' },
      el('h2', {}, 'Paused'),
      el('p', {}, 'Nothing moves while paused. Press Esc or P to resume.'),
      el('div', { className: 'btn-row' },
        el('button', { onclick: onResume }, 'Resume'),
        el('button', { onclick: onQuit }, 'Quit to Title'))), 'Paused');
  }

  function showEnd(run, { onNew, onReplay }) {
    const win = run.outcome === 'win';
    const e = run.engineer;
    const loadout = [
      ...e.tools.map((t) => `${run.defs.tool.get(t.id).name} (rank ${t.rank})`),
      ...e.passives.map((p) => `${run.defs.passive.get(p.id).name} (rank ${p.rank})`),
    ].join(', ');
    const stats = el('dl', { className: 'stats' },
      el('dt', {}, 'Outcome'), el('dd', {}, win ? 'Win' : 'Loss'),
      el('dt', {}, 'Time survived'), el('dd', {}, formatTime(run.stats.timeSurvived)),
      el('dt', {}, 'Difficulty reached'), el('dd', {}, `${run.stats.highestDifficulty} / ${run.data.difficulty.length}`),
      el('dt', {}, 'Problems resolved'), el('dd', {}, String(run.stats.enemiesDefeated)),
      el('dt', {}, 'Engineer level'), el('dd', {}, String(e.level)),
      el('dt', {}, 'Tools & passives'), el('dd', {}, loadout),
      el('dt', {}, 'Seed'), el('dd', {}, String(run.seed)));
    open('ended', el('div', { className: 'panel' },
      el('h2', {}, win ? 'UPTIME PRESERVED — you win' : 'NETWORK DOWN — run lost'),
      stats,
      el('div', { className: 'btn-row' },
        el('button', { onclick: onNew }, 'New Run'),
        el('button', { onclick: onReplay }, 'Replay Seed'))),
    `${win ? 'You win' : 'Run lost'}. Survived ${formatTime(run.stats.timeSurvived)}, difficulty ${run.stats.highestDifficulty}.`);
  }

  function nextBanner() {
    const item = bannerQueue.shift();
    if (!item) {
      banner.hidden = true;
      bannerTimer = null;
      return;
    }
    banner.textContent = item.text;
    banner.className = 'banner' + (item.threat ? ' threat' : '');
    banner.hidden = false;
    announce(item.text);
    bannerTimer = setTimeout(nextBanner, item.threat ? 2600 : 1600);
  }

  function showBanner(text, threat = false) {
    // A newer "Difficulty N" banner replaces any still waiting, so banners never lag behind play.
    if (!threat) bannerQueue = bannerQueue.filter((b) => b.threat);
    bannerQueue.push({ text, threat });
    if (!bannerTimer) nextBanner();
  }

  function clearBanners() {
    bannerQueue = [];
    clearTimeout(bannerTimer);
    bannerTimer = null;
    banner.hidden = true;
  }

  return {
    get current() { return current; },
    close, announce, showLoading, showError, showTitle, showLevelUp, showPause, showEnd, showBanner, clearBanners,
  };
}
