// requestAnimationFrame loop. Uses the rAF timestamp argument, never a clock read.

export function createFrameLoop({
  onFrame,
  onError,
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
}) {
  let running = false;
  let handle = null;
  let lastTs = null;

  function frame(ts) {
    if (!running) return;
    const dt = lastTs === null ? 0 : ts - lastTs;
    lastTs = ts;
    try {
      onFrame(dt, ts);
    } catch (error) {
      stop();
      onError(error);
      return;
    }
    if (running) handle = raf(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = null;
    handle = raf(frame);
  }

  function stop() {
    running = false;
    if (handle !== null) caf(handle);
    handle = null;
  }

  return {
    start,
    stop,
    resetClock() {
      lastTs = null;
    },
    isRunning() {
      return running;
    },
  };
}
