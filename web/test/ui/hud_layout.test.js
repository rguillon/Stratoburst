import { describe, expect, it } from 'vitest';
import { layoutHud } from '../../src/ui/hud_layout.js';

// Playfield corners in CSS pixels in the order projectCorners returns them:
// [-x far, -x near, +x far, +x near]. The far (top) edge is narrower than the near (bottom) one.
const corners = ({ farLeft, farRight, nearLeft, nearRight, top, bottom }) => [
  { x: farLeft, y: top },
  { x: nearLeft, y: bottom },
  { x: farRight, y: top },
  { x: nearRight, y: bottom },
];

const PHONE = {
  corners: corners({ farLeft: 40, farRight: 350, nearLeft: 0, nearRight: 390, top: 120, bottom: 640 }),
  viewportW: 390,
  viewportH: 844,
};

describe('layoutHud', () => {
  it('puts the top band along the far edge of the playfield, inside a small pad', () => {
    const { top } = layoutHud(PHONE);
    expect(top.left).toBeGreaterThanOrEqual(40);
    expect(top.top).toBeGreaterThanOrEqual(120);
    expect(top.top).toBeLessThan(150);
    expect(top.left + top.width).toBeLessThanOrEqual(350);
    expect(top.width).toBeGreaterThan(200);
  });

  it('puts lives and bombs at the near-left corner and weapon and level at the near-right corner', () => {
    const { bottomLeft, bottomRight } = layoutHud(PHONE);
    expect(bottomLeft.left).toBeGreaterThanOrEqual(0);
    expect(bottomLeft.left).toBeLessThan(30);
    expect(bottomRight.right).toBeLessThanOrEqual(390);
    expect(bottomRight.right).toBeGreaterThan(360);
    // The blocks end just above the near edge of the playfield and share a baseline.
    expect(bottomLeft.top + 48).toBeLessThanOrEqual(640);
    expect(bottomLeft.top + 48).toBeGreaterThan(620);
    expect(bottomRight.top).toBe(bottomLeft.top);
  });

  it('keeps every block inside the viewport minus the safe insets', () => {
    const insets = { left: 44, right: 44, top: 30, bottom: 21 };
    const result = layoutHud({
      corners: corners({ farLeft: -20, farRight: 880, nearLeft: -60, nearRight: 900, top: -10, bottom: 395 }),
      viewportW: 844,
      viewportH: 390,
      insets,
    });
    expect(result.top.left).toBeGreaterThanOrEqual(insets.left);
    expect(result.top.left + result.top.width).toBeLessThanOrEqual(844 - insets.right);
    expect(result.top.top).toBeGreaterThanOrEqual(insets.top);
    expect(result.bottomLeft.left).toBeGreaterThanOrEqual(insets.left);
    expect(result.bottomRight.right).toBeLessThanOrEqual(844 - insets.right);
    expect(result.bottomLeft.top + 48).toBeLessThanOrEqual(390 - insets.bottom);
  });

  it('leaves the bottom-right block in its corner when the bomb button is elsewhere', () => {
    const corner = layoutHud(PHONE).bottomRight;
    // In the margin below the playfield.
    expect(layoutHud({ ...PHONE, bombRect: { left: 306, top: 760, width: 72, height: 72 } }).bottomRight).toEqual(
      corner,
    );
    // Hidden (keyboard mode).
    expect(layoutHud({ ...PHONE, bombRect: null }).bottomRight).toEqual(corner);
    // In a right-hand margin, beside the playfield.
    const wide = {
      corners: corners({ farLeft: 100, farRight: 500, nearLeft: 80, nearRight: 520, top: 0, bottom: 390 }),
      viewportW: 844,
      viewportH: 390,
    };
    const wideCorner = layoutHud(wide).bottomRight;
    expect(layoutHud({ ...wide, bombRect: { left: 760, top: 306, width: 72, height: 72 } }).bottomRight).toEqual(
      wideCorner,
    );
  });

  it('moves the bottom-right block above the bomb button when they overlap, and back when it hides', () => {
    const bombRect = { left: 306, top: 556, width: 72, height: 72 };
    const corner = layoutHud(PHONE).bottomRight;
    const moved = layoutHud({ ...PHONE, bombRect }).bottomRight;
    expect(moved.right).toBe(corner.right);
    expect(moved.top + 48).toBeLessThanOrEqual(bombRect.top);
    expect(moved.top).toBeLessThan(corner.top);
    expect(layoutHud({ ...PHONE, bombRect: undefined }).bottomRight).toEqual(corner);
  });

  it('leaves the bottom-left block alone whatever the bomb button does', () => {
    const bombRect = { left: 306, top: 556, width: 72, height: 72 };
    expect(layoutHud({ ...PHONE, bombRect }).bottomLeft).toEqual(layoutHud(PHONE).bottomLeft);
  });

  it('never lets the moved block climb above the top of the safe area', () => {
    const tiny = {
      corners: corners({ farLeft: 0, farRight: 300, nearLeft: 0, nearRight: 300, top: 0, bottom: 100 }),
      viewportW: 300,
      viewportH: 100,
      insets: { left: 0, right: 0, top: 10, bottom: 0 },
      bombRect: { left: 200, top: 20, width: 72, height: 72 },
    };
    expect(layoutHud(tiny).bottomRight.top).toBeGreaterThanOrEqual(10);
  });

  it('falls back to the viewport edges when the projection gave nothing usable', () => {
    const result = layoutHud({
      corners: [{ x: Number.NaN, y: Number.NaN }],
      viewportW: 400,
      viewportH: 300,
    });
    expect(result.top.left).toBeGreaterThanOrEqual(0);
    expect(result.top.left + result.top.width).toBeLessThanOrEqual(400);
    expect(result.bottomRight.right).toBeLessThanOrEqual(400);
    expect(result.bottomLeft.top + 48).toBeLessThanOrEqual(300);
  });

  it('honours a custom block height', () => {
    const result = layoutHud({ ...PHONE, blockHeight: 80 });
    expect(result.bottomLeft.top + 80).toBeLessThanOrEqual(640);
    expect(result.bottomLeft.top + 80).toBeGreaterThan(620);
  });

  it('never returns a negative band width', () => {
    const squeezed = layoutHud({
      corners: corners({ farLeft: 100, farRight: 104, nearLeft: 100, nearRight: 104, top: 0, bottom: 50 }),
      viewportW: 300,
      viewportH: 100,
    });
    expect(squeezed.top.width).toBe(0);
  });
});
