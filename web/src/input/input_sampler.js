import { pixelDeltaToPlayfield } from './touch_mapper.js';

const finiteOrZero = (value) => (Number.isFinite(value) ? value : 0);

// Merges keyboard and touch into the single per-frame tick input. Touch mode switches on at the
// first touch pointerdown and off at the next keydown; while on, FIRE is OR-ed into every
// sample (auto-fire, PLYR-03 on touch). The on-screen bomb button, when the page has one, ORs the
// BOMB bit through the same button path as Shift or K. Values never leave here non-finite (T-01-16).
export function createInputSampler({ keyboard, touch, bombButton = null, buttonBits, getMapperArgs }) {
  let touchMode = false;

  return {
    sample() {
      const k = keyboard.sample(buttonBits);
      const t = touch.sample();
      let buttons = k.buttons;
      if (touchMode) buttons |= buttonBits.FIRE;
      if (bombButton?.sample()) buttons |= buttonBits.BOMB;

      let dragX = 0;
      let dragY = 0;
      if (t.dxPx !== 0 || t.dyPx !== 0) {
        const delta = pixelDeltaToPlayfield({ ...getMapperArgs(), dxPx: t.dxPx, dyPx: t.dyPx });
        dragX = finiteOrZero(delta.dx);
        dragY = finiteOrZero(delta.dy);
      }
      return {
        buttons,
        moveX: finiteOrZero(k.moveX),
        moveY: finiteOrZero(k.moveY),
        dragX,
        dragY,
      };
    },
    setTouchMode(on) {
      touchMode = Boolean(on);
    },
    get touchMode() {
      return touchMode;
    },
  };
}
