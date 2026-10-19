// Where the HUD blocks go (D-23). Pure: no DOM. Like an arcade cabinet the HUD sits over the playfield
// edges: score and high score along the top, lives and bombs at the bottom-left corner, weapon and level
// at the bottom-right corner. Everything is clamped inside the viewport minus the safe-area insets, so the
// letterbox margins and the notch never push a block out of reach. On a phone the touch bomb button can
// overlay the playfield's bottom-right corner (it only sits in a margin when one is wide enough); the
// weapon block then moves above it instead of hiding under the thumb (RESEARCH Pitfall 12).

const PAD = 8; // px between a playfield edge and the block
const GAP = 8; // px between the bomb button and the block that avoids it
const BLOCK_WIDTH = 120; // widest the bottom-right block gets (a six-letter weapon name at the largest font)
const NO_INSETS = Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// A finite coordinate, or the fallback when the projection gave nothing usable.
const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const overlaps = (a, b) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

// corners: the projected playfield corners in CSS pixels, in projectCorners' order
// [-x far, -x near, +x far, +x near]. bombRect: { left, top, width, height } of the visible bomb button, or
// null / undefined when it is hidden. Returns, in CSS pixels:
//   top:         { left, top, width }  the band along the far edge (score and high score, centred in it)
//   bottomLeft:  { left, top }         the block's top-left (lives and bombs)
//   bottomRight: { right, top }        the block's right edge and top (weapon and level, right-aligned)
export function layoutHud({
  corners,
  viewportW,
  viewportH,
  insets = NO_INSETS,
  bombRect = null,
  blockHeight = 48,
}) {
  const safeLeft = insets.left;
  const safeRight = viewportW - insets.right;
  const safeTop = insets.top;
  const safeBottom = viewportH - insets.bottom;
  const [farLeft, nearLeft, farRight, nearRight] = corners;

  // The far (top) edge is narrower than the near (bottom) one under the tilted camera.
  const topLeft = clamp(finiteOr(farLeft?.x, safeLeft) + PAD, safeLeft, safeRight);
  const topRight = clamp(finiteOr(farRight?.x, safeRight) - PAD, safeLeft, safeRight);
  const topEdge = clamp(finiteOr(farLeft?.y, safeTop) + PAD, safeTop, safeBottom);

  const bottomLeftX = clamp(finiteOr(nearLeft?.x, safeLeft) + PAD, safeLeft, safeRight);
  const bottomRightX = clamp(finiteOr(nearRight?.x, safeRight) - PAD, safeLeft, safeRight);
  const nearEdge = clamp(finiteOr(nearLeft?.y, safeBottom) - PAD, safeTop, safeBottom);
  const blockTop = Math.max(safeTop, nearEdge - blockHeight);

  let rightTop = blockTop;
  if (bombRect) {
    const block = { left: bottomRightX - BLOCK_WIDTH, top: blockTop, width: BLOCK_WIDTH, height: blockHeight };
    if (overlaps(block, bombRect)) rightTop = Math.max(safeTop, bombRect.top - GAP - blockHeight);
  }

  return {
    top: { left: topLeft, top: topEdge, width: Math.max(0, topRight - topLeft) },
    bottomLeft: { left: bottomLeftX, top: blockTop },
    bottomRight: { right: bottomRightX, top: rightTop },
  };
}
