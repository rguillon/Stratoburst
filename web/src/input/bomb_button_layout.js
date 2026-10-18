// Where the bomb button goes (D-13). Pure: no DOM. The playfield is letterboxed inside the
// viewport, so there is often a free margin on the right (landscape) or at the bottom (portrait).
// The button sits in a margin when one is wide enough for it plus a gap, bottom-right aligned, and
// otherwise overlays the playfield's bottom-right corner.

const MIN_SIZE = 72;
const MAX_SIZE = 112;
const SIZE_FRACTION = 0.15;

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// The largest finite coordinate, or the viewport edge when the projection gave nothing usable.
function edge(values, fallback) {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? Math.max(...finite) : fallback;
}

// corners: the projected playfield corners in CSS pixels (projectCorners). Their max x and max y are
// the playfield's right and bottom edges. Returns { left, top, size, inMargin } in CSS pixels.
export function layoutBombButton({
  corners,
  viewportW,
  viewportH,
  insets = { left: 0, right: 0, top: 0, bottom: 0 },
  gap = 12,
}) {
  const size = clamp(Math.round(SIZE_FRACTION * Math.min(viewportW, viewportH)), MIN_SIZE, MAX_SIZE);
  const fieldRight = edge(
    corners.map((c) => c.x),
    viewportW,
  );
  const fieldBottom = edge(
    corners.map((c) => c.y),
    viewportH,
  );

  // The right-hand and bottom-hand slots hug the viewport's bottom-right corner (inside the insets).
  const right = { left: viewportW - insets.right - gap - size, top: viewportH - insets.bottom - gap - size };
  const rightFits = right.left >= fieldRight;
  // In the bottom margin the button sits at the playfield's right side, which is the viewport's right
  // edge whenever the playfield spans the width.
  const bottom = {
    left: Math.min(fieldRight, viewportW - insets.right - gap) - size,
    top: right.top,
  };
  const bottomFits = bottom.top >= fieldBottom;

  const landscape = viewportW >= viewportH;
  if (landscape && rightFits) return { ...right, size, inMargin: true };
  if (bottomFits) return { ...bottom, size, inMargin: true };
  if (rightFits) return { ...right, size, inMargin: true };

  return {
    left: Math.min(fieldRight, viewportW - insets.right) - gap - size,
    top: Math.min(fieldBottom, viewportH - insets.bottom) - gap - size,
    size,
    inMargin: false,
  };
}
