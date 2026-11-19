// HTML overlays: loading, error, title, level-up, pause, end; banners; live-region announcements
// (contracts/ui-controls.md › Screens).

import { formatTime } from './hud.js';
import { createTapGuard } from './tapguard.js';
import { describeStatChange, describeStatWithBonus } from './stattext.js';
import { effectiveToolStats } from '../engine/stats.js';
import { problemIcon, loadoutIcon, repeatableIcon } from './icons.js';

export { describeStatChange };

// Screens whose touch selections are guarded (003 FR-008, clarification Q5).
const GUARDED = new Set(['levelup', 'paused', 'guide']); // 'guide': feature 005

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

export function createScreens({ touchMode = null } = {}) {
  const overlay = document.getElementById('overlay');
  const live = document.getElementById('live');
  const banner = document.getElementById('banner');
  const alerts = document.getElementById('incident-alerts');
  const alertLines = new Map(); // incidentId → element (feature 006 update to 004's banners)
  const RESOLVED_MS = 3000;
  let current = null;
  let bannerQueue = [];
  let bannerTimer = null;
  let titleStart = null;

  // ---- Tap guard (touch only; mouse, pen, and keyboard are never delayed) ----
  const touchesDown = new Set();
  let guard = null;
  let guardTimer = null;
  let lastPointer = { type: null, armed: true };

  const guardActive = () => guard !== null && touchMode !== null && touchMode.on;
  const canArmNow = () => !guardActive() || guard.canArm(performance.now(), touchesDown);

  // While the guard cannot arm, the panel ignores pointers entirely, so buttons, choices, and sliders
  // never react to an unarmed touch (a cancelled event alone cannot stop a slider moving).
  function refreshGuard() {
    clearTimeout(guardTimer);
    guardTimer = null;
    if (!guardActive()) return overlay.classList.remove('guard-wait');
    const ready = canArmNow();
    overlay.classList.toggle('guard-wait', !ready);
    if (!ready) guardTimer = setTimeout(refreshGuard, Math.max(16, guard.readyAt() - performance.now()));
  }

  addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'touch') touchesDown.add(ev.pointerId); }, { capture: true });
  for (const type of ['pointerup', 'pointercancel']) {
    addEventListener(type, (ev) => {
      if (ev.pointerType !== 'touch') return;
      touchesDown.delete(ev.pointerId);
      if (guard) refreshGuard();
    }, { capture: true });
  }
  overlay.addEventListener('pointerdown', (ev) => {
    const armed = ev.pointerType !== 'touch' || canArmNow();
    lastPointer = { type: ev.pointerType, armed };
    if (!armed) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, { capture: true });
  overlay.addEventListener('click', (ev) => {
    // Backstop: a click produced by an unarmed touch does nothing. Keyboard clicks (Enter/Space) have
    // no preceding pointerdown of type 'touch' and pass through.
    if (lastPointer.type === 'touch' && !lastPointer.armed && ev.detail !== 0) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
    lastPointer = { type: null, armed: true };
  }, { capture: true });
  overlay.addEventListener('input', (ev) => {
    if (lastPointer.type === 'touch' && !lastPointer.armed) ev.stopImmediatePropagation();
  }, { capture: true });

  function announce(text) {
    live.textContent = '';
    // Re-setting on the next frame makes screen readers announce repeated text too.
    requestAnimationFrame(() => { live.textContent = text; });
  }

  function open(name, panel, spoken) {
    current = name;
    guard = GUARDED.has(name) ? createTapGuard(performance.now(), touchesDown) : null;
    lastPointer = { type: null, armed: true };
    refreshGuard();
    overlay.replaceChildren(panel);
    overlay.classList.add('open');
    const first = panel.querySelector('button');
    if (first) first.focus();
    if (spoken) announce(spoken);
  }

  function close() {
    current = null;
    guard = null;
    refreshGuard();
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
      el('p', {}, 'The game cannot start until data/game.json and data/audio.json are fixed:'),
      list), `Game data has ${errors.length} errors`);
  }

  function showTitle(onStart) {
    titleStart = onStart;
    const touch = touchMode !== null && touchMode.on;
    // 003 FR-009: touch devices get touch controls in the reminder.
    const controls = touch
      ? [
        el('li', {}, 'Steer: touch and drag anywhere — your tools fire on their own'),
        el('li', {}, 'Level-up: lift your finger, then tap a choice'),
        el('li', {}, 'Pause: ❚❚ button'),
        el('li', {}, 'Sound: ♪ button')]
      : [
        el('li', {}, 'Move: WASD or arrow keys — your tools fire on their own'),
        el('li', {}, 'Level-up: press 1, 2, or 3 to choose'),
        el('li', {}, 'Pause: Esc or P'),
        el('li', {}, 'Sound: M to mute')];
    open('title', el('div', { className: 'panel' },
      el('h1', {}, 'UPTIME SURVIVORS'),
      el('p', { className: 'prompt' }, 'Network problems are inbound. Keep the network up for 20 levels.'),
      el('ul', { className: 'controls' }, ...controls),
      el('div', { className: 'btn-row' }, el('button', { onclick: onStart }, 'Start'))),
    touch ? 'Uptime Survivors. Tap Start to begin.' : 'Uptime Survivors. Press Enter to start.');
  }
  if (touchMode) touchMode.onChange(() => { if (current === 'title' && titleStart) showTitle(titleStart); });

  // Stat lines for an offer; tool stats also show the value after current bonuses (feature 006 FR-015a).
  function changeText(run, o) {
    const eff = o.kind === 'tool' ? effectiveToolStats(run, o.id, o.toRank) : null;
    return o.changes.map((c) => describeStatWithBonus(c, eff ? eff[c.stat] : undefined)).join(' · ');
  }
  function offerName(run, o) {
    if (o.kind === 'heal') return 'Failover';
    if (o.kind === 'repeatable') return run.data.repeatable.name;
    return (o.kind === 'tool' ? run.defs.tool : run.defs.passive).get(o.id).name;
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
      } else if (o.kind === 'repeatable') {
        const def = run.data.repeatable; // feature 006: Capacity Planning
        name = def.name;
        desc = `${def.description} (${def.concept})`;
        rank = `Taken ${o.timesTaken}×`;
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
        el('span', { className: 'changes' }, changeText(run, o)));
      return el('li', {}, btn);
    });
    const spoken = `Level ${run.engineer.level}. ${run.offer[0]?.forced ? 'Your network needs more tools. ' : ''}Choose an upgrade: ` +
      run.offer.map((o, i) => `${i + 1}, ${offerName(run, o)}`).join('; ');
    open('levelup', el('div', { className: 'panel' },
      el('h2', {}, `Level up — LVL ${run.engineer.level}`),
      run.offer[0]?.forced ? el('p', { className: 'tool-floor' }, 'Your network needs more tools: choose one.') : '',
      el('p', {}, 'Choose one (press 1, 2, or 3):'),
      el('ul', { className: 'choices' }, ...items)), spoken);
  }

  // sound: {settings, available, onMute, onMusic(pct), onEffects(pct)} (002 contracts/ui-controls.md).
  // Feature 005: { onGuide, focusGuide } adds the Field Guide button and, when returning from the
  // guide, focuses it instead of Resume.
  function showPause(onResume, onQuit, sound, { onGuide = null, focusGuide = false } = {}) {
    const guideBtn = onGuide ? el('button', { id: 'open-guide', onclick: onGuide }, 'Field Guide') : '';
    const panel = el('div', { className: 'panel panel-pause' },
      el('h2', {}, 'Paused'),
      el('p', {}, 'Nothing moves while paused. Press Esc or P to resume.'),
      el('div', { className: 'btn-row' },
        el('button', { onclick: onResume }, 'Resume'),
        guideBtn,
        el('button', { onclick: onQuit }, 'Quit to Title')));
    if (sound) panel.append(soundControls(sound));
    open('paused', panel, focusGuide ? null : 'Paused');
    if (focusGuide && guideBtn) guideBtn.focus();
  }

  // ---- Field Guide (feature 005, contracts/ui-guide.md) ----
  const ENTRY_TEXT = { locked: '???', notMet: 'Not yet encountered' };
  let entrySeq = 0;

  function entry(icon, name, lines) {
    const id = `guide-entry-${++entrySeq}`;
    const art = el('article', { className: 'guide-entry', tabindex: '0', 'aria-labelledby': id });
    const iconBox = el('div', { className: 'guide-icon' });
    iconBox.innerHTML = icon; // SVG markup from ui/icons.js (built only from validated data)
    const text = el('div', { className: 'guide-text' }, el('h4', { id, className: 'guide-name' }, name),
      ...lines.filter(Boolean).map(([cls, t]) => el('p', { className: cls }, t)));
    art.append(iconBox, text);
    return art;
  }

  function problemNode(p) {
    const tag = p.kind === 'incident' ? ['guide-tag', `Major Incident · arrives at difficulty ${p.arrivalLevel}`] : null;
    if (p.locked) {
      const node = entry(problemIcon(p), ENTRY_TEXT.locked, [tag, ['guide-locked', ENTRY_TEXT.notMet]]);
      node.classList.add('locked');
      return node;
    }
    return entry(problemIcon(p), p.name, [tag, ['guide-concept', p.concept], ['guide-desc', p.description]]);
  }

  function loadoutNode(item, def) {
    const status = item.owned ? `Rank ${item.rank} / 5${item.offline ? ' · OFFLINE' : ''}` : 'Not owned';
    const node = entry(loadoutIcon(def), item.name, [
      ['guide-tag' + (item.offline ? ' offline' : ''), status],
      ['guide-concept', item.concept],
      ['guide-desc', item.description],
      ['guide-stats', item.stats.map((c) => describeStatWithBonus(c, item.effective?.[c.stat])).join(' · ')],
      item.next && item.next.length
        ? ['guide-next', `Next rank: ${item.next.map((c) => describeStatWithBonus(c, item.nextEffective?.[c.stat])).join(' · ')}`] : null,
    ]);
    if (item.offline) node.classList.add('offline');
    return node;
  }

  function capacityNode(cap) {
    const status = cap.timesTaken > 0 ? `Taken ${cap.timesTaken}× · All tool damage +${cap.totalPercent}%` : 'Not taken yet';
    return entry(repeatableIcon(), cap.name, [
      ['guide-tag', status],
      ['guide-concept', cap.concept],
      ['guide-desc', cap.description],
      ['guide-stats', `Each time: All tool damage +${cap.perTakePercent}%`],
    ]);
  }

  // model: ui/guide.js › buildGuide(run); defs: run.defs (for loadout icons by tool kind).
  function showGuide(model, defs, { onBack }) {
    entrySeq = 0;
    const list = el('div', { id: 'guide-list', className: 'guide-list', role: 'tabpanel', tabindex: '0' });
    const tabs = [
      { id: 'tab-problems', label: 'Network problems', render: () => [
        el('h3', {}, 'Network problems'), ...model.problems.map(problemNode),
        el('h3', {}, 'Major Incidents'), ...model.incidents.map(problemNode)] },
      { id: 'tab-loadout', label: 'Tools & passives', render: () => {
        const node = (item) => loadoutNode(item, (item.kind === 'tool' ? defs.tool : defs.passive).get(item.id));
        return [el('h3', {}, 'Tools'), ...model.loadout.filter((x) => x.kind === 'tool').map(node),
          el('h3', {}, 'Passives'), ...model.loadout.filter((x) => x.kind === 'passive').map(node),
          ...(model.capacity ? [el('h3', {}, 'Repeatable'), capacityNode(model.capacity)] : [])];
      } },
    ];
    const buttons = tabs.map((t) => el('button', { id: t.id, role: 'tab', type: 'button', 'aria-controls': 'guide-list' }, t.label));
    function select(i, focus = false) {
      buttons.forEach((b, j) => {
        b.setAttribute('aria-selected', String(i === j));
        b.tabIndex = i === j ? 0 : -1;
      });
      list.setAttribute('aria-labelledby', tabs[i].id);
      list.replaceChildren(...tabs[i].render());
      list.scrollTop = 0;
      if (focus) buttons[i].focus();
    }
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => select(i, true));
      b.addEventListener('keydown', (ev) => {
        const n = buttons.length;
        const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[ev.key];
        if (to === undefined) return;
        ev.preventDefault();
        select(to, true);
      });
    });
    const back = el('button', { id: 'guide-back', type: 'button', onclick: onBack }, 'Back');
    const panel = el('div', { className: 'panel guide' },
      el('div', { className: 'guide-header' },
        back,
        el('h2', {}, 'Field Guide'),
        el('div', { role: 'tablist', 'aria-label': 'Field Guide sections', className: 'guide-tabs' }, ...buttons)),
      list);
    select(0);
    open('guide', panel, 'Field Guide');
    buttons[0].focus();
  }

  function soundControls(sound) {
    const s = sound.settings;
    const toggle = el('button', { id: 'sound-toggle', 'aria-pressed': String(!s.muted) });
    const label = () => {
      toggle.textContent = sound.available() ? `Sound: ${s.muted ? 'off' : 'on'} (M)` : 'Sound unavailable';
      toggle.setAttribute('aria-pressed', String(!s.muted));
    };
    toggle.addEventListener('click', () => { sound.onMute(); label(); });
    sound.refresh = label;
    label();
    const slider = (id, name, key, onChange) => {
      const input = el('input', { id, type: 'range', min: '0', max: '100', step: '10', value: String(s[key]),
        'aria-valuetext': `${s[key]}%` });
      const out = el('output', { for: id }, `${s[key]}%`);
      input.addEventListener('input', () => {
        const pct = Number(input.value);
        out.textContent = `${pct}%`;
        input.setAttribute('aria-valuetext', `${pct}%`);
        onChange(pct);
      });
      return [el('label', { for: id }, name), input, out];
    };
    return el('div', { className: 'sound-controls', role: 'group', 'aria-label': 'Sound' },
      toggle, el('span', {}), el('span', {}),
      ...slider('music-volume', 'Music', 'musicVolume', sound.onMusic),
      ...slider('effects-volume', 'Effects', 'effectsVolume', sound.onEffects));
  }

  // Feature 004: each Major Incident as resolved, unresolved (still active at the end), or not reached.
  function incidentSummary(run) {
    if (!run.incidents || run.incidents.length === 0) return [];
    const text = run.incidents.map((r) => {
      const name = run.defs.incident.get(r.id).name;
      if (r.state === 'resolved') return `${name} ✓ resolved`;
      if (r.state === 'active') return `${name} ✗ unresolved`;
      return `${name} — not reached`;
    }).join(' · ');
    return [el('dt', {}, 'Incidents'), el('dd', { class: 'incidents-summary' }, text)];
  }

  function showEnd(run, { onNew, onReplay }) {
    const win = run.outcome === 'win';
    const e = run.engineer;
    const loadout = [
      ...e.tools.map((t) => `${run.defs.tool.get(t.id).name} (rank ${t.rank})`),
      ...e.passives.map((p) => `${run.defs.passive.get(p.id).name} (rank ${p.rank})`),
      ...(e.capacityTakes > 0 ? [`${run.data.repeatable.name} ×${e.capacityTakes}`] : []),
    ].join(', ');
    const stats = el('dl', { className: 'stats' },
      el('dt', {}, 'Outcome'), el('dd', {}, win ? 'Win' : 'Loss'),
      el('dt', {}, 'Time survived'), el('dd', {}, formatTime(run.stats.timeSurvived)),
      el('dt', {}, 'Difficulty reached'), el('dd', {}, `${run.stats.highestDifficulty} / ${run.data.difficulty.length}`),
      el('dt', {}, 'Problems resolved'), el('dd', {}, String(run.stats.enemiesDefeated)),
      el('dt', {}, 'Engineer level'), el('dd', {}, String(e.level)),
      el('dt', {}, 'Tools & passives'), el('dd', {}, loadout),
      ...incidentSummary(run),
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
    clearIncidentAlerts();
  }

  // Major Incident alerts: a pulsing red line per active incident that stays until it is resolved, then
  // turns green ("RESOLVED — …") for 3 s. Announced once through the live region; the lines themselves
  // are hidden from screen readers so nothing is read twice.
  function showIncidentAlert(incidentId, text) {
    let line = alertLines.get(incidentId);
    if (!line) {
      line = el('div', { className: 'incident-alert' });
      alertLines.set(incidentId, line);
      alerts.append(line);
    }
    clearTimeout(line.timer);
    line.className = 'incident-alert active';
    line.textContent = text;
    announce(text);
  }

  function resolveIncidentAlert(incidentId, text) {
    let line = alertLines.get(incidentId);
    if (!line) {
      line = el('div', {});
      alertLines.set(incidentId, line);
      alerts.append(line);
    }
    line.className = 'incident-alert resolved';
    line.textContent = text;
    announce(text);
    clearTimeout(line.timer);
    line.timer = setTimeout(() => {
      line.remove();
      if (alertLines.get(incidentId) === line) alertLines.delete(incidentId);
    }, RESOLVED_MS);
  }

  function clearIncidentAlerts() {
    for (const line of alertLines.values()) clearTimeout(line.timer);
    alertLines.clear();
    alerts.replaceChildren();
  }

  return {
    get current() { return current; },
    close, announce, showLoading, showError, showTitle, showLevelUp, showPause, showGuide, showEnd, showBanner, clearBanners,
    showIncidentAlert, resolveIncidentAlert, clearIncidentAlerts,
  };
}
