import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installErrorPanel } from '../../src/boot/error_panel.js';

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.attrs = {};
    this.listeners = {};
    this.id = '';
    this.hidden = false;
    this.ownText = '';
  }

  set innerHTML(_value) {
    throw new Error('innerHTML is forbidden (T-01-21)');
  }

  set outerHTML(_value) {
    throw new Error('outerHTML is forbidden (T-01-21)');
  }

  set textContent(value) {
    this.ownText = String(value);
    this.children = [];
  }

  get textContent() {
    return this.ownText + this.children.map((c) => c.textContent).join('');
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  click() {
    for (const handler of this.listeners.click ?? []) handler({ type: 'click' });
  }

  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }
}

function fakeEnvironment({ writeText = vi.fn(async () => {}) } = {}) {
  const winListeners = {};
  const reload = vi.fn();
  const win = {
    navigator: { clipboard: { writeText } },
    location: { reload },
    addEventListener(type, handler) {
      (winListeners[type] ??= []).push(handler);
    },
  };
  const body = new FakeElement('body');
  const doc = {
    body,
    defaultView: win,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => body.find((el) => el.id === id),
  };
  return {
    doc,
    body,
    writeText,
    reload,
    fire: (type, event) => winListeners[type].forEach((h) => h(event)),
  };
}

const button = (env, label) =>
  env.body.find((el) => el.tag === 'button' && el.textContent === label);
const panelEl = (env) => env.doc.getElementById('error-panel');
const noticeEl = (env) => env.doc.getElementById('error-notice');

describe('error panel contents', () => {
  it('is not shown until something fails', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);

    expect(panel.shown).toBe(false);
    expect(panelEl(env)).toBeNull();
  });

  it('shows the message, its context and an alert role', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);

    panel.show(new Error('boom'), 'frame');

    expect(panel.shown).toBe(true);
    expect(panelEl(env).attrs.role).toBe('alert');
    expect(panelEl(env).textContent).toContain('[frame] boom');
  });

  it('has Copy report and Reload buttons', () => {
    const env = fakeEnvironment();
    installErrorPanel(env.doc).show(new Error('x'), 'frame');

    expect(button(env, 'Copy report')).not.toBeNull();
    expect(button(env, 'Reload')).not.toBeNull();
  });

  it('inserts markup-like error text as plain text only (T-01-21)', () => {
    const env = fakeEnvironment();
    const hostile = '<img src=x onerror=alert(1)><script>steal()</script>';

    installErrorPanel(env.doc).show(new Error(hostile), 'load');

    expect(panelEl(env).textContent).toContain(hostile);
    expect(panelEl(env).find((el) => el.tag === 'img' || el.tag === 'script')).toBeNull();
  });

  it('shows the whole Python traceback carried by a PythonError message', () => {
    const env = fakeEnvironment();
    const error = new Error(
      'Traceback (most recent call last):\n  File "/lib/scorched_core/game/game.py", line 1\nRuntimeError: Injected Python fault (?crash=py) at tick 120',
    );
    error.name = 'PythonError';

    installErrorPanel(env.doc).show(error, 'frame');

    const text = panelEl(env).textContent;
    expect(text).toContain('Traceback (most recent call last):');
    expect(text).toContain('Injected Python fault (?crash=py) at tick 120');
  });

  it('shows the stack below the message when the stack does not repeat it', () => {
    const env = fakeEnvironment();
    const error = new Error('plain failure');
    error.stack = 'frameOne@file.js:1\nframeTwo@file.js:2';

    installErrorPanel(env.doc).show(error, 'frame');

    const text = panelEl(env).textContent;
    expect(text.indexOf('plain failure')).toBeLessThan(text.indexOf('frameOne@file.js:1'));
  });

  it('does not print the message twice when the stack already starts with it', () => {
    const env = fakeEnvironment();
    const error = new Error('only once');
    error.stack = 'Error: only once\n    at somewhere (file.js:1:1)';

    installErrorPanel(env.doc).show(error, 'frame');

    expect(panelEl(env).textContent.split('only once')).toHaveLength(2);
  });

  it('describes a non-Error value with String()', () => {
    const env = fakeEnvironment();

    installErrorPanel(env.doc).show('just a string', 'promise');

    expect(panelEl(env).textContent).toContain('[promise] just a string');
  });

  it('appends a second error instead of replacing the first and fires onFatal once', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    const fatal = vi.fn();
    panel.onFatal(fatal);

    panel.show(new Error('first'), 'frame');
    panel.show(new Error('second'), 'promise');

    const text = panelEl(env).textContent;
    expect(text).toContain('first');
    expect(text).toContain('second');
    expect(fatal).toHaveBeenCalledTimes(1);
  });

  it('shows window error events and unhandled rejections', () => {
    const env = fakeEnvironment();
    installErrorPanel(env.doc);

    env.fire('error', { error: new Error('thrown'), message: 'ignored' });
    expect(panelEl(env).textContent).toContain('[window] thrown');
    env.fire('unhandledrejection', { reason: new Error('rejected') });
    expect(panelEl(env).textContent).toContain('[promise] rejected');
  });

  it('falls back to the event message when a window error carries no Error', () => {
    const env = fakeEnvironment();
    installErrorPanel(env.doc);

    env.fire('error', { error: null, message: 'ResizeObserver exploded' });

    expect(panelEl(env).textContent).toContain('[window] ResizeObserver exploded');
  });

  describe('errors that are not the game\'s own', () => {
    beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => vi.restoreAllMocks());

    it('ignores the opaque cross-origin "Script error." and does not fire onFatal', () => {
      const env = fakeEnvironment();
      const panel = installErrorPanel(env.doc);
      const fatal = vi.fn();
      panel.onFatal(fatal);

      env.fire('error', { error: null, message: 'Script error.' });

      expect(panel.shown).toBe(false);
      expect(fatal).not.toHaveBeenCalled();
    });

    it.each(['chrome-extension', 'moz-extension', 'safari-web-extension'])(
      'ignores an error raised from a %s script',
      (scheme) => {
        const env = fakeEnvironment();
        const panel = installErrorPanel(env.doc);

        env.fire('error', {
          error: new Error('injected'),
          message: 'injected',
          filename: `${scheme}://abc123/content.js`,
        });

        expect(panel.shown).toBe(false);
      },
    );

    it('ignores a rejection whose stack comes from an extension', () => {
      const env = fakeEnvironment();
      const panel = installErrorPanel(env.doc);
      const reason = new Error('extension rejection');
      reason.stack = 'Error: extension rejection\n    at chrome-extension://abc/inject.js:1:1';

      env.fire('unhandledrejection', { reason });

      expect(panel.shown).toBe(false);
    });

    it('still escalates a same-origin error and a rejection with a plain reason', () => {
      const env = fakeEnvironment();
      const panel = installErrorPanel(env.doc);

      env.fire('error', {
        error: new Error('ours'),
        message: 'ours',
        filename: 'https://example.test/assets/index.js',
      });
      env.fire('unhandledrejection', { reason: null });

      expect(panel.shown).toBe(true);
      expect(panelEl(env).textContent).toContain('[window] ours');
    });
  });
});

