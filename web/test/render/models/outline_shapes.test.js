import { describe, expect, it } from 'vitest';
import { mirroredShape, polygonShape } from '../../../src/render/models/outline_shapes.js';

const pointsOf = (shape) => shape.getPoints().map((p) => [p.x, p.y]);

describe('polygonShape', () => {
  it('walks the points in order and closes the outline', () => {
    const shape = polygonShape([
      [0, 0],
      [4, 0],
      [4, 3],
    ]);
    const points = pointsOf(shape);
    expect(points.slice(0, 3)).toEqual([
      [0, 0],
      [4, 0],
      [4, 3],
    ]);
    expect(points.at(-1)).toEqual([0, 0]);
  });
});

describe('mirroredShape', () => {
  const half = [
    [0, 5],
    [3, 0],
    [2, -4],
    [0, -5],
  ];

  it('mirrors the right half to the left across the centre line', () => {
    const points = pointsOf(mirroredShape(half));
    const xs = points.map(([x]) => x);
    expect(Math.min(...xs)).toBe(-3);
    expect(Math.max(...xs)).toBe(3);
    expect(points).toContainEqual([-3, 0]);
    expect(points).toContainEqual([-2, -4]);
  });

  it('does not repeat the two centre-line points', () => {
    const points = pointsOf(mirroredShape(half)).filter(([x]) => x === 0);
    // The start point is repeated once by the closing segment.
    expect(points.filter(([, y]) => y === -5)).toHaveLength(1);
  });
});
