// World score popups (D-20): a medal catch shows its value where the medal was, rising and fading.
// Only medals pop up (the destroyed-part popups arrive with the boss plans); a regular kill shows
// nothing, so the bullets stay readable. A fixed pool of spans lives inside #popups, reused round
// robin, so a burst of catches never grows the DOM (T-03-15). The text is a rounded integer from the
// event, written through textContent only.

// `events` is the manifest's event name -> id map and `project(x, y)` turns a logical playfield point
// into CSS pixels `{ x, y }` (it may return one reused object). Register the result with the effects
// dispatcher: it only reacts to MEDAL events.
export function createScorePopups({ doc = document, events, project, capacity = 8 }) {
  const root = doc.getElementById('popups');
  if (!root) throw new Error('#popups is missing from the page');

  const spans = [];
  for (let i = 0; i < capacity; i += 1) {
    const span = doc.createElement('span');
    span.className = 'popup';
    span.hidden = true;
    // The rise-and-fade animation ends the popup's life.
    span.addEventListener('animationend', () => {
      span.hidden = true;
    });
    root.append(span);
    spans.push(span);
  }

  let next = 0;
  let shown = 0;

  return {
    root,
    spans,
    // How many popups have been started (e2e reads it through the debug hooks).
    get shown() {
      return shown;
    },
    handle(type, x, y, a) {
      if (type !== events.MEDAL) return;
      const span = spans[next];
      next = (next + 1) % capacity;
      shown += 1;
      const at = project(x, y);
      span.textContent = String(Math.round(Number.isFinite(a) ? a : 0));
      span.style.left = `${at.x}px`;
      span.style.top = `${at.y}px`;
      // Hiding and showing again restarts the CSS animation, also for a span reused while still up.
      span.hidden = true;
      void span.offsetWidth;
      span.hidden = false;
    },
  };
}
