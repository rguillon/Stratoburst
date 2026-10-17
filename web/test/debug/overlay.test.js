import { describe, expect, it, vi } from 'vitest';
import { createDebugOverlay } from '../../src/debug/overlay.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

function setup() {
  const doc = createFakeDocument();
  let now = 1000;
  const overlay = createDebugOverlay(doc, () => now);
  return { doc, overlay, advance: (ms) => (now += ms) };
}

describe('createDebugOverlay', () => {
  it('creates pre#debug-overlay and button#copy-report', () => {
    const { doc } = setup();
    const pre = doc.getElementById('debug-overlay');
    const button = doc.getElementById('copy-report');
    expect(pre.tag).toBe('pre');
    expect(pre.style.pointerEvents).toBe('none');
    expect(button.tag).toBe('button');
    expect(button.textContent).toBe('Copy report');
    expect(button.style.pointerEvents).toBe('auto');
  });

  it('applies the first update and writes through textContent', () => {
    const { overlay } = setup();
    overlay.update('fps 60');
    expect(overlay.el.textContent).toBe('fps 60');
  });

  it('ignores updates arriving less than 250 ms after the last applied one', () => {
    const { overlay, advance } = setup();
    overlay.update('first');
    advance(249);
    overlay.update('too soon');
    expect(overlay.el.textContent).toBe('first');
    advance(1);
    overlay.update('on time');
    expect(overlay.el.textContent).toBe('on time');
  });

  it('reports when an update is due', () => {
    const { overlay, advance } = setup();
    expect(overlay.due()).toBe(true);
    overlay.update('x');
    expect(overlay.due()).toBe(false);
    advance(250);
    expect(overlay.due()).toBe(true);
  });

  it('runs the copy callback when the button is clicked', () => {
    const { doc, overlay } = setup();
    const callback = vi.fn();
    overlay.onCopy(callback);
    doc.getElementById('copy-report').click();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
