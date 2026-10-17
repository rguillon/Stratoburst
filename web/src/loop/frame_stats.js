// Frame statistics (skeleton: behavior lands in the GREEN commit).
const ZERO = { avg: 0, p50: 0, p95: 0, max: 0 };

export function createFrameStats() {
  return {
    push() {},
    summary() {
      return {
        fps: 0,
        count: 0,
        frame: { ...ZERO },
        tick: { ...ZERO },
        render: { ...ZERO },
        steps: { avg: 0 },
        over25: 0,
        totalOver25: 0,
      };
    },
  };
}

export function createMinuteAggregator() {
  return {
    add() {},
    minutes() {
      return [];
    },
  };
}
