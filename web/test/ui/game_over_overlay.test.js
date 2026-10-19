import { describe, expect, it } from 'vitest';
import { RESTART_DELAY_MS, createGameOverOverlay } from '../../src/ui/game_over_overlay.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const FLOW_STATES = { PLAY: 1, GAME_OVER: 8 };
const SLOTS = { FLOW: 0, SCORE: 1, HIGH_SCORE: 2, NEW_RECORD: 3 };

// One frame's header and the slot map, as main.js passes them: update(...frame({ flow: 8 })).
function frame(values = {}) {
  const v = { flow: FLOW_STATES.PLAY, score: 0, best: 0, record: 0, ...values };
  const header = new Float32Array(4);
  header[SLOTS.FLOW] = v.flow;
  header[SLOTS.SCORE] = v.score;
  header[SLOTS.HIGH_SCORE] = v.best;
  header[SLOTS.NEW_RECORD] = v.record;
  return [header, SLOTS];
}

const OVER = { flow: FLOW_STATES.GAME_OVER, score: 12345, best: 20000 };

// A document holding the same markup as index.html. Writes to .final and .best are counted.
function build({ withMarkup = true } = {}) {
  const doc = createFakeDocument();
  const writes = { final: 0, best: 0 };
  const parts = {};
  const el = doc.createElement('div');
  el.id = 'game-over';
  el.hidden = true;
  for (const name of ['final', 'best', 'record']) {
    const part = doc.createElement('div');
    part.className = name;
    let text = '';
    Object.defineProperty(part, 'textContent', {
      get: () => text,
      set(value) {
        text = value;
        if (name in writes) writes[name] += 1;
      },
    });
    part.hidden = name === 'record';
    parts[name] = part;
    el.append(part);
  }
  if (withMarkup) doc.body.append(el);
  const win = createFakeDocument().body; // a stand-in for window: listeners and dispatch only
  const restarts = [];
  const make = () =>
    createGameOverOverlay({
      doc,
      win,
      flowStates: FLOW_STATES,
      onRestart: () => restarts.push(1),
    });
  return { doc, win, el, parts, writes, restarts, make };
}

const space = { code: 'Space', repeat: false };

describe('createGameOverOverlay', () => {
  it('throws when #game-over is missing from the page', () => {
    expect(() => build({ withMarkup: false }).make()).toThrow('#game-over is missing');
  });

  it('exports the 800 ms arm delay', () => {
    expect(RESTART_DELAY_MS).toBe(800);
  });

  it('stays hidden, and writes nothing, while the flow is not GAME_OVER', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(), 0);
    overlay.update(...frame(), 16);
    expect(overlay.el).toBe(t.el);
    expect(t.el.hidden).toBe(true);
    expect(t.writes).toEqual({ final: 0, best: 0 });
  });

  it('stays hidden in the shooting gallery, where the flow is -1', () => {
    const t = build();
    t.make().update(...frame({ flow: -1 }), 0);
    expect(t.el.hidden).toBe(true);
  });

  it('shows on the first GAME_OVER frame with the final and best scores as text', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 100);
    expect(t.el.hidden).toBe(false);
    expect(t.parts.final.textContent).toBe('12345');
    expect(t.parts.best.textContent).toBe('20000');
  });

  it('shows NEW RECORD only when the best was beaten', () => {
    const beaten = build();
    beaten.make().update(...frame({ ...OVER, record: 1 }), 0);
    expect(beaten.parts.record.hidden).toBe(false);
    const kept = build();
    kept.make().update(...frame({ ...OVER, record: 0 }), 0);
    expect(kept.parts.record.hidden).toBe(true);
  });

  it('writes the scores only when they change', () => {
    const t = build();
    const overlay = t.make();
    for (let i = 0; i < 5; i += 1) overlay.update(...frame(OVER), i * 16);
    expect(t.writes).toEqual({ final: 1, best: 1 });
    overlay.update(...frame({ ...OVER, score: 12400 }), 100);
    expect(t.writes).toEqual({ final: 2, best: 1 });
  });

  it('shows 0 for a header value that is not a finite number', () => {
    const t = build();
    t.make().update(...frame({ ...OVER, score: Number.NaN, best: Number.POSITIVE_INFINITY }), 0);
    expect(t.parts.final.textContent).toBe('0');
    expect(t.parts.best.textContent).toBe('0');
  });

  it('ignores a fire key pressed before 800 ms have passed', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 1000);
    overlay.update(...frame(OVER), 1799);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(0);
  });

  it('restarts once on a fire key after 800 ms, and ignores further input', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 1000);
    overlay.update(...frame(OVER), 1800);
    t.win.dispatch('keydown', space);
    t.win.dispatch('keydown', { code: 'KeyJ', repeat: false });
    t.el.dispatch('pointerup', { pointerId: 1 });
    expect(t.restarts).toHaveLength(1);
  });

  it('accepts the second fire key too, and ignores keys that are not fire keys', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 0);
    overlay.update(...frame(OVER), 900);
    t.win.dispatch('keydown', { code: 'ArrowLeft', repeat: false });
    t.win.dispatch('keydown', { code: 'ShiftLeft', repeat: false });
    expect(t.restarts).toHaveLength(0);
    t.win.dispatch('keydown', { code: 'KeyJ', repeat: false });
    expect(t.restarts).toHaveLength(1);
  });

  it('restarts on a tap on the overlay after 800 ms', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 0);
    overlay.update(...frame(OVER), 900);
    t.el.dispatch('pointerdown', { pointerId: 1 });
    t.el.dispatch('pointerup', { pointerId: 1 });
    expect(t.restarts).toHaveLength(1);
  });

  it('ignores a tap before 800 ms', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 0);
    overlay.update(...frame(OVER), 400);
    t.el.dispatch('pointerdown', { pointerId: 1 });
    t.el.dispatch('pointerup', { pointerId: 1 });
    expect(t.restarts).toHaveLength(0);
  });

  it('ignores every key while the flow is not GAME_OVER', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(), 0);
    overlay.update(...frame(), 5000);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(0);
  });

  it('hides when the flow leaves GAME_OVER and re-arms for the next game over', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame({ ...OVER, record: 1 }), 0);
    overlay.update(...frame(OVER), 900);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(1);
    overlay.update(...frame(), 916);
    expect(t.el.hidden).toBe(true);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(1);
    overlay.update(...frame({ ...OVER, record: 0 }), 5000);
    expect(t.el.hidden).toBe(false);
    expect(t.parts.record.hidden).toBe(true);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(1);
    overlay.update(...frame({ ...OVER, record: 0 }), 5900);
    t.win.dispatch('keydown', space);
    expect(t.restarts).toHaveLength(2);
  });

  it('adds its listeners once, however many frames run', () => {
    const t = build();
    const overlay = t.make();
    for (let i = 0; i < 4; i += 1) overlay.update(...frame(OVER), i * 500);
    expect(t.win.listenerCount('keydown')).toBe(1);
    expect(t.el.listenerCount('pointerup')).toBe(1);
  });
});

