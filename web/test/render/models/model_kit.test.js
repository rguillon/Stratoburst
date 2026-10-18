import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  DETAILS,
  bake,
  beveledExtrude,
  capsule,
  lathe,
  normalizeDetail,
  place,
  segmentsFor,
  tint,
} from '../../../src/render/models/model_kit.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;

function square() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(4, 0);
  shape.lineTo(4, 4);
  shape.lineTo(0, 4);
  shape.closePath();
  return shape;
}

describe('normalizeDetail', () => {
  it('keeps the three known levels', () => {
    for (const level of ['high', 'mid', 'low']) expect(normalizeDetail(level)).toBe(level);
  });

  it('falls back to low for anything else', () => {
    for (const value of ['ultra', '', undefined, null, 3, 'HIGH']) {
      expect(normalizeDetail(value)).toBe('low');
    }
  });

  it('lists the levels lowest first', () => {
    expect(DETAILS).toEqual(['low', 'mid', 'high']);
  });
});

describe('segmentsFor', () => {
  const values = { high: 24, mid: 12, low: 6 };

  it('picks the value of the detail level', () => {
    expect(segmentsFor('high', values)).toBe(24);
    expect(segmentsFor('mid', values)).toBe(12);
    expect(segmentsFor('low', values)).toBe(6);
  });

  it('uses the low value for an unknown level', () => {
    expect(segmentsFor('bogus', values)).toBe(6);
  });
});

describe('generators follow the detail', () => {
  const profile = [
    [0, -1],
    [1, 0],
    [0, 1],
  ];

  it('lathe has strictly fewer vertices at each lower level', () => {
    const high = vertexCount(lathe(profile, 'high'));
    const mid = vertexCount(lathe(profile, 'mid'));
    const low = vertexCount(lathe(profile, 'low'));
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('capsule has strictly fewer vertices at each lower level', () => {
    const high = vertexCount(capsule(1, 3, 'high'));
    const mid = vertexCount(capsule(1, 3, 'mid'));
    const low = vertexCount(capsule(1, 3, 'low'));
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('beveledExtrude has no bevel at low and more vertices at high than at mid', () => {
    const high = vertexCount(beveledExtrude(square(), 1, 'high'));
    const mid = vertexCount(beveledExtrude(square(), 1, 'mid'));
    const low = beveledExtrude(square(), 1, 'low');
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(vertexCount(low));
    low.computeBoundingBox();
    expect(low.boundingBox.min.x).toBeCloseTo(0);
    expect(low.boundingBox.max.x).toBeCloseTo(4);
    expect(low.boundingBox.max.z).toBeCloseTo(1);
  });

  it('beveledExtrude grows the outline by the bevel at mid and high', () => {
    const box = beveledExtrude(square(), 1, 'high', 0.5);
    box.computeBoundingBox();
    expect(box.boundingBox.max.x).toBeCloseTo(4.5);
    expect(box.boundingBox.max.z).toBeCloseTo(1.5);
  });
});

describe('tint', () => {
  it('writes the colour at every vertex and returns the geometry', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    expect(tint(geometry, [0.2, 0.4, 0.6])).toBe(geometry);
    const color = geometry.getAttribute('color');
    expect(color.count).toBe(vertexCount(geometry));
    for (let i = 0; i < color.count; i++) {
      expect(color.getX(i)).toBeCloseTo(0.2);
      expect(color.getY(i)).toBeCloseTo(0.4);
      expect(color.getZ(i)).toBeCloseTo(0.6);
    }
  });

  it('replaces a colour that was already there', () => {
    const geometry = tint(tint(new THREE.BoxGeometry(1, 1, 1), [1, 0, 0]), [0, 0, 1]);
    expect(geometry.getAttribute('color').getX(0)).toBe(0);
    expect(geometry.getAttribute('color').getZ(0)).toBe(1);
  });
});

describe('place', () => {
  it('moves, turns and scales the geometry in place', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    place(geometry, { position: [10, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 3] });
    geometry.computeBoundingBox();
    // Scaled 3x along Z, then turned a quarter about Y (so the long axis lies along X), then moved.
    expect(geometry.boundingBox.min.x).toBeCloseTo(7);
    expect(geometry.boundingBox.max.x).toBeCloseTo(13);
    expect(geometry.boundingBox.max.z).toBeCloseTo(1);
  });

  it('keeps unit normals when it scales non-uniformly', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    place(geometry, { scale: [1, 1, 4] });
    const normal = geometry.getAttribute('normal');
    const length = Math.hypot(normal.getX(10), normal.getY(10), normal.getZ(10));
    expect(length).toBeCloseTo(1);
  });

  it('does nothing without options', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    place(geometry);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.max.x).toBeCloseTo(1);
  });
});

