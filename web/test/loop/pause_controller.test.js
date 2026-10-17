import { describe, expect, it, vi } from 'vitest';
import { createPauseController } from '../../src/loop/pause_controller.js';

const PAUSED = 1;

// Minimal event target with emit, so a test can fire the browser events the controller hears.
function fakeTarget(extra = {}) {
  const listeners = {};
  return {
    ...extra,
    addEventListener(type, handler) {
      (listeners[type] ??= new Set()).add(handler);
    },
    removeEventListener(type, handler) {
      listeners[type]?.delete(handler);
    },
    listenerCount: (type) => listeners[type]?.size ?? 0,
    emit(type, props = {}) {
      for (const handler of [...(listeners[type] ?? [])]) handler({ type, ...props });
    },
  };
}

function setup() {
  const doc = fakeTarget({ visibilityState: 'visible' });
  const win = fakeTarget();
  const overlayEl = fakeTarget({ hidden: true });
  const inputs = [{ clear: vi.fn() }, { clear: vi.fn() }];
  const game = { set_paused: vi.fn() };
  const loop = { resetClock: vi.fn() };
  const controller = { resetWarmup: vi.fn() };
  const pause = createPauseController({
    bridge: { game, manifest: { flags: { PAUSED, FIRING: 2 } } },
    loop,
    inputs,
    overlayEl,
    controller,
    doc,
    win,
    now: () => 1234,
  });
  return { doc, win, overlayEl, inputs, game, loop, controller, pause };
}

describe('createPauseController triggers (PLAT-08)', () => {
  it('pauses when the page becomes hidden', () => {
    const t = setup();
    t.doc.visibilityState = 'hidden';
    t.doc.emit('visibilitychange');
    expect(t.game.set_paused).toHaveBeenCalledWith(true);
    expect(t.overlayEl.hidden).toBe(false);
    expect(t.pause.reason).toBe('hidden');
  });

  it('does not resume when the page becomes visible again', () => {
    const t = setup();
    t.doc.visibilityState = 'hidden';
    t.doc.emit('visibilitychange');
    t.doc.visibilityState = 'visible';
    t.doc.emit('visibilitychange');
    expect(t.game.set_paused).toHaveBeenCalledTimes(1);
    expect(t.overlayEl.hidden).toBe(false);
  });

  it('pauses on window blur and on pagehide, recording the reason', () => {
    const blur = setup();
    blur.win.emit('blur');
    expect(blur.game.set_paused).toHaveBeenCalledWith(true);
    expect(blur.pause.reason).toBe('blur');
    const hide = setup();
    hide.win.emit('pagehide');
    expect(hide.game.set_paused).toHaveBeenCalledWith(true);
    expect(hide.pause.reason).toBe('pagehide');
  });

  it('clears every input and resets the frame clock on each pause trigger', () => {
    const t = setup();
    t.win.emit('blur');
    for (const input of t.inputs) expect(input.clear).toHaveBeenCalledTimes(1);
    expect(t.loop.resetClock).toHaveBeenCalledTimes(1);
  });

  it('rapid repeated blur events keep it paused and never resume', () => {
    const t = setup();
    for (let i = 0; i < 5; i += 1) t.win.emit('blur');
    expect(t.game.set_paused.mock.calls.every(([value]) => value === true)).toBe(true);
    expect(t.overlayEl.hidden).toBe(false);
  });
});

describe('createPauseController resume needs the player', () => {
  it('resumes on an overlay click: unpauses, resets clock and warm-up, hides the overlay', () => {
    const t = setup();
    t.win.emit('blur');
    t.loop.resetClock.mockClear();
    t.overlayEl.emit('click');
    expect(t.game.set_paused).toHaveBeenLastCalledWith(false);
    expect(t.loop.resetClock).toHaveBeenCalledTimes(1);
    expect(t.controller.resetWarmup).toHaveBeenCalledWith(1234);
    expect(t.overlayEl.hidden).toBe(true);
  });

  it('resumes on pointerup, and a following click is ignored', () => {
    const t = setup();
    t.win.emit('blur');
    t.overlayEl.emit('pointerup');
    t.overlayEl.emit('click');
    expect(t.game.set_paused.mock.calls.filter(([value]) => value === false)).toHaveLength(1);
  });

  it('resumes on a key press while the overlay is shown', () => {
    const t = setup();
    t.win.emit('blur');
    t.win.emit('keydown', { code: 'Space' });
    expect(t.game.set_paused).toHaveBeenLastCalledWith(false);
    expect(t.overlayEl.hidden).toBe(true);
  });

  it.each(['Escape', 'KeyP'])('leaves %s to the Python PAUSE edge', (code) => {
    const t = setup();
    t.win.emit('blur');
    t.win.emit('keydown', { code });
    expect(t.game.set_paused).toHaveBeenCalledTimes(1);
    expect(t.overlayEl.hidden).toBe(false);
  });

  it('ignores key presses while the game is running', () => {
    const t = setup();
    t.win.emit('keydown', { code: 'Space' });
    expect(t.game.set_paused).not.toHaveBeenCalled();
  });

  it('resume() while running does nothing', () => {
    const t = setup();
    t.pause.resume();
    expect(t.game.set_paused).not.toHaveBeenCalled();
    expect(t.loop.resetClock).not.toHaveBeenCalled();
  });
});

describe('createPauseController.sync (header FLAGS drive the overlay)', () => {
  it('shows the overlay and clears inputs when Python pauses (Escape or P)', () => {
    const t = setup();
    t.pause.sync(PAUSED);
    expect(t.overlayEl.hidden).toBe(false);
    for (const input of t.inputs) expect(input.clear).toHaveBeenCalledTimes(1);
    expect(t.pause.reason).toBe('key');
  });

  it('hides the overlay when Python resumes', () => {
    const t = setup();
    t.pause.sync(PAUSED);
    t.pause.sync(0);
    expect(t.overlayEl.hidden).toBe(true);
  });

  it('does nothing on steady frames and ignores unrelated flag bits', () => {
    const t = setup();
    t.pause.sync(2);
    t.pause.sync(2);
    expect(t.overlayEl.hidden).toBe(true);
    t.pause.sync(PAUSED | 2);
    t.pause.sync(PAUSED | 2);
    for (const input of t.inputs) expect(input.clear).toHaveBeenCalledTimes(1);
  });

  it('does not re-clear after a JS-side pause already showed the overlay', () => {
    const t = setup();
    t.win.emit('blur');
    t.pause.sync(PAUSED);
    for (const input of t.inputs) expect(input.clear).toHaveBeenCalledTimes(1);
    expect(t.pause.reason).toBe('blur');
  });
});

describe('createPauseController.dispose', () => {
  it('removes every listener', () => {
    const t = setup();
    t.pause.dispose();
    t.doc.visibilityState = 'hidden';
    t.doc.emit('visibilitychange');
    t.win.emit('blur');
    t.win.emit('pagehide');
    t.overlayEl.emit('click');
    expect(t.game.set_paused).not.toHaveBeenCalled();
    expect(
      ['blur', 'pagehide', 'keydown'].map((type) => t.win.listenerCount(type)),
    ).toEqual([0, 0, 0]);
    expect(t.doc.listenerCount('visibilitychange')).toBe(0);
    expect(['click', 'pointerup'].map((type) => t.overlayEl.listenerCount(type))).toEqual([0, 0]);
  });
});
