// The game-over overlay (D-28): the final score, the best score and a NEW RECORD line when the best
// was beaten, shown exactly while the header FLOW is GAME_OVER. It is state-driven, never event-driven,
// so a missed event cannot leave it stuck (Pitfall 6). Text goes in through textContent only, from
// header integers, and only when a value changes.
//
// A fire key or a tap restarts the run through `onRestart`, a DOM handler and never a Python FIRE
// edge: touch auto-fire holds FIRE permanently (Pitfall 9). Input is ignored for the first
// RESTART_DELAY_MS after the overlay appears so a button-mash at the moment of death cannot skip
// it, and a game over restarts at most once.

import { KEY_BINDINGS } from '../input/keyboard_input.js';

export const RESTART_DELAY_MS = 800;

// Whole number for a header value; anything that is not a finite number shows 0.
const wholeNumber = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

// `flowStates` is the manifest's flow state name -> id map. `update(header, slots, nowMs)` runs every
// frame with the header, the manifest's slot names and the frame clock in ms.
export function createGameOverOverlay({
  doc = document,
  win = window,
  flowStates,
  onRestart,
  delayMs = RESTART_DELAY_MS,
}) {
  const el = doc.getElementById('game-over');
  if (!el) throw new Error('#game-over is missing from the page');
  const finalEl = el.querySelector('.final');
  const bestEl = el.querySelector('.best');
  const recordEl = el.querySelector('.record');

  let shown = false;
  let shownAt = 0;
  let now = 0;
  let restarted = false;
  let shownFinal = -1;
  let shownBest = -1;
  // Pointers whose press began on the overlay after it armed; only their release counts as a tap.
  const pressed = new Set();

  // Input counts only while the overlay is up, its delay has passed and the run has not restarted yet.
  const armed = () => shown && !restarted && now - shownAt >= delayMs;

  function restart() {
    restarted = true;
    onRestart();
  }

  // A key held down since before the overlay appeared only produces repeat events; the press that
  // counts is a fresh one.
  win.addEventListener('keydown', (event) => {
    if (!event.repeat && armed() && KEY_BINDINGS.get(event.code) === 'fire') restart();
  });
  el.addEventListener('pointerdown', (event) => {
    if (armed()) pressed.add(event.pointerId);
  });
  el.addEventListener('pointercancel', (event) => {
    pressed.delete(event.pointerId);
  });
  el.addEventListener('pointerup', (event) => {
    const counts = pressed.delete(event.pointerId);
    if (counts && armed()) restart();
  });

  return {
    el,
    update(header, slots, nowMs) {
      now = nowMs;
      if (header[slots.FLOW] !== flowStates.GAME_OVER) {
        if (shown) {
          shown = false;
          pressed.clear();
          el.hidden = true;
        }
        return;
      }
      if (!shown) {
        shown = true;
        shownAt = nowMs;
        restarted = false;
        el.hidden = false;
      }
      const score = wholeNumber(header[slots.SCORE]);
      if (score !== shownFinal) {
        shownFinal = score;
        finalEl.textContent = String(score);
      }
      const best = wholeNumber(header[slots.HIGH_SCORE]);
      if (best !== shownBest) {
        shownBest = best;
        bestEl.textContent = String(best);
      }
      recordEl.hidden = header[slots.NEW_RECORD] !== 1;
    },
  };
}