describe('error panel buttons', () => {
  it('Copy report writes the panel text plus the registered report to the clipboard', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    panel.setReportProvider(() => 'Scorched device report\nua: TestAgent');
    panel.show(new Error('copy me'), 'frame');

    button(env, 'Copy report').click();

    expect(env.writeText).toHaveBeenCalledTimes(1); // synchronously, inside the click
    const written = env.writeText.mock.calls[0][0];
    expect(written).toContain('[frame] copy me');
    expect(written).toContain('Scorched device report');
    expect(written).toContain('ua: TestAgent');
  });

  it('Copy report still copies the error when no provider is registered', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    panel.show(new Error('alone'), 'frame');

    button(env, 'Copy report').click();

    expect(env.writeText.mock.calls[0][0]).toContain('[frame] alone');
  });

  it('Copy report reads the provider at click time, so it reflects later state', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    let build = 'one';
    panel.setReportProvider(() => `build: ${build}`);
    panel.show(new Error('x'), 'frame');
    build = 'two';

    button(env, 'Copy report').click();

    expect(env.writeText.mock.calls[0][0]).toContain('build: two');
  });

  it('swallows a failing report provider and still copies the error text', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    panel.setReportProvider(() => {
      throw new Error('provider broke');
    });
    panel.show(new Error('real failure'), 'frame');

    expect(() => button(env, 'Copy report').click()).not.toThrow();
    expect(env.writeText.mock.calls[0][0]).toContain('real failure');
  });

  it('Reload reloads the page', () => {
    const env = fakeEnvironment();
    installErrorPanel(env.doc).show(new Error('x'), 'load');

    button(env, 'Reload').click();

    expect(env.reload).toHaveBeenCalledTimes(1);
  });
});

describe('non-fatal notice', () => {
  it('shows a banner with the text and does not open the crash panel', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);
    const fatal = vi.fn();
    panel.onFatal(fatal);

    panel.showNotice('Graphics context lost');

    expect(noticeEl(env).textContent).toBe('Graphics context lost');
    expect(noticeEl(env).hidden).toBe(false);
    expect(noticeEl(env).attrs.role).toBe('status');
    expect(panel.shown).toBe(false);
    expect(fatal).not.toHaveBeenCalled();
  });

  it('hideNotice hides it and showNotice brings it back with new text', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);

    panel.showNotice('first');
    panel.hideNotice();
    expect(noticeEl(env).hidden).toBe(true);
    panel.showNotice('second');

    expect(noticeEl(env).hidden).toBe(false);
    expect(noticeEl(env).textContent).toBe('second');
    expect(env.body.children.filter((el) => el.id === 'error-notice')).toHaveLength(1);
  });

  it('hideNotice before any notice is a no-op', () => {
    const env = fakeEnvironment();
    const panel = installErrorPanel(env.doc);

    expect(() => panel.hideNotice()).not.toThrow();
    expect(noticeEl(env)).toBeNull();
  });
});
