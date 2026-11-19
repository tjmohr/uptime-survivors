// Keyboard and touch input (001 contracts/ui-controls.md › Keyboard; 003 contracts/input.md).
// Nothing here runs at import time, so the pure helper below can be tested outside a browser.

import { joystickStep } from './joystick.js';

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

export function createInput({
  onPauseKey, onChoiceKey, onFocusLost, onMuteKey = () => {}, onFocusGained = () => {},
  canvas = null, isPlaying = () => false,
}) {
  const held = new Set();
  // Touch steering (003 data-model.md › Touch Steering State): one steering pointer at a time.
  const touch = { pointerId: null, base: null, point: null, dx: 0, dy: 0 };

  function endSteering() {
    if (touch.pointerId !== null && canvas && canvas.hasPointerCapture?.(touch.pointerId)) {
      try { canvas.releasePointerCapture(touch.pointerId); } catch {}
    }
    touch.pointerId = null;
    touch.base = touch.point = null;
    touch.dx = touch.dy = 0;
  }

  if (canvas) {
    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'touch' || touch.pointerId !== null || !isPlaying()) return;
      ev.preventDefault();
      touch.pointerId = ev.pointerId;
      touch.base = { x: ev.clientX, y: ev.clientY };
      touch.point = { x: ev.clientX, y: ev.clientY };
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (ev.pointerId !== touch.pointerId) return;
      touch.point = { x: ev.clientX, y: ev.clientY };
      const r = joystickStep(touch.base, touch.point);
      touch.base = r.base;
      touch.dx = r.dx;
      touch.dy = r.dy;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, (ev) => { if (ev.pointerId === touch.pointerId) endSteering(); });
    }
  }

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
    endSteering();
    onFocusLost();
  };
  addEventListener('blur', lose);
  addEventListener('pagehide', lose); // iOS: app switch / tab close (003 FR-016)
  addEventListener('focus', onFocusGained);
  addEventListener('pageshow', (ev) => { if (ev.persisted && !document.hidden) onFocusGained(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lose();
    else if (document.hasFocus()) onFocusGained();
  });

  return {
    // Touch wins while a steering finger is down; otherwise the keyboard.
    move() {
      if (touch.pointerId !== null && !isPlaying()) endSteering();
      return touch.pointerId !== null ? { dx: touch.dx, dy: touch.dy } : moveFromKeys(held);
    },
    joystick: () => (touch.pointerId === null ? null : { base: { ...touch.base }, point: { ...touch.point } }),
    stopSteering: endSteering,
    clear() {
      held.clear();
      endSteering();
    },
  };
}
