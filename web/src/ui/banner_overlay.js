// The stage banner (D-26): "STAGE n" over the playfield while the header FLOW is INTRO, and
// "WARNING" while it is WARNING (D-13, the boss entrance) and "STAGE CLEAR" while it is STAGE_CLEAR
// (D-27, after the bonus tally). It is state-driven from header FLOW,
// STAGE and FLOW_T, never event-driven, so a missed event cannot leave it stuck. The text is a
// constant prefix plus the integer stage slot, written through textContent only and only when it
// changes. The WARNING carries the `warning` class: index.html draws it in red neon and flashes it
// at 2 Hz (never more than 3 flashes per second, and not at all under prefers-reduced-motion).

// The EXTEND banner (D-21) stays up this long, counted on the frame clock.
export const EXTEND_MS = 1200;

// The banner stays fully opaque for this fraction of the intro, then fades to nothing.
export const FADE_START = 0.7;

const wholeNumber = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

// Opacity for an intro progress (FLOW_T, 0 to 1): 1 until FADE_START, then linear down to 0.
function opacityAt(progress) {
  const t = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  return t <= FADE_START ? 1 : (1 - t) / (1 - FADE_START);
}

// `flowStates` is the manifest's flow state name -> id map and `events` its event name -> id map.
// `update(header, slots)` runs every frame with the header and the manifest's slot names. The one
// event-driven element is #extend (static markup, shown with `hidden`; no text is ever written to it):
// `handle` shows it on an EXTEND event and `tick(nowMs)` hides it again after EXTEND_MS.
export function createBannerOverlay({ doc = document, flowStates, events }) {
  const el = doc.getElementById('banner');
  if (!el) throw new Error('#banner is missing from the page');
  const extendEl = doc.getElementById('extend');
  if (!extendEl) throw new Error('#extend is missing from the page');

  let shownText = '';
  let shownOpacity = '';
  let shownClass = '';
  // The extend timer starts at the first tick after the event; a second extend while it is up resets it.
  let extending = false;
  let extendDeadline = null;

  function show(text, className, opacity) {
    if (text !== shownText) {
      shownText = text;
      el.textContent = text;
    }
    if (className !== shownClass) {
      shownClass = className;
      el.className = className;
    }
    if (opacity !== shownOpacity) {
      shownOpacity = opacity;
      el.style.opacity = opacity;
    }
    el.hidden = false;
  }

  return {
    el,
    extendEl,
    // One fx event; only an EXTEND shows the banner.
    handle(type) {
      if (type !== events.EXTEND) return;
      extending = true;
      extendDeadline = null;
      extendEl.hidden = false;
    },
    // Called every frame with the frame clock in ms.
    tick(nowMs) {
      if (!extending) return;
      extendDeadline ??= nowMs + EXTEND_MS;
      if (nowMs >= extendDeadline) {
        extending = false;
        extendEl.hidden = true;
      }
    },
    update(header, slots) {
      const flow = header[slots.FLOW];
      if (flow === flowStates.WARNING) {
        // The flash is a CSS animation of opacity, so the inline opacity of the intro fade is reset.
        show('WARNING', 'warning', '1');
        return;
      }
      if (flow === flowStates.STAGE_CLEAR) {
        show('STAGE CLEAR', '', '1');
        return;
      }
      const stage = wholeNumber(header[slots.STAGE]);
      if (flow !== flowStates.INTRO || stage < 1) {
        if (shownClass !== '') {
          shownClass = '';
          el.className = '';
        }
        el.hidden = true;
        return;
      }
      show(`STAGE ${stage}`, '', String(opacityAt(header[slots.FLOW_T])));
    },
  };
}
