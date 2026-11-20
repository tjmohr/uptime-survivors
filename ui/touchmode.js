// Touch mode (specs/003-mobile-touch/contracts/ui-controls.md › Touch mode; data-model.md › Touch Mode).
// On from load when the main pointer is a finger; switched on by the first touch on any other device;
// never switched off in a page session. While on: <body class="touch">, page lock, touch controls.

export function createTouchMode() {
  let on = false;
  const listeners = [];

  function enable() {
    if (on) return;
    on = true;
    document.body.classList.add('touch');
    for (const cb of listeners) cb();
  }

  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'touch') enable(); }, { capture: true });

  // Page lock helpers that CSS cannot do (research T5). Only active in touch mode, so desktop keeps
  // its context menu.
  addEventListener('contextmenu', (ev) => { if (on) ev.preventDefault(); });
  addEventListener('gesturestart', (ev) => { if (on) ev.preventDefault(); });
  addEventListener('dblclick', (ev) => { if (on) ev.preventDefault(); });
  // Firefox for Android starts a text selection on long-press (and shows its "Search with
  // Firefox / Find in page" bar) even with user-select: none, so refuse selections outright,
  // except inside text inputs.
  const editable = (t) => t instanceof Element && t.closest('input, textarea, [contenteditable]');
  addEventListener('selectstart', (ev) => { if (on && !editable(ev.target)) ev.preventDefault(); });
  document.addEventListener('selectionchange', () => {
    if (!on) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed && !editable(sel.anchorNode?.parentElement)) sel.removeAllRanges();
  });

  return {
    get on() { return on; },
    onChange(cb) { listeners.push(cb); },
  };
}
