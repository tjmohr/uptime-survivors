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

  return {
    get on() { return on; },
    onChange(cb) { listeners.push(cb); },
  };
}
