// The stage banner (D-26): "STAGE n" over the playfield while the header FLOW is INTRO. It is
// state-driven from header FLOW, STAGE and FLOW_T, never event-driven, so a missed event cannot
// leave it stuck. The text is a constant prefix plus the integer stage slot, written through
// textContent only and only when it changes. Later plans add WARNING and STAGE CLEAR here.

// The banner stays fully opaque for this fraction of the intro, then fades to nothing.
export const FADE_START = 0.7;

const wholeNumber = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

// Opacity for an intro progress (FLOW_T, 0 to 1): 1 until FADE_START, then linear down to 0.
function opacityAt(progress) {
  const t = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  return t <= FADE_START ? 1 : (1 - t) / (1 - FADE_START);
}

// `flowStates` is the manifest's flow state name -> id map. `update(header, slots)` runs every frame
// with the header and the manifest's slot names.
export function createBannerOverlay({ doc = document, flowStates }) {
  const el = doc.getElementById('banner');
  if (!el) throw new Error('#banner is missing from the page');

  let shownText = '';
  let shownOpacity = '';

  return {
    el,
    update(header, slots) {
      const stage = wholeNumber(header[slots.STAGE]);
      if (header[slots.FLOW] !== flowStates.INTRO || stage < 1) {
        el.hidden = true;
        return;
      }
      const text = `STAGE ${stage}`;
      if (text !== shownText) {
        shownText = text;
        el.textContent = text;
      }
      const opacity = String(opacityAt(header[slots.FLOW_T]));
      if (opacity !== shownOpacity) {
        shownOpacity = opacity;
        el.style.opacity = opacity;
      }
      el.hidden = false;
    },
  };
}
