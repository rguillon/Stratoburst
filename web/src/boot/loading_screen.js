// Binds the static loading UI that index.html paints before any module loads. All text goes in
// through textContent.

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

export function createLoadingScreen(doc = document) {
  const root = doc.getElementById('loading');
  const bar = doc.getElementById('progress');
  const fill = doc.getElementById('progress-fill');
  const status = doc.getElementById('loading-status');
  const gateEl = doc.getElementById('start-gate');
  let shownPercent = 0;

  return {
    // fraction in 0..1, or null for "unknown": the bar then animates instead of lying. The bar
    // only ever moves forward.
    setProgress(fraction) {
      if (fraction === null || !Number.isFinite(fraction)) {
        bar.classList.add('indeterminate');
        bar.removeAttribute('aria-valuenow');
        return;
      }
      bar.classList.remove('indeterminate');
      shownPercent = Math.max(shownPercent, clamp01(fraction) * 100);
      fill.style.width = `${shownPercent}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(shownPercent)));
    },
    setStatus(text) {
      status.textContent = text;
    },
    showGate() {
      gateEl.hidden = false;
      root.dataset.gateReady = 'true';
    },
    hide() {
      root.hidden = true;
    },
    gateEl,
  };
}
