// Auto-pause (PLAT-08). The page going hidden, the window losing focus or the page being
// hidden (pagehide) freezes the simulation behind a PAUSED overlay. Time never advances while
// away, and live play resumes only when the player taps the overlay or presses a key, so a
// returning player is never hit by play that ran without them. Python owns the paused state
// (`Game.paused`); this module only asks it to change and mirrors the header FLAGS bit.

// Escape and P toggle pause through Python's PAUSE edge (they reach it as a button bit), so the
// "any key resumes" listener must leave them alone or it would race the edge.
const PYTHON_TOGGLE_CODES = new Set(['Escape', 'KeyP']);

// App-switching shortcuts (Alt-Tab, Cmd-Tab, Ctrl-Tab) send these keys to the page as the player
// comes back; they are not the deliberate "I am ready" press the resume rule asks for.
const SWITCHER_CODES = new Set([
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'Tab',
]);

export function createPauseController({
  bridge,
  loop,
  inputs,
  overlayEl,
  controller,
  doc = document,
  win = window,
  now = () => performance.now(),
}) {
  const pausedBit = bridge.manifest.flags.PAUSED;
  let shown = false;
  let reason = null;

  function clearInputs() {
    for (const input of inputs) input.clear();
  }

  function show(why) {
    shown = true;
    reason = why;
    overlayEl.hidden = false;
  }

  function pause(why) {
    bridge.game.set_paused(true); // idempotent in Python, so repeated blur/focus is harmless
    clearInputs(); // keyup events are lost while away: nothing may stay held (Pitfall 8)
    loop.resetClock(); // the first frame after returning must pass dt 0
    show(why);
  }

  // Everything the JS side owes after play restarts, however the unpause was triggered: the first
  // frame must pass dt 0, and the quality controller must not judge the cheap paused frames.
  function afterResume() {
    loop.resetClock();
    controller.resetWarmup(now());
    shown = false;
    overlayEl.hidden = true;
  }

  function resume() {
    if (!shown) return;
    bridge.game.set_paused(false); // zeroes the accumulator and refresh history in Python
    afterResume();
  }

  // Called every frame with the header FLAGS value. Escape/P pause and resume inside Python;
  // this keeps the overlay in step with that.
  function sync(flags) {
    const paused = (flags & pausedBit) !== 0;
    if (paused === shown) return;
    if (paused) {
      clearInputs();
      show('key');
    } else {
      afterResume(); // Python already unpaused itself (Escape/P)
    }
  }

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') pause('hidden');
  };
  const onBlur = () => pause('blur');
  const onPageHide = () => pause('pagehide');
  const onKeyDown = (event) => {
    if (shown && !PYTHON_TOGGLE_CODES.has(event.code) && !SWITCHER_CODES.has(event.code)) resume();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('blur', onBlur);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('keydown', onKeyDown);
  overlayEl.addEventListener('click', resume);
  overlayEl.addEventListener('pointerup', resume);

  return {
    pause,
    resume,
    sync,
    get reason() {
      return reason;
    },
    dispose() {
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('pagehide', onPageHide);
      win.removeEventListener('keydown', onKeyDown);
      overlayEl.removeEventListener('click', resume);
      overlayEl.removeEventListener('pointerup', resume);
    },
  };
}
