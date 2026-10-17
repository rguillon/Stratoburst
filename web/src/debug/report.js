// The device report: the go/no-go measurement artifact. It is assembled only on an explicit
// Copy click and leaves the device only through the clipboard or a local textarea. Nothing here
// touches the network or storage.

const NA = 'n/a';

const text = (value) => (value === undefined || value === null || value === '' ? NA : String(value));
const num = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : NA);
const size = (box) => (box ? `${text(box.width)}x${text(box.height)}` : NA);

function flagsLine(flags) {
  if (!flags) return NA;
  const debug = flags.debug ? 'on' : 'off';
  return `debug=${debug} stress=${text(flags.stress)} tier=${flags.tier ?? 'auto'} crash=${flags.crash ?? 'none'}`;
}

function tierLines(info) {
  const log = info.tierLog ?? [];
  if (log.length === 0) return ['tier log: none'];
  return [
    'tier log:',
    ...log.map(
      (e) => `  ${num(e.atMs / 1000, 1)}s ${text(e.from)} -> ${text(e.to)} (${text(e.reason)})`,
    ),
  ];
}

function minuteLine(m) {
  return (
    `minute ${m.minute}: frames ${m.frames}, avg fps ${num(m.avgFps, 1)}, ` +
    `p95 frame ${num(m.p95FrameMs, 1)} ms, avg tick ${num(m.avgTickMs, 2)} ms, ` +
    `p95 tick ${num(m.p95TickMs, 2)} ms`
  );
}

export function buildReport(info) {
  const minutes = info.minutes ?? [];
  const tier = info.lockReason ? `${text(info.tier)} (locked: ${info.lockReason})` : text(info.tier);
  return [
    'Scorched device report',
    `ua: ${text(info.ua)}`,
    `screen: ${size(info.screen)} (css ${size(info.css)})`,
    `dpr: ${text(info.dpr)} (effective ${num(info.effectiveDpr, 2)})`,
    `canvas: ${size(info.canvas)}`,
    `gl renderer: ${text(info.glRenderer)}`,
    `precision: ${text(info.precision)}`,
    `pyodide: ${text(info.pyodide)}`,
    `three: ${text(info.three)}`,
    `build: ${text(info.build)}`,
    `flags: ${flagsLine(info.flags)}`,
    `tier: ${tier}`,
    `time to gate: ${Number.isFinite(info.timeToGateMs) ? `${num(info.timeToGateMs / 1000, 1)} s` : NA}`,
    `elapsed: ${num(info.elapsedMin, 1)} min`,
    ...tierLines(info),
    ...(minutes.length === 0 ? ['minutes: none'] : minutes.map(minuteLine)),
  ].join('\n');
}

// Renderer string (Safari may mask it) and fragment-shader highp precision, read once at boot.
export function readGlInfo(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null) || gl.getParameter(gl.RENDERER) || 'masked';
  const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precision = format && format.precision > 0 ? `highp (${format.precision} bits)` : 'highp unsupported';
  return { renderer, precision };
}

function showReportText(reportText, doc) {
  doc.getElementById('report-panel')?.remove();
  const panel = doc.createElement('div');
  panel.id = 'report-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2000',
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
  });
  const area = doc.createElement('textarea');
  area.id = 'report-text';
  area.readOnly = true;
  area.value = reportText;
  Object.assign(area.style, { flex: '1', font: '12px ui-monospace, monospace' });
  const close = doc.createElement('button');
  close.id = 'report-close';
  close.textContent = 'Close';
  Object.assign(close.style, { padding: '12px', font: '16px system-ui, sans-serif' });
  close.addEventListener('click', () => panel.remove());
  panel.append(area, close);
  doc.body.append(panel);
  area.focus();
  area.select();
}

// Must be called synchronously inside the click handler (iOS only allows clipboard writes from a
// gesture), so the clipboard call happens before the first await.
export async function copyReport(reportText, doc = document, nav = doc.defaultView?.navigator) {
  try {
    if (!nav?.clipboard?.writeText) throw new Error('clipboard unavailable');
    await nav.clipboard.writeText(reportText);
    return 'clipboard';
  } catch {
    showReportText(reportText, doc);
    return 'textarea';
  }
}
