// Skeleton: merging keyboard and touch arrives with the GREEN commit.
export function createInputSampler() {
  return {
    sample: () => ({ buttons: 0, moveX: 0, moveY: 0, dragX: 0, dragY: 0 }),
    setTouchMode() {},
    touchMode: false,
  };
}
