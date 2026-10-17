// Debug overlay (skeleton: behavior lands in the GREEN commit).
export function createDebugOverlay() {
  return { el: null, update() {}, due: () => false, onCopy() {} };
}