describe('bake', () => {
  const attributeNames = (geometry) => Object.keys(geometry.attributes).sort();

  it('bake merges an indexed and a non-indexed part with different attributes into position, normal and color', () => {
    const indexed = new THREE.BoxGeometry(1, 1, 1); // indexed, has uv
    const plain = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); // not indexed
    plain.deleteAttribute('normal'); // missing normals are computed
    tint(plain, [0.3, 0.3, 0.3]);
    const baked = bake([indexed, plain], 'test-model');
    expect(baked).not.toBeNull();
    expect(baked.isBufferGeometry).toBe(true);
    expect(baked.index).toBeNull();
    expect(attributeNames(baked)).toEqual(['color', 'normal', 'position']);
    expect(vertexCount(baked)).toBe(72);
    expect(baked.boundingSphere).not.toBeNull();
  });

  it('bake gives a part without colour a mid grey', () => {
    const baked = bake([new THREE.BoxGeometry(1, 1, 1)], 'grey');
    expect(baked.getAttribute('color').getX(0)).toBeCloseTo(0.5);
  });

  it('bake does not modify the parts it is given', () => {
    const part = new THREE.BoxGeometry(1, 1, 1);
    bake([part], 'untouched');
    expect(part.index).not.toBeNull();
    expect(part.hasAttribute('uv')).toBe(true);
    expect(part.hasAttribute('color')).toBe(false);
  });

  it('bake keeps smooth normals when it un-indexes a part', () => {
    const sphere = new THREE.SphereGeometry(1, 8, 6);
    const baked = bake([sphere], 'smooth');
    const position = baked.getAttribute('position');
    const normal = baked.getAttribute('normal');
    for (const i of [5, 40, 100]) {
      const length = Math.hypot(position.getX(i), position.getY(i), position.getZ(i));
      expect(normal.getX(i)).toBeCloseTo(position.getX(i) / length, 3);
      expect(normal.getZ(i)).toBeCloseTo(position.getZ(i) / length, 3);
    }
  });

  it('bake throws on an empty list', () => {
    expect(() => bake([], 'nothing')).toThrow(/nothing/);
  });

  it('bake throws an Error naming the model when the merge still fails', () => {
    const flat = new THREE.BufferGeometry();
    flat.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 2)); // 2D positions
    flat.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => bake([new THREE.BoxGeometry(1, 1, 1), flat], 'broken-model')).toThrow(
        'cannot bake model broken-model',
      );
    } finally {
      error.mockRestore();
    }
  });

  it('is deterministic: two fresh bakes have identical positions', () => {
    const build = () =>
      bake(
        [
          tint(lathe([[0, -1], [1, 0], [0, 1]], 'high'), [0.5, 0.5, 0.5]),
          place(tint(capsule(0.5, 2, 'high'), [0.4, 0.4, 0.4]), { position: [2, 0, 0] }),
          tint(beveledExtrude(square(), 1, 'high'), [0.3, 0.3, 0.3]),
        ],
        'twice',
      );
    const a = build();
    const b = build();
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
  });
});