describe('a deliberate restart', () => {
  function armed() {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 0);
    overlay.update(...frame(OVER), 900);
    return { ...t, overlay };
  }

  it('ignores the repeat events of a key that was already held down', () => {
    const t = armed();
    t.win.dispatch('keydown', { code: 'Space', repeat: true });
    t.win.dispatch('keydown', { code: 'KeyJ', repeat: true });
    expect(t.restarts).toHaveLength(0);
  });

  it('restarts on a fresh key press that follows ignored repeats', () => {
    const t = armed();
    t.win.dispatch('keydown', { code: 'Space', repeat: true });
    t.win.dispatch('keydown', { code: 'Space', repeat: false });
    expect(t.restarts).toHaveLength(1);
  });

  it('ignores a pointerup whose pointerdown came before the arm', () => {
    const t = build();
    const overlay = t.make();
    overlay.update(...frame(OVER), 0);
    overlay.update(...frame(OVER), 300);
    t.el.dispatch('pointerdown', { pointerId: 7 });
    overlay.update(...frame(OVER), 900);
    t.el.dispatch('pointerup', { pointerId: 7 });
    expect(t.restarts).toHaveLength(0);
  });

  it('ignores a pointerup with no pointerdown on the overlay', () => {
    const t = armed();
    t.el.dispatch('pointerup', { pointerId: 3 });
    expect(t.restarts).toHaveLength(0);
  });

  it('restarts on a pointerup whose pointerdown came after the arm, matched by pointer id', () => {
    const t = armed();
    t.el.dispatch('pointerdown', { pointerId: 2 });
    t.el.dispatch('pointerup', { pointerId: 9 });
    expect(t.restarts).toHaveLength(0);
    t.el.dispatch('pointerup', { pointerId: 2 });
    expect(t.restarts).toHaveLength(1);
  });

  it('forgets a cancelled pointer', () => {
    const t = armed();
    t.el.dispatch('pointerdown', { pointerId: 2 });
    t.el.dispatch('pointercancel', { pointerId: 2 });
    t.el.dispatch('pointerup', { pointerId: 2 });
    expect(t.restarts).toHaveLength(0);
  });

  it('forgets pointers pressed before the overlay hid, so a stale one never restarts the next game over', () => {
    const { overlay, ...t } = armed();
    t.el.dispatch('pointerdown', { pointerId: 4 });
    overlay.update(...frame(), 1000);
    overlay.update(...frame(OVER), 2000);
    overlay.update(...frame(OVER), 3000);
    t.el.dispatch('pointerup', { pointerId: 4 });
    expect(t.restarts).toHaveLength(0);
  });
});
