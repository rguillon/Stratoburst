// Skeleton: pointer tracking arrives with the GREEN commit.
export function createTouchInput() {
  return {
    sample: () => ({ dxPx: 0, dyPx: 0, active: false }),
    clear() {},
    dispose() {},
  };
}
