// Fans the per-frame events channel out to handlers. Stride 6: type, x, y, a, b, c. The count
// comes from the header (EVENT_N) and is clamped to what the typed array really holds, so a
// corrupt count can never read past the channel. Nothing is allocated per event.
const STRIDE = 6;

export function createFxDispatcher({ handlers = [] } = {}) {
  const list = [...handlers];

  function dispatch(data, n) {
    const count = Math.min(n, Math.floor(data.length / STRIDE));
    for (let i = 0; i < count; i += 1) {
      const base = i * STRIDE;
      const type = data[base] | 0;
      const x = data[base + 1];
      const y = data[base + 2];
      const a = data[base + 3];
      const b = data[base + 4];
      const c = data[base + 5];
      for (let h = 0; h < list.length; h += 1) list[h].handle(type, x, y, a, b, c);
    }
  }

  function add(handler) {
    list.push(handler);
  }

  return { dispatch, add };
}
