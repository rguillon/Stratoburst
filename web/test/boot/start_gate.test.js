import { describe, expect, it, vi } from 'vitest';
import { waitForStartGesture } from '../../src/boot/start_gate.js';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  count(type) {
    return this.listeners.get(type)?.size ?? 0;
  }

  fire(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler({ type, ...event });
  }
}

function fakeAudioCtor() {
  const log = { created: 0, resumed: 0, started: [], connected: 0, buffer: null };
  class FakeAudioContext {
    constructor() {
      log.created += 1;
      this.sampleRate = 44100;
      this.destination = { dest: true };
      this.state = 'suspended';
    }

    resume() {
      log.resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createBuffer(channels, length, rate) {
      log.buffer = { channels, length, rate };
      return { buffer: true };
    }

    createBufferSource() {
      return {
        connect: () => {
          log.connected += 1;
        },
        start: (when) => log.started.push(when),
      };
    }
  }
  return { Ctor: FakeAudioContext, log };
}

function setup(extra = {}) {
  const el = new FakeTarget();
  const win = new FakeTarget();
  const { Ctor, log } = fakeAudioCtor();
  const promise = waitForStartGesture(el, { AudioContextCtor: Ctor, win, ...extra });
  return { el, win, log, promise };
}

describe('waitForStartGesture', () => {
  it('does not resolve until a gesture happens', async () => {
    const { promise } = setup();
    const settled = vi.fn();
    promise.then(settled);

    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
  });

  it('listens to click and pointerup, never pointerdown or touchstart (iOS)', () => {
    const { el, win } = setup();

    expect(el.count('click')).toBe(1);
    expect(el.count('pointerup')).toBe(1);
    expect(el.count('pointerdown')).toBe(0);
    expect(el.count('touchstart')).toBe(0);
    expect(win.count('keydown')).toBe(1);
  });

  it('a touch pointerup resolves with pointerType touch', async () => {
    const { el, promise } = setup();

    el.fire('pointerup', { pointerType: 'touch' });

    await expect(promise).resolves.toMatchObject({ pointerType: 'touch' });
  });

  it.each(['mouse', 'pen'])('a %s pointerup reports that pointer type', async (pointerType) => {
    const { el, promise } = setup();

    el.fire('pointerup', { pointerType });

    await expect(promise).resolves.toMatchObject({ pointerType });
  });

  it('a click with no pointer type is a mouse press', async () => {
    const { el, promise } = setup();

    el.fire('click', {});

    await expect(promise).resolves.toMatchObject({ pointerType: 'mouse' });
  });

  it('a click that carries a pointer type reports it', async () => {
    const { el, promise } = setup();

    el.fire('click', { pointerType: 'touch' });

    await expect(promise).resolves.toMatchObject({ pointerType: 'touch' });
  });

  it.each(['Enter', 'Space'])('%s starts the game with pointerType keyboard', async (code) => {
    const { win, promise } = setup();

    win.fire('keydown', { code });

    await expect(promise).resolves.toMatchObject({ pointerType: 'keyboard' });
  });

  it('other keys do not start the game', async () => {
    const { win, promise } = setup();
    const settled = vi.fn();
    promise.then(settled);

    win.fire('keydown', { code: 'KeyA' });
    win.fire('keydown', { code: 'Escape' });
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
  });

  it('creates, resumes and plays a silent one-sample buffer synchronously inside the gesture', () => {
    const { el, log } = setup();

    el.fire('pointerup', { pointerType: 'touch' });

    // No await between the event and these checks: it must all happen in the handler.
    expect(log.created).toBe(1);
    expect(log.resumed).toBe(1);
    expect(log.buffer).toEqual({ channels: 1, length: 1, rate: 44100 });
    expect(log.connected).toBe(1);
    expect(log.started).toEqual([0]);
  });

  it('resolves with the AudioContext it created', async () => {
    const { el, promise } = setup();

    el.fire('click', {});
    const { audio } = await promise;

    expect(audio.state).toBe('running');
  });

  it('removes every listener once the gesture happened, so a second event does nothing', async () => {
    const { el, win, log, promise } = setup();

    el.fire('pointerup', { pointerType: 'touch' });
    await promise;
    el.fire('click', {});
    win.fire('keydown', { code: 'Enter' });

    expect(el.count('click') + el.count('pointerup') + win.count('keydown')).toBe(0);
    expect(log.created).toBe(1);
  });

  it('still starts with audio null when there is no AudioContext', async () => {
    const el = new FakeTarget();
    const win = new FakeTarget();
    const promise = waitForStartGesture(el, { AudioContextCtor: undefined, win });

    el.fire('click', {});

    await expect(promise).resolves.toEqual({ audio: null, pointerType: 'mouse' });
  });

  it('still starts with audio null when creating the AudioContext throws', async () => {
    const el = new FakeTarget();
    const win = new FakeTarget();
    const Broken = class {
      constructor() {
        throw new Error('audio blocked');
      }
    };
    const promise = waitForStartGesture(el, { AudioContextCtor: Broken, win });

    el.fire('click', {});

    await expect(promise).resolves.toEqual({ audio: null, pointerType: 'mouse' });
  });

  it('does not let a rejected resume() become an unhandled rejection', async () => {
    const el = new FakeTarget();
    const win = new FakeTarget();
    const Rejecting = class {
      constructor() {
        this.sampleRate = 8000;
        this.destination = {};
        this.state = 'suspended';
      }

      resume() {
        return Promise.reject(new Error('not allowed'));
      }

      createBuffer() {
        return {};
      }

      createBufferSource() {
        return { connect() {}, start() {} };
      }
    };
    const promise = waitForStartGesture(el, { AudioContextCtor: Rejecting, win });

    el.fire('click', {});

    await expect(promise).resolves.toMatchObject({ pointerType: 'mouse' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
