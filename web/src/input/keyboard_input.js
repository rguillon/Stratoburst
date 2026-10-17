// Keyboard reduction (D-11). Keys are identified by event.code, the PHYSICAL key position, so
// the same cluster works on QWERTY, AZERTY and QWERTZ layouts. The typed character is never read.

export const KEY_BINDINGS = new Map([
  ['ArrowUp', 'up'],
  ['KeyW', 'up'],
  ['ArrowDown', 'down'],
  ['KeyS', 'down'],
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['Space', 'fire'],
  ['KeyJ', 'fire'],
  ['ShiftLeft', 'bomb'],
  ['ShiftRight', 'bomb'],
  ['KeyK', 'bomb'],
  ['Escape', 'pause'],
  ['KeyP', 'pause'],
]);

// Action name -> manifest.buttons key. The bit values come from Python, never from JS.
const BUTTON_ACTIONS = [
  ['fire', 'FIRE'],
  ['bomb', 'BOMB'],
  ['pause', 'PAUSE'],
];

// Pure: applies one key event to the held set; returns whether the code is bound. A keydown
// also records the press edge in `pressed` (when given) so a tap shorter than a frame survives.
export function reduceKey(held, type, code, pressed = null) {
  if (!KEY_BINDINGS.has(code)) return false;
  const action = KEY_BINDINGS.get(code);
  if (type === 'keydown') {
    held.add(action);
    pressed?.add(action);
  } else if (type === 'keyup') {
    held.delete(action);
  }
  return true;
}

function axis(held, negative, positive) {
  return (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
}

export function createKeyboardInput(target = window, { onKeyDown } = {}) {
  const held = new Set();
  const pressedSinceSample = new Set();

  function onKey(event) {
    if (event.type === 'keydown') onKeyDown?.(event);
    if (reduceKey(held, event.type, event.code, pressedSinceSample)) event.preventDefault();
  }
  const clear = () => {
    held.clear();
    pressedSinceSample.clear();
  };

  target.addEventListener('keydown', onKey);
  target.addEventListener('keyup', onKey);
  target.addEventListener('blur', clear);
  // Keyup events are lost while the page is away: a hidden tab or a leaving page must not leave
  // a key stuck (RESEARCH Pitfall 8). `target.document` is absent on non-window test targets.
  const doc = target.document;
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') clear();
  };
  target.addEventListener('pagehide', clear);
  doc?.addEventListener('visibilitychange', onVisibility);

  return {
    // A button bit is set when its action is held OR was pressed since the previous sample;
    // Python derives the edges from consecutive samples.
    sample(buttonBits) {
      let buttons = 0;
      for (const [action, name] of BUTTON_ACTIONS) {
        if (held.has(action) || pressedSinceSample.has(action)) buttons |= buttonBits[name];
      }
      pressedSinceSample.clear();
      return { buttons, moveX: axis(held, 'left', 'right'), moveY: axis(held, 'up', 'down') };
    },
    clear,
    dispose() {
      target.removeEventListener('keydown', onKey);
      target.removeEventListener('keyup', onKey);
      target.removeEventListener('blur', clear);
      target.removeEventListener('pagehide', clear);
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
