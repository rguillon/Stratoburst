import { describe, expect, it } from 'vitest';
import {
  EVAL_EVERY,
  MIN_GAIN,
  MIN_INTERVAL_MS,
  STRIKES,
  STRIKE_MS,
  WARMUP_MS,
  WINDOW,
  createQualityController,
  median,
} from '../../src/quality/quality_controller.js';

const SLOW = 21.6;
const FAST = 16.7;
const LOCK_REASON = 'refresh-capped-or-cpu-bound';

// Feeds `count` identical frames at one explicit clock reading; returns every result.
function feed(controller, count, dt, nowMs) {
  const results = [];
  for (let i = 0; i < count; i += 1) results.push(controller.update(dt, nowMs));
  return results;
}

function firstChange(results) {
  return results.findIndex((r) => r.changed);
}

// Drives a controller from high to mid at nowMs 2000 with a 40 ms median, leaving it in the
// second warm-up (until 4000) with a remembered pre-change median of 40.
function steppedDown(initialTier = 'high') {
  const controller = createQualityController({ initialTier, nowMs: 0 });
  const results = feed(controller, 150, 40, WARMUP_MS);
  expect(results[149].changed).toBe(true);
  return controller;
}

describe('constants', () => {
  it('match the research heuristic', () => {
    expect([WARMUP_MS, WINDOW, EVAL_EVERY, STRIKE_MS, STRIKES, MIN_GAIN, MIN_INTERVAL_MS]).toEqual([
      2000, 90, 30, 21.5, 3, 0.1, 3000,
    ]);
  });
});

describe('median', () => {
  it('uses the mean of the two middle values for an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('takes the middle value for an odd count', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('sorts a copy and leaves the input untouched', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('step-down', () => {
  it('steps high to mid on the third consecutive window with median 21.6 ms', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    const results = feed(controller, 400, SLOW, WARMUP_MS);
    expect(firstChange(results)).toBe(WINDOW + 2 * EVAL_EVERY - 1);
    expect(results[149]).toEqual({ tier: 'mid', changed: true, locked: false, reason: 'step-down' });
    expect(controller.tier).toBe('mid');
  });

  it('never strikes on a median of exactly 21.5 ms', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    const results = feed(controller, 1000, 21.5, WARMUP_MS);
    expect(firstChange(results)).toBe(-1);
    expect(controller.tier).toBe('high');
  });

  it('strikes on 21.5 ms plus epsilon', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    const results = feed(controller, 300, 21.5 + 1e-6, WARMUP_MS);
    expect(firstChange(results)).toBe(149);
  });

  it('averages the two middle values when the window median falls between samples', () => {
    // 45 x 20 and 45 x 23 => median (20 + 23) / 2 = 21.5, exactly on the boundary: no strike.
    const boundary = createQualityController({ initialTier: 'high', nowMs: 0 });
    for (let i = 0; i < 400; i += 1) boundary.update(i % 2 === 0 ? 20 : 23, WARMUP_MS);
    expect(boundary.tier).toBe('high');
    // 44 x 20 and 46 x 23 => median 23 > 21.5: strikes.
    const over = createQualityController({ initialTier: 'high', nowMs: 0 });
    let changed = false;
    for (let i = 0; i < 400; i += 1) {
      const dt = i % 30 < 14 ? 20 : 23; // 14 of every 30 are 20 => 42 of 90 fast, 48 slow
      changed ||= over.update(dt, WARMUP_MS).changed;
    }
    expect(changed).toBe(true);
  });

  it('treats low as a floor: more strikes never step below it', () => {
    const controller = createQualityController({ initialTier: 'low', nowMs: 0 });
    const results = feed(controller, 1000, 80, WARMUP_MS);
    expect(firstChange(results)).toBe(-1);
    expect(controller.tier).toBe('low');
  });

  it('resets the strike counter after a window that is not a strike', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    const run = (count, dt) => feed(controller, count, dt, WARMUP_MS);
    // Samples 1..90 slow, 91..150 fast: strikes at evals 90 and 120, reset at eval 150.
    expect(firstChange(run(90, SLOW))).toBe(-1);
    expect(firstChange(run(60, FAST))).toBe(-1);
    // Samples 151..240 slow: with the reset these are strikes 1 (at 210) and 2 (at 240).
    expect(firstChange(run(90, SLOW))).toBe(-1);
    // Strike 3 at sample 270.
    const rest = run(30, SLOW);
    expect(firstChange(rest)).toBe(29);
  });

  it('shuffle of the samples inside each block of 30 gives identical decisions', () => {
    const block = Array.from({ length: 30 }, (_, i) => 14 + i); // 14..43, median-ish 28.5
    const shuffle = (values, seed) => {
      const out = [...values];
      let s = seed;
      for (let i = out.length - 1; i > 0; i -= 1) {
        s = (s * 1664525 + 1013904223) % 4294967296;
        const j = s % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
    const ordered = createQualityController({ initialTier: 'high', nowMs: 0 });
    const shuffled = createQualityController({ initialTier: 'high', nowMs: 0 });
    const a = [];
    const b = [];
    for (let blockIndex = 0; blockIndex < 8; blockIndex += 1) {
      for (const dt of block) a.push(ordered.update(dt, WARMUP_MS));
      for (const dt of shuffle(block, blockIndex + 1)) b.push(shuffled.update(dt, WARMUP_MS));
    }
    expect(b).toEqual(a);
    expect(a.some((r) => r.changed)).toBe(true);
  });
});

