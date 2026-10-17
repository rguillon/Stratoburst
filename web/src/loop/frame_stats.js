// Frame statistics for the on-device overlay and report. Fixed-size Float64Array rings, so
// pushing a sample allocates nothing. Percentiles are nearest-rank on a sorted copy.

const OVER_MS = 25;

// Nearest rank: the value at 1-based rank ceil(pct / 100 * n). Integer arithmetic keeps
// rank boundaries exact (0.95 * 120 is not representable).
function nearestRank(sorted, pct) {
  const n = sorted.length;
  return sorted[Math.max(0, Math.ceil((pct * n) / 100) - 1)];
}

function sumOf(values) {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  return total;
}

function createSeries(capacity) {
  const data = new Float64Array(capacity);
  const scratch = new Float64Array(capacity);
  return {
    data,
    set(index, value) {
      data[index] = value;
    },
    // Stats over the first `count` slots (the ring is filled from 0, so these are exactly the
    // retained samples; order does not matter to any statistic).
    stats(count) {
      if (count === 0) return { avg: 0, p50: 0, p95: 0, max: 0 };
      const sorted = scratch.subarray(0, count);
      sorted.set(data.subarray(0, count));
      sorted.sort();
      return {
        avg: sumOf(sorted) / count,
        p50: nearestRank(sorted, 50),
        p95: nearestRank(sorted, 95),
        max: sorted[count - 1],
      };
    },
  };
}

export function createFrameStats(capacity = 120) {
  const frame = createSeries(capacity);
  const tick = createSeries(capacity);
  const render = createSeries(capacity);
  const steps = createSeries(capacity);
  let head = 0;
  let count = 0;
  let totalOver25 = 0;

  return {
    push({ frameMs, tickMs = 0, renderMs = 0, steps: stepCount = 0 }) {
      frame.set(head, frameMs);
      tick.set(head, tickMs);
      render.set(head, renderMs);
      steps.set(head, stepCount);
      head = (head + 1) % capacity;
      count = Math.min(count + 1, capacity);
      if (frameMs > OVER_MS) totalOver25 += 1;
    },
    summary() {
      const frameStats = frame.stats(count);
      let over25 = 0;
      for (let i = 0; i < count; i += 1) if (frame.data[i] > OVER_MS) over25 += 1;
      const tickStats = tick.stats(count);
      const renderStats = render.stats(count);
      return {
        fps: frameStats.avg > 0 ? 1000 / frameStats.avg : 0,
        count,
        frame: frameStats,
        tick: { avg: tickStats.avg, p95: tickStats.p95 },
        render: { avg: renderStats.avg, p95: renderStats.p95 },
        steps: { avg: count === 0 ? 0 : sumOf(steps.data.subarray(0, count)) / count },
        over25,
        totalOver25,
      };
    },
  };
}

const MINUTE_MS = 60_000;

function sortedCopy(values) {
  return Float64Array.from(values).sort();
}

// Per-minute aggregates for the soak: thermal throttling shows as a falling avgFps and a
// rising p95FrameMs over the minutes. Storage grows by two numbers per frame (about 60 KB per
// minute at 60 fps), debug mode only.
export function createMinuteAggregator(startMs) {
  const buckets = new Map();
  return {
    add({ frameMs, tickMs = 0 }, nowMs) {
      const minute = Math.floor((nowMs - startMs) / MINUTE_MS);
      if (minute < 0) return;
      let bucket = buckets.get(minute);
      if (!bucket) {
        bucket = { frames: [], ticks: [] };
        buckets.set(minute, bucket);
      }
      bucket.frames.push(frameMs);
      bucket.ticks.push(tickMs);
    },
    minutes() {
      return [...buckets.keys()]
        .sort((a, b) => a - b)
        .map((minute) => {
          const { frames, ticks } = buckets.get(minute);
          const frameSorted = sortedCopy(frames);
          const tickSorted = sortedCopy(ticks);
          const avgFrame = sumOf(frames) / frames.length;
          return {
            minute,
            frames: frames.length,
            avgFps: avgFrame > 0 ? 1000 / avgFrame : 0,
            p95FrameMs: nearestRank(frameSorted, 95),
            avgTickMs: sumOf(ticks) / ticks.length,
            p95TickMs: nearestRank(tickSorted, 95),
          };
        });
    },
  };
}
