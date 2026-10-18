import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPlayfieldMask } from '../../src/render/playfield_mask.js';

function triangleArea(geometry) {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    area += new THREE.Triangle(a, b, c).getArea();
  }
  return area;
}

describe('createPlayfieldMask', () => {
  const group = createPlayfieldMask();
  const dim = group.getObjectByName('playfield-dim');
  const outline = group.getObjectByName('playfield-outline');

  it('is one mesh plus one outline line', () => {
    expect(group.name).toBe('playfield-mask');
    expect(group.children).toHaveLength(2);
    expect(dim.isMesh).toBe(true);
    expect(outline.isLineLoop).toBe(true);
  });

  it('covers the big square minus exactly the playfield rectangle', () => {
    const extent = 3000;
    expect(triangleArea(dim.geometry)).toBeCloseTo((2 * extent) ** 2 - 240 * 320, 3);
  });

  it('lies flat on the XZ plane just below the gameplay plane', () => {
    dim.geometry.computeBoundingBox();
    const { min, max } = dim.geometry.boundingBox;
    expect(min.y).toBeCloseTo(0, 6);
    expect(max.y).toBeCloseTo(0, 6);
    expect(dim.position.y).toBeLessThan(0);
  });

  it('dims without writing depth and draws after the terrain', () => {
    expect(dim.material.transparent).toBe(true);
    expect(dim.material.depthWrite).toBe(false);
    expect(dim.material.opacity).toBe(0.55);
    expect(dim.renderOrder).toBeGreaterThan(0);
  });

  it('is night-coloured: a dark violet dim and a cool outline below the bloom threshold', () => {
    expect(dim.material.color.getHex()).toBe(0x07061a);
    expect(outline.material.color.getHex()).toBe(0x3a3f6b);
    for (const channel of outline.material.color.toArray()) expect(channel).toBeLessThan(1);
  });

  it('honours a custom playfield size', () => {
    const custom = createPlayfieldMask({ halfW: 10, halfH: 20, extent: 100 }).getObjectByName(
      'playfield-dim',
    );
    expect(triangleArea(custom.geometry)).toBeCloseTo(200 * 200 - 20 * 40, 3);
  });
});
