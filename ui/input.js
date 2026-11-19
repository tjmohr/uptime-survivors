// Keyboard input (contracts/ui-controls.md › Keyboard). Nothing here runs at import time,
// so the pure helper below can be tested outside a browser.

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

// Held keys → {dx, dy}, each −1, 0, or 1. Opposite keys cancel.
export function moveFromKeys(held) {
  const any = (codes) => codes.some((c) => held.has(c));
  return {
    dx: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
    dy: (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0),
  };
}

export function createInput({ onPauseKey, onChoiceKey, onFocusLost, onMuteKey = () => {}, onFocusGained = () => {} }) {
  const held = new Set();

  addEventListener('keydown', (ev) => {
    // Arrow keys on a slider (pause-screen volume) belong to the slider, not to movement.
    const onSlider = ev.target && ev.target.tagName === 'INPUT';
    if (MOVE_KEYS.has(ev.code) && !onSlider) {
      held.add(ev.code);
      if (ev.code.startsWith('Arrow')) ev.preventDefault();
      return;
    }
    if (ev.repeat) return;
    if (ev.code === 'KeyM') {
      onMuteKey();
    } else if (ev.code === 'Escape' || ev.code === 'KeyP') {
      ev.preventDefault();
      onPauseKey();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(ev.code)) {
      onChoiceKey(Number(ev.code.slice(-1)) - 1);
    }
  });
  addEventListener('keyup', (ev) => held.delete(ev.code));

  const lose = () => {
    held.clear();
    onFocusLost();
  };
  addEventListener('blur', lose);
  addEventListener('focus', onFocusGained);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lose();
    else if (document.hasFocus()) onFocusGained();
  });

  return {
    move: () => moveFromKeys(held),
    clear: () => held.clear(),
  };
}
