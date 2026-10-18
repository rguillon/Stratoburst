// The on-screen bomb button (INPT-03, D-13). It is a plain button that the touch input ignores
// (data-no-steer), so a finger on it never steers and a steering finger never presses it. It
// mirrors keyboard_input.js: a `held` state plus a press latch, so a tap shorter than one frame
// still reaches the next sample. Python acts on the press edge, so holding never repeats bombs.

const INSET_SIDES = ['Left', 'Right', 'Top', 'Bottom'];

// The device's safe-area insets in CSS px (the notch, the rounded corners, the home bar). CSS can
// only expose env() through a property, so a hidden probe is padded with each inset, read back
// through getComputedStyle and removed. A browser without env() support keeps the padding at 0.
export function readSafeInsets(doc = document) {
  const probe = doc.createElement('div');
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  for (const side of INSET_SIDES) {
    probe.style[`padding${side}`] = `env(safe-area-inset-${side.toLowerCase()}, 0px)`;
  }
  doc.body.append(probe);
  const computed = doc.defaultView.getComputedStyle(probe);
  const insets = {};
  for (const side of INSET_SIDES) {
    insets[side.toLowerCase()] = Number.parseFloat(computed[`padding${side}`]) || 0;
  }
  probe.remove();
  return insets;
}

export function createBombButton(el) {
  const down = new Set(); // pointer ids currently on the button
  let pressedSinceSample = false;

  function onDown(event) {
    event.preventDefault();
    // The steering input listens on #app: a press here is not a drag and not a touch-mode switch.
    event.stopPropagation();
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-gone pointers can throw; the press still counts without capture.
    }
    down.add(event.pointerId);
    pressedSinceSample = true;
  }

  function onRelease(event) {
    down.delete(event.pointerId);
  }

  const clear = () => {
    down.clear();
    pressedSinceSample = false;
  };

  const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'];
  el.addEventListener('pointerdown', onDown);
  for (const type of RELEASE_EVENTS) el.addEventListener(type, onRelease);

  return {
    el,
    // True while held, and once more for a press that ended before this sample.
    sample() {
      const pressed = down.size > 0 || pressedSinceSample;
      pressedSinceSample = false;
      return pressed;
    },
    clear,
    setVisible(on) {
      el.hidden = !on;
    },
    // Absolute placement from layoutBombButton, replacing the CSS corner defaults.
    place({ left, top, size }) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      for (const type of RELEASE_EVENTS) el.removeEventListener(type, onRelease);
    },
  };
}