describe('rate limit', () => {
  it('defers a second step-down 2999 ms after the first', () => {
    const controller = steppedDown(); // first change at nowMs 2000, tier mid
    const results = feed(controller, 150, 30, 4999);
    expect(firstChange(results)).toBe(-1);
    expect(controller.tier).toBe('mid');
  });

  it('allows a second step-down exactly 3000 ms after the first', () => {
    const controller = steppedDown();
    const results = feed(controller, 150, 30, 5000);
    expect(firstChange(results)).toBe(149);
    expect(controller.tier).toBe('low');
  });

  it('retries a deferred step-down at the next evaluation once 3000 ms have passed', () => {
    const controller = steppedDown();
    expect(firstChange(feed(controller, 150, 30, 4999))).toBe(-1);
    const later = feed(controller, EVAL_EVERY, 30, 5000);
    expect(firstChange(later)).toBe(EVAL_EVERY - 1);
  });
});

describe('verify-and-lock', () => {
  it('steps back up and locks when the median improved by only 5%', () => {
    const controller = steppedDown(); // pre-change median 40
    const results = feed(controller, WINDOW, 38, 4000);
    expect(results[WINDOW - 1]).toEqual({
      tier: 'high',
      changed: true,
      locked: true,
      reason: LOCK_REASON,
    });
    // Locked for good.
    expect(firstChange(feed(controller, 1000, 80, 20_000))).toBe(-1);
    expect(controller.tier).toBe('high');
  });

  it('keeps the new tier when the median improved by exactly 10%', () => {
    const controller = steppedDown(); // pre-change median 40
    const results = feed(controller, WINDOW, 36, 4000); // (40 - 36) / 40 = 0.1
    expect(firstChange(results)).toBe(-1);
    expect(results[WINDOW - 1].locked).toBe(false);
    expect(controller.tier).toBe('mid');
  });

  it('makes no verify decision before a full 90-sample window exists', () => {
    const controller = steppedDown();
    const results = feed(controller, WINDOW - 1, 40, 4000);
    expect(firstChange(results)).toBe(-1);
    expect(controller.update(40, 4000).changed).toBe(true); // the 90th sample decides
  });

  it('verifies a step down to low as well', () => {
    const controller = createQualityController({ initialTier: 'mid', nowMs: 0 });
    feed(controller, 150, 40, WARMUP_MS);
    expect(controller.tier).toBe('low');
    const results = feed(controller, WINDOW, 40, 4000);
    expect(results[WINDOW - 1]).toMatchObject({ tier: 'mid', locked: true, reason: LOCK_REASON });
  });
});

describe('warm-up and empty windows', () => {
  it('ignores frames during the 2000 ms warm-up and does not count them as samples', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    expect(firstChange(feed(controller, 1000, 40, WARMUP_MS - 1))).toBe(-1);
    const results = feed(controller, 150, 40, WARMUP_MS);
    expect(firstChange(results)).toBe(149);
  });

  it('measures the warm-up from the start time given at construction', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 10_000 });
    expect(firstChange(feed(controller, 500, 40, 11_999))).toBe(-1);
    expect(firstChange(feed(controller, 150, 40, 12_000))).toBe(149);
  });

  it('makes no decision with fewer than 90 post-warm-up samples', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    const results = feed(controller, WINDOW - 1, 1000, WARMUP_MS);
    expect(firstChange(results)).toBe(-1);
  });

  it('resetWarmup restarts the warm-up and the sample count', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    feed(controller, 100, 40, WARMUP_MS); // two evaluations' worth of strikes
    controller.resetWarmup(5000);
    expect(firstChange(feed(controller, 500, 40, 6999))).toBe(-1);
    expect(firstChange(feed(controller, 150, 40, 7000))).toBe(149);
  });

  it('ignores zero, negative and non-finite frame times', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(firstChange(feed(controller, 400, bad, WARMUP_MS))).toBe(-1);
    }
    expect(firstChange(feed(controller, 150, 40, WARMUP_MS))).toBe(149);
  });
});

describe('forced and locked controllers', () => {
  it('never changes the tier for any input when locked at construction', () => {
    const controller = createQualityController({ initialTier: 'mid', locked: true, nowMs: 0 });
    const results = feed(controller, 2000, 200, 50_000);
    expect(firstChange(results)).toBe(-1);
    expect(results[0]).toEqual({ tier: 'mid', changed: false, locked: true, reason: 'forced' });
    controller.resetWarmup(0);
    expect(controller.tier).toBe('mid');
  });

  it('lock() pins a tier with a recorded reason', () => {
    const controller = createQualityController({ initialTier: 'high', nowMs: 0 });
    controller.lock('low', 'bloom-unavailable');
    expect(controller.tier).toBe('low');
    const [result] = feed(controller, 1, 200, 50_000);
    expect(result).toEqual({
      tier: 'low',
      changed: false,
      locked: true,
      reason: 'bloom-unavailable',
    });
  });
});
