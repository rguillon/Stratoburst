// Relative-drag touch input (INPT-02, D-12). Pointer events are tracked per pointerId; only the
// first active pointer steers (a second finger is ignored in Phase 1). The element needs
// `touch-action: none` so the browser never claims the gesture.

const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'];

export function createTouchInput(el, { onTouchMode } = {}) {
  let steering = null; // pointerId of the finger that steers, or null
  let lastX = 0;
  let lastY = 0;
  let dxPx = 0;
  let dyPx = 0;

  function onDown(event) {
    // Controls drawn over the playfield (the bomb button) mark themselves data-no-steer: a pointer
    // that starts on one is not a drag, and must not change the steering pointer (D-13).
    if (event.target?.closest?.('[data-no-steer]')) return;
    if (event.pointerType === 'touch') onTouchMode?.();
    if (steering !== null) return;
    steering = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-gone pointers can throw; steering still works without capture.
    }
  }

  // clientX/clientY differences, not movementX, which is unreliable on iOS.
  function onMove(event) {
    if (event.pointerId !== steering) return;
    dxPx += event.clientX - lastX;
    dyPx += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  // The accumulated delta survives a release so a flick that ends before the next sample is
  // not lost; only clear() drops it.
  function onRelease(event) {
    if (event.pointerId === steering) steering = null;
  }

  function clear() {
    steering = null;
    dxPx = 0;
    dyPx = 0;
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  for (const type of RELEASE_EVENTS) el.addEventListener(type, onRelease);

  return {
    sample() {
      const out = { dxPx, dyPx, active: steering !== null };
      dxPx = 0;
      dyPx = 0;
      return out;
    },
    clear,
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      for (const type of RELEASE_EVENTS) el.removeEventListener(type, onRelease);
    },
  };
}
