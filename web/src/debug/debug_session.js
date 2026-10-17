// Everything that exists only under ?debug: timing capture, the overlay text, the device report
// snapshot and the hooks the e2e specs read. main.js creates this only when the flag is set.

import { createFrameStats, createMinuteAggregator } from '../loop/frame_stats.js';
import { createDebugOverlay } from './overlay.js';
import { buildReport, copyReport, readGlInfo } from './report.js';

const MB = 1024 * 1024;

const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : 'n/a');
const megabytes = (bytes) => (Number.isFinite(bytes) ? `${(bytes / MB).toFixed(1)} MB` : 'n/a');

export function createDebugSession({
  rig,
  pyodide,
  header,
  slots,
  flags,
  tierLog,
  getTier,
  getLockReason,
  versions,
  startMs,
}) {
  const stats = createFrameStats(120);
  const minutes = createMinuteAggregator(startMs);
  const overlay = createDebugOverlay();
  const gl = readGlInfo(rig.renderer.getContext());
  let drawCalls = 0;
  let triangles = 0;

  // Passes of one composer frame each reset renderer.info; accumulate across them instead and
  // reset once per frame so the overlay shows whole-frame draw calls and triangles.
  const info = rig.renderer.info;
  info.autoReset = false;

  function overlayText(nowMs) {
    const s = stats.summary();
    const lock = getLockReason();
    const tier = lock ? `${getTier()} (locked: ${lock})` : getTier();
    const heap = performance.memory?.usedJSHeapSize;
    const read = (name) => (name in slots ? header[slots[name]] : 'n/a');
    return [
      `fps ${fixed(s.fps, 1)}   frame ms avg ${fixed(s.frame.avg, 1)} p50 ${fixed(s.frame.p50, 1)} p95 ${fixed(s.frame.p95, 1)} max ${fixed(s.frame.max, 1)}`,
      `tick ms avg ${fixed(s.tick.avg, 2)} p95 ${fixed(s.tick.p95, 2)} (incl. assign)`,
      `render-submit ms avg ${fixed(s.render.avg, 2)} p95 ${fixed(s.render.p95, 2)}`,
      `steps/frame ${fixed(s.steps.avg, 2)}   bullets ${read('EBULLET_N')} (player ${read('PBULLET_N')})   drones ${read('DRONE_N')}`,
      `tier ${tier}   dpr ${fixed(rig.dpr, 2)}   canvas ${rig.pixels.width}x${rig.pixels.height}`,
      `draw calls ${drawCalls}   triangles ${triangles}`,
      `wasm heap ${megabytes(pyodide._module?.HEAPU8?.length)}   js heap ${megabytes(heap)}`,
      `elapsed ${fixed((nowMs - startMs) / 60_000, 1)} min   >25 ms: ${s.over25} (total ${s.totalOver25})`,
      `build ${versions.build}`,
    ].join('\n');
  }

  function snapshot(nowMs) {
    return {
      ua: globalThis.navigator?.userAgent,
      screen: { width: globalThis.screen?.width, height: globalThis.screen?.height },
      css: { width: globalThis.innerWidth, height: globalThis.innerHeight },
      dpr: globalThis.devicePixelRatio,
      effectiveDpr: rig.dpr,
      canvas: rig.pixels,
      glRenderer: gl.renderer,
      precision: gl.precision,
      pyodide: versions.pyodide,
      three: versions.three,
      build: versions.build,
      flags,
      tier: getTier(),
      lockReason: getLockReason(),
      elapsedMin: (nowMs - startMs) / 60_000,
      tierLog,
      minutes: minutes.minutes(),
    };
  }

  overlay.onCopy(() => copyReport(buildReport(snapshot(performance.now()))));

  return {
    // Called once per frame, after the render submit. dt is the rAF frame delta.
    record({ frameMs, tickMs, renderMs, nowMs }) {
      drawCalls = info.render.calls;
      triangles = info.render.triangles;
      info.reset();
      if (!(frameMs > 0)) return; // first frame after start or resume has no delta
      stats.push({ frameMs, tickMs, renderMs, steps: header[slots.STEPS] });
      minutes.add({ frameMs, tickMs }, nowMs);
      if (overlay.due()) overlay.update(overlayText(nowMs));
    },
    hooks: {
      build: versions.build,
      stats: () => stats.summary(),
    },
  };
}
