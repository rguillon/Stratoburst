// Full-screen error panel. No three or pyodide imports: it must work when they fail.
// All text is inserted with textContent only (T-01-02, T-01-21): an error message can echo
// markup-like data, so no HTML-string API is ever used here.

import { copyReport } from '../debug/report.js';

const BUTTON_STYLE =
  'padding:12px 20px;margin-right:12px;font:600 15px system-ui,sans-serif;color:#0b0a1a;' +
  'background:#1bd7ff;border:0;border-radius:4px;cursor:pointer;';

// Errors that are not ours: browser extensions inject scripts into the page, and a cross-origin
// script failure reaches window.onerror as an opaque "Script error." with no error object.
// Neither says anything about the health of the game, so neither may end the session.
const EXTENSION_URL = /(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//;

function isForeignError(event) {
  if (event.error == null && event.message === 'Script error.') return true;
  return EXTENSION_URL.test(String(event.filename ?? ''));
}

function isForeignRejection(event) {
  return EXTENSION_URL.test(String(event.reason?.stack ?? ''));
}

export function installErrorPanel(doc = document) {
  const win = doc.defaultView ?? globalThis;
  const fatalCallbacks = [];
  let panel = null;
  let pre = null;
  let notice = null;
  let reportProvider = null;

  // A V8 stack starts with "Name: message", so it already carries the message (for a
  // PythonError, the full Python traceback): keep the message once, then the frames below it.
  // Other engines' stacks do not repeat the message, so it is shown first and the stack follows.
  function describe(error, context) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : '';
    const at = stack.indexOf(message);
    const frames = at === -1 ? `\n${stack}` : stack.slice(at + message.length);
    return `[${context}] ${message}${stack ? frames : ''}`;
  }

  function makeButton(label, onClick) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = BUTTON_STYLE;
    button.addEventListener('click', onClick);
    return button;
  }

  // Runs synchronously inside the click so the clipboard write counts as a user gesture (iOS).
  function copy() {
    let text = pre.textContent;
    try {
      const report = reportProvider?.();
      if (report) text += `\n\n${report}`;
    } catch {
      // A broken report provider must not stop the error text itself from being copied.
    }
    Promise.resolve(copyReport(text, doc)).catch(() => {});
  }

  function build() {
    panel = doc.createElement('div');
    panel.id = 'error-panel';
    panel.setAttribute('role', 'alert');
    panel.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:auto;box-sizing:border-box;' +
      'padding:16px;background:#0b0a1a;color:#e6ebff;font:13px/1.4 monospace;';
    const heading = doc.createElement('h1');
    heading.textContent = 'Scorched crashed';
    heading.style.cssText = 'margin:0 0 12px;font-size:18px;color:#ff4d6d;';
    const buttons = doc.createElement('div');
    buttons.style.cssText = 'margin:0 0 12px;';
    buttons.append(
      makeButton('Copy report', copy),
      makeButton('Reload', () => win.location.reload()),
    );
    pre = doc.createElement('pre');
    pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;';
    panel.append(heading, buttons, pre);
    doc.body.append(panel);
  }

  function show(error, context = 'error') {
    const text = describe(error, context);
    if (panel === null) {
      build();
      pre.textContent = text;
      for (const cb of fatalCallbacks) cb();
    } else {
      pre.textContent += `\n\n${text}`;
    }
  }

  function showNotice(text) {
    if (notice === null) {
      notice = doc.createElement('div');
      notice.id = 'error-notice';
      notice.setAttribute('role', 'status');
      notice.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:2147483646;box-sizing:border-box;' +
        'padding:10px 16px;background:#3a1030;color:#e6ebff;font:14px system-ui,sans-serif;' +
        'text-align:center;';
      doc.body.append(notice);
    }
    notice.textContent = text;
    notice.hidden = false;
  }

  function hideNotice() {
    if (notice !== null) notice.hidden = true;
  }

  win.addEventListener('error', (event) => {
    if (isForeignError(event)) {
      console.warn('[scorched] ignored a non-game page error:', event.message);
      return;
    }
    show(event.error ?? event.message, 'window');
  });
  win.addEventListener('unhandledrejection', (event) => {
    if (isForeignRejection(event)) {
      console.warn('[scorched] ignored a non-game promise rejection:', event.reason);
      return;
    }
    show(event.reason, 'promise');
  });

  return {
    show,
    onFatal(cb) {
      fatalCallbacks.push(cb);
    },
    // The text Copy report appends after the error: main.js registers the device report.
    setReportProvider(fn) {
      reportProvider = fn;
    },
    showNotice,
    hideNotice,
    get shown() {
      return panel !== null;
    },
  };
}
