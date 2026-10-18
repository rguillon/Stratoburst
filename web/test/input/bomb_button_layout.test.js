import { describe, expect, it } from 'vitest';
import { layoutBombButton } from '../../src/input/bomb_button_layout.js';

// Playfield corners in CSS pixels in the order projectCorners returns them:
// [-x far, -x near, +x far, +x near]. Only the right and bottom edges matter to the layout.
const corners = ({ left, right, top, bottom }) => [
  { x: left + 20, y: top },
  { x: left, y: bottom },
  { x: right - 20, y: top },
  { x: right, y: bottom },
];

describe('layoutBombButton', () => {
  it('landscape: sits in the right margin, bottom-aligned with a 12 px gap', () => {
    // 844 x 390 with the playfield pillarboxed: a 200 px margin on the right.
    const result = layoutBombButton({
      corners: corners({ left: 0, right: 644, top: 0, bottom: 390 }),
      viewportW: 844,
      viewportH: 390,
    });
    expect(result.size).toBe(72);
    expect(result).toEqual({ left: 844 - 12 - 72, top: 390 - 12 - 72, size: 72, inMargin: true });
    expect(result.left).toBeGreaterThanOrEqual(644);
  });

  it('portrait: sits in the bottom margin at the playfield right side', () => {
    // 390 x 844 with the playfield letterboxed: 200 px free below it.
    const result = layoutBombButton({
      corners: corners({ left: 0, right: 390, top: 100, bottom: 644 }),
      viewportW: 390,
      viewportH: 844,
    });
    expect(result.inMargin).toBe(true);
    expect(result.size).toBe(72);
    expect(result.top).toBe(844 - 12 - 72);
    expect(result.top).toBeGreaterThanOrEqual(644);
    expect(result.left + result.size).toBe(390 - 12);
  });

  it('portrait: needs a bottom margin of at least size + gap', () => {
    const fits = layoutBombButton({
      corners: corners({ left: 0, right: 390, top: 0, bottom: 844 - 84 }),
      viewportW: 390,
      viewportH: 844,
    });
    expect(fits.inMargin).toBe(true);
    const tight = layoutBombButton({
      corners: corners({ left: 0, right: 390, top: 0, bottom: 844 - 83 }),
      viewportW: 390,
      viewportH: 844,
    });
    expect(tight.inMargin).toBe(false);
  });

  it('no margin: overlays the playfield bottom-right corner, inset by the gap', () => {
    const result = layoutBombButton({
      corners: corners({ left: 0, right: 600, top: 0, bottom: 800 }),
      viewportW: 600,
      viewportH: 800,
    });
    expect(result).toEqual({ left: 600 - 12 - 90, top: 800 - 12 - 90, size: 90, inMargin: false });
  });

  it('overlays the playfield corner, not the viewport corner, when the playfield is smaller', () => {
    // A square 500 x 500 viewport whose playfield stops 20 px short on both sides.
    const result = layoutBombButton({
      corners: corners({ left: 20, right: 480, top: 20, bottom: 480 }),
      viewportW: 500,
      viewportH: 500,
    });
    expect(result.inMargin).toBe(false);
    expect(result.left + result.size).toBe(480 - 12);
    expect(result.top + result.size).toBe(480 - 12);
  });

  it.each([
    [300, 300, 72],
    [390, 844, 72],
    [600, 800, 90],
    [844, 390, 72],
    [1280, 720, 108],
    [1920, 1080, 112],
    [3000, 2000, 112],
  ])('size is round(0.15 * shorter side) clamped to 72..112 (%i x %i gives %i)', (w, h, size) => {
    const result = layoutBombButton({
      corners: corners({ left: 0, right: w, top: 0, bottom: h }),
      viewportW: w,
      viewportH: h,
    });
    expect(result.size).toBe(size);
  });

  it('safe-area insets shift the margin placement inward', () => {
    const base = layoutBombButton({
      corners: corners({ left: 0, right: 644, top: 0, bottom: 390 }),
      viewportW: 844,
      viewportH: 390,
    });
    const inset = layoutBombButton({
      corners: corners({ left: 0, right: 644, top: 0, bottom: 390 }),
      viewportW: 844,
      viewportH: 390,
      insets: { left: 0, right: 40, top: 0, bottom: 20 },
    });
    expect(inset.inMargin).toBe(true);
    expect(inset.left).toBe(base.left - 40);
    expect(inset.top).toBe(base.top - 20);
  });

  it('safe-area insets shift the overlay placement inward', () => {
    const base = layoutBombButton({
      corners: corners({ left: 0, right: 600, top: 0, bottom: 800 }),
      viewportW: 600,
      viewportH: 800,
    });
    const inset = layoutBombButton({
      corners: corners({ left: 0, right: 600, top: 0, bottom: 800 }),
      viewportW: 600,
      viewportH: 800,
      insets: { left: 0, right: 30, top: 0, bottom: 34 },
    });
    expect(inset.inMargin).toBe(false);
    expect(inset.left).toBe(base.left - 30);
    expect(inset.top).toBe(base.top - 34);
  });

  it('an inset that eats the margin falls back to the overlay', () => {
    const result = layoutBombButton({
      corners: corners({ left: 0, right: 744, top: 0, bottom: 390 }),
      viewportW: 844,
      viewportH: 390,
      insets: { left: 0, right: 40, top: 0, bottom: 0 },
    });
    expect(result.inMargin).toBe(false);
  });

  it('a custom gap is honoured', () => {
    const result = layoutBombButton({
      corners: corners({ left: 0, right: 600, top: 0, bottom: 800 }),
      viewportW: 600,
      viewportH: 800,
      gap: 20,
    });
    expect(result.left).toBe(600 - 20 - 90);
  });

  it('treats a non-finite corner as the viewport edge', () => {
    const result = layoutBombButton({
      corners: [{ x: Number.NaN, y: Number.NaN }],
      viewportW: 600,
      viewportH: 800,
    });
    expect(result).toEqual({ left: 498, top: 698, size: 90, inMargin: false });
  });
});
