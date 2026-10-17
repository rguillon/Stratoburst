import { describe, expect, it } from 'vitest';
import { createFrameStats, createMinuteAggregator } from '../../src/loop/frame_stats.js';

function allFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return Object.values(value).every(allFinite);
}

describe('createFrameStats', () => {
  it('summarises frame times with nearest-rank percentiles', () => {
    const stats = createFrameStats(120);
    for (let i = 0; i < 118; i += 1) stats.push({ frameMs: 16.7 });
    stats.push({ frameMs: 40 });
    stats.push({ frameMs: 50 });
    const { frame, over25, fps, count } = stats.summary();
    expect(count).toBe(120);
    expect(frame.max).toBe(50);
    expect(frame.p50).toBe(16.7);
    expect(frame.p95).toBe(16.7); // rank ceil(0.95 * 120) = 114 of 120
    expect(frame.avg).toBeCloseTo((16.7 * 118 + 90) / 120, 9);
    expect(fps).toBeCloseTo(1000 / frame.avg, 9);
    expect(over25).toBe(2);
  });

  it('uses the nearest-rank definition on a small set', () => {
    const stats = createFrameStats(120);
    for (let i = 1; i <= 10; i += 1) stats.push({ frameMs: i });
    const { frame } = stats.summary();
    expect(frame.p50).toBe(5); // rank ceil(0.5 * 10)
    expect(frame.p95).toBe(10); // rank ceil(0.95 * 10)
  });

  it('returns zeros and no NaN on an empty buffer', () => {
    const summary = createFrameStats(120).summary();
    expect(allFinite(summary)).toBe(true);
    expect(summary.fps).toBe(0);
    expect(summary.frame).toEqual({ avg: 0, p50: 0, p95: 0, max: 0 });
    expect(summary.over25).toBe(0);
  });

  it('keeps only the last 120 samples', () => {
    const stats = createFrameStats(120);
    for (let i = 1; i <= 130; i += 1) stats.push({ frameMs: i });
    const { frame, count } = stats.summary();
    expect(count).toBe(120);
    expect(frame.max).toBe(130);
    expect(frame.avg).toBe((11 + 130) / 2); // mean of 11..130
  });

  it('summarises tick, render and steps alongside frame time', () => {
    const stats = createFrameStats(120);
    for (let i = 1; i <= 10; i += 1) {
      stats.push({ frameMs: 16, tickMs: i, renderMs: 2 * i, steps: i % 2 });
    }
    const { tick, render, steps } = stats.summary();
    expect(tick).toEqual({ avg: 5.5, p95: 10 });
    expect(render).toEqual({ avg: 11, p95: 20 });
    expect(steps.avg).toBe(0.5);
  });

  it('counts frames over 25 ms in the window and over the whole run', () => {
    const stats = createFrameStats(4);
    for (const frameMs of [30, 30, 30, 10, 10, 10, 10, 26]) stats.push({ frameMs });
    const { over25, totalOver25 } = stats.summary();
    expect(over25).toBe(1); // only the 26 is still inside the 4-frame window
    expect(totalOver25).toBe(4);
  });

  it('does not count exactly 25 ms as over', () => {
    const stats = createFrameStats(120);
    stats.push({ frameMs: 25 });
    expect(stats.summary().over25).toBe(0);
  });
});

describe('createMinuteAggregator', () => {
  it('buckets samples by floor((now - start) / 60000)', () => {
    const agg = createMinuteAggregator(1000);
    agg.add({ frameMs: 16, tickMs: 1 }, 1000);
    agg.add({ frameMs: 16, tickMs: 1 }, 60_999); // last ms of minute 0
    agg.add({ frameMs: 20, tickMs: 2 }, 61_000); // first ms of minute 1
    const minutes = agg.minutes();
    expect(minutes.map((m) => [m.minute, m.frames])).toEqual([
      [0, 2],
      [1, 1],
    ]);
  });

  it('reports avgFps, p95FrameMs, avgTickMs and p95TickMs per minute', () => {
    const agg = createMinuteAggregator(0);
    for (let i = 1; i <= 10; i += 1) agg.add({ frameMs: 10 * i, tickMs: i }, i * 100);
    const [minute] = agg.minutes();
    expect(minute.avgFps).toBeCloseTo(1000 / 55, 9);
    expect(minute.p95FrameMs).toBe(100);
    expect(minute.avgTickMs).toBe(5.5);
    expect(minute.p95TickMs).toBe(10);
  });

  it('skips empty minutes and ignores samples before the start', () => {
    const agg = createMinuteAggregator(5000);
    agg.add({ frameMs: 16, tickMs: 1 }, 4999);
    agg.add({ frameMs: 16, tickMs: 1 }, 5000 + 3 * 60_000);
    expect(agg.minutes().map((m) => m.minute)).toEqual([3]);
  });

  it('returns no minutes before any sample', () => {
    expect(createMinuteAggregator(0).minutes()).toEqual([]);
  });
});
