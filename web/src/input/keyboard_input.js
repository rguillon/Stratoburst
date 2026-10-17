// Keyboard reduction. Plan 01-06 extends KEY_BINDINGS with the full D-11 table.

export const KEY_BINDINGS = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
]);

// Pure: applies one key event to the held set; returns whether the code is bound.
export function reduceKey(held, type, code) {
  if (!KEY_BINDINGS.has(code)) return false;
  const action = KEY_BINDINGS.get(code);
  if (type === 'keydown') held.add(action);
  else if (type === 'keyup') held.delete(action);
  return true;
}

function axis(held, negative, positive) {
  return (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
}

export function createKeyboardInput(target = window) {
  const held = new Set();

  function onKey(event) {
    if (reduceKey(held, event.type, event.code)) event.preventDefault();
  }
  const onBlur = () => held.clear();

  target.addEventListener('keydown', onKey);
  target.addEventListener('keyup', onKey);
  target.addEventListener('blur', onBlur);

  return {
    sample() {
      return { buttons: 0, moveX: axis(held, 'left', 'right'), moveY: axis(held, 'up', 'down') };
    },
    clear() {
      held.clear();
    },
    dispose() {
      target.removeEventListener('keydown', onKey);
      target.removeEventListener('keyup', onKey);
      target.removeEventListener('blur', onBlur);
    },
  };
}
