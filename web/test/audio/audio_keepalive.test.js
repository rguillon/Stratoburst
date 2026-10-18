import { describe, expect, it } from 'vitest';
import { installAudioKeepalive } from '../../src/audio/audio_keepalive.js';

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

// An AudioContext whose resume() outcome the test controls.
function fakeAudio(state = 'running', { hang = false, reject = false } = {}) {
  const audio = new FakeTarget();
  audio.state = state;
  audio.resumed = 0;
  audio.resume = () => {
    audio.resumed += 1;
    if (hang) return new Promise(() => {});
    if (reject) return Promise.reject(new Error('blocked'));
    audio.state = 'running';
    return Promise.resolve();
  };
  return audio;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(audioOptions = {}, { state = 'suspended', nav = {} } = {}) {
  const audio = fakeAudio(state, audioOptions);
  const win = new FakeTarget();
  const dispose = installAudioKeepalive({ audio, win, nav });
  return { audio, win, dispose, nav };
}

describe('installAudioKeepalive', () => {
  describe('audioSession', () => {
    it("sets the session type to 'playback' so the ringer switch does not mute Web Audio", () => {
      const nav = { audioSession: { type: 'auto' } };

      installAudioKeepalive({ audio: fakeAudio(), win: new FakeTarget(), nav });

      expect(nav.audioSession.type).toBe('playback');
    });

    it('survives a session whose type setter throws', () => {
      const audioSession = {};
      Object.defineProperty(audioSession, 'type', {
        set() {
          throw new Error('not allowed');
        },
      });

      expect(() =>
        installAudioKeepalive({ audio: fakeAudio(), win: new FakeTarget(), nav: { audioSession } }),
      ).not.toThrow();
    });

    it('changes nothing where navigator.audioSession does not exist', () => {
      const nav = {};

      installAudioKeepalive({ audio: fakeAudio(), win: new FakeTarget(), nav });

      expect(nav).toEqual({});
    });

    it('works with no navigator at all', () => {
      expect(() =>
        installAudioKeepalive({ audio: fakeAudio(), win: new FakeTarget(), nav: undefined }),
      ).not.toThrow();
    });
  });

  describe('resume on later gestures', () => {
    it.each(['pointerup', 'keydown'])('a %s resumes a suspended context', async (type) => {
      const { audio, win } = setup();

      win.fire(type);
      await flush();

      expect(audio.resumed).toBe(1);
      expect(audio.state).toBe('running');
    });

    it('resumes an interrupted context too', () => {
      const { audio, win } = setup({}, { state: 'interrupted' });

      win.fire('pointerup');

      expect(audio.resumed).toBe(1);
    });

    it('does nothing while the context is running', () => {
      const { audio, win } = setup({}, { state: 'running' });

      win.fire('pointerup');
      win.fire('keydown');

      expect(audio.resumed).toBe(0);
    });

    it('calls resume once per gesture, not on every key repeat while it is pending', () => {
      const { audio, win } = setup({ hang: true });

      win.fire('keydown');
      win.fire('keydown');
      win.fire('keydown');

      expect(audio.resumed).toBe(1);
    });

    it('a statechange lets a context that interrupted again recover on the next gesture', () => {
      const { audio, win } = setup({ hang: true });
      win.fire('pointerup');
      audio.state = 'interrupted';

      audio.fire('statechange');
      win.fire('pointerup');

      expect(audio.resumed).toBe(2);
    });

    it('can resume again after a resume that was rejected', async () => {
      const { audio, win } = setup({ reject: true });
      win.fire('pointerup');
      await flush();

      win.fire('pointerup');

      expect(audio.resumed).toBe(2);
    });

    it('survives a resume that throws synchronously', () => {
      const { audio, win } = setup();
      audio.resume = () => {
        throw new Error('closed');
      };

      expect(() => win.fire('pointerup')).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('removes every listener, including the statechange one', () => {
      const { audio, win, dispose } = setup();
      expect(win.count('pointerup')).toBe(1);
      expect(win.count('keydown')).toBe(1);
      expect(audio.count('statechange')).toBe(1);

      dispose();

      expect(win.count('pointerup')).toBe(0);
      expect(win.count('keydown')).toBe(0);
      expect(audio.count('statechange')).toBe(0);
    });
  });

  describe('with no AudioContext', () => {
    it('is a no-op that installs nothing', () => {
      const win = new FakeTarget();
      const nav = { audioSession: { type: 'auto' } };

      const dispose = installAudioKeepalive({ audio: null, win, nav });

      expect(win.count('pointerup')).toBe(0);
      expect(win.count('keydown')).toBe(0);
      expect(nav.audioSession.type).toBe('auto');
      expect(() => dispose()).not.toThrow();
    });
  });
});
