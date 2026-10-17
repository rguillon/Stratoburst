// Full-screen error panel. No three or pyodide imports: it must work when they fail.
// All text is inserted with textContent only (T-01-02).

export function installErrorPanel(doc = document) {
  const win = doc.defaultView ?? globalThis;
  const fatalCallbacks = [];
  let panel = null;
  let pre = null;

  function describe(error, context) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
    return `[${context}] ${message}${stack}`;
  }

  function build() {
    panel = doc.createElement('div');
    panel.id = 'error-panel';
    panel.setAttribute('role', 'alert');
    panel.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:auto;box-sizing:border-box;' +
      'padding:16px;background:#1a0b08;color:#ffd9c7;font:13px/1.4 monospace;';
    const heading = doc.createElement('h1');
    heading.textContent = 'Scorched crashed';
    heading.style.cssText = 'margin:0 0 12px;font-size:18px;color:#ff7b4a;';
    pre = doc.createElement('pre');
    pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;';
    panel.append(heading, pre);
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

  win.addEventListener('error', (event) => show(event.error ?? event.message, 'window'));
  win.addEventListener('unhandledrejection', (event) => show(event.reason, 'promise'));

  return {
    show,
    onFatal(cb) {
      fatalCallbacks.push(cb);
    },
    // RED skeletons: implemented in the GREEN commit.
    setReportProvider() {},
    showNotice() {},
    hideNotice() {},
    get shown() {
      return panel !== null;
    },
  };
}
