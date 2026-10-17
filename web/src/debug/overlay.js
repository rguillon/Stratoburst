// On-device debug overlay (only created under ?debug). Text goes in through textContent, never
// innerHTML, and is throttled to 4 Hz so the overlay itself stays out of the frame budget.

const REFRESH_MS = 250;

export function createDebugOverlay(doc = document, now = () => performance.now()) {
  const el = doc.createElement('pre');
  el.id = 'debug-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    margin: '0',
    padding: '4px 6px',
    font: '11px/1.25 ui-monospace, Menlo, Consolas, monospace',
    color: '#b8ffb8',
    background: 'rgba(0, 0, 0, 0.62)',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    zIndex: '1000',
  });

  const button = doc.createElement('button');
  button.id = 'copy-report';
  button.textContent = 'Copy report';
  Object.assign(button.style, {
    position: 'fixed',
    top: '6px',
    right: '6px',
    padding: '10px 14px',
    font: '14px system-ui, sans-serif',
    pointerEvents: 'auto',
    zIndex: '1001',
  });
  // The button must not start a drag or a shot on the game surface underneath.
  button.addEventListener('pointerdown', (event) => event.stopPropagation());

  doc.body.append(el, button);

  let lastApplied = Number.NEGATIVE_INFINITY;
  const due = () => now() - lastApplied >= REFRESH_MS;

  return {
    el,
    button,
    due,
    update(text) {
      if (!due()) return;
      el.textContent = text;
      lastApplied = now();
    },
    onCopy(callback) {
      button.addEventListener('click', callback);
    },
  };
}
