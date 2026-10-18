import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createParticleLayer } from '../../src/fx/particle_system.js';

const ITEM_SIZES = { aStart: 3, aVel: 4, aLife: 2, aSize: 2, aColor: 3 };

function emitN(layer, n, base = 0) {
  for (let i = 0; i < n; i += 1) layer.emit(base + i, 0, 0, 1, 2, 3, 0.5, 4, 8, 0.1, 0.2, 0.3, 1);
}

function attr(layer, name) {
  return layer.mesh.geometry.getAttribute(name);
}

describe('createParticleLayer', () => {
  it('is one instanced draw covering the whole ring, named and never frustum-culled', () => {
    const layer = createParticleLayer({ capacity: 8, name: 'fx-additive' });
    expect(layer.mesh.name).toBe('fx-additive');
    expect(layer.mesh.geometry.isInstancedBufferGeometry).toBe(true);
    expect(layer.mesh.geometry.instanceCount).toBe(8);
    expect(layer.mesh.frustumCulled).toBe(false);
    expect(layer.capacity).toBe(8);
  });

  it('allocates every instanced attribute once at capacity as dynamic draw', () => {
    const layer = createParticleLayer({ capacity: 8 });
    for (const [name, itemSize] of Object.entries(ITEM_SIZES)) {
      const attribute = attr(layer, name);
      expect(attribute.itemSize).toBe(itemSize);
      expect(attribute.count).toBe(8);
      expect(attribute.usage).toBe(THREE.DynamicDrawUsage);
    }
  });

  it('uses additive blending by default and normal blending on request, without depth writes', () => {
    expect(createParticleLayer({ capacity: 4 }).mesh.material.blending).toBe(THREE.AdditiveBlending);
    const normal = createParticleLayer({ capacity: 4, blending: 'normal' }).mesh.material;
    expect(normal.blending).toBe(THREE.NormalBlending);
    expect(normal.transparent).toBe(true);
    expect(normal.depthWrite).toBe(false);
  });

  it('includes the tonemapping and colourspace chunks like the bullet material', () => {
    const { fragmentShader } = createParticleLayer({ capacity: 4 }).mesh.material;
    expect(fragmentShader).toContain('<tonemapping_fragment>');
    expect(fragmentShader).toContain('<colorspace_fragment>');
  });

  it('writes a particle spawn record at the ring head and counts every emit', () => {
    const layer = createParticleLayer({ capacity: 8 });
    layer.update(2.5);
    layer.emit(1, 2, 3, 4, 5, 6, 0.7, 8, 9, 10, 11, 12, 0.5);
    expect(Array.from(attr(layer, 'aStart').array.slice(0, 3))).toEqual([1, 2, 3]);
    expect(Array.from(attr(layer, 'aVel').array.slice(0, 4))).toEqual([4, 5, 6, 0.5]);
    expect(Array.from(attr(layer, 'aLife').array.slice(0, 2))).toEqual([2.5, expect.closeTo(0.7, 5)]);
    expect(Array.from(attr(layer, 'aSize').array.slice(0, 2))).toEqual([8, 9]);
    expect(Array.from(attr(layer, 'aColor').array.slice(0, 3))).toEqual([10, 11, 12]);
    expect(layer.spawned).toBe(1);
  });

  it('uploads only the slots written since the last update', () => {
    const layer = createParticleLayer({ capacity: 8 });
    emitN(layer, 3);
    layer.update(0.1);
    expect(attr(layer, 'aStart').updateRanges).toEqual([{ start: 0, count: 3 * 3 }]);
    expect(attr(layer, 'aVel').updateRanges).toEqual([{ start: 0, count: 3 * 4 }]);

    emitN(layer, 2);
    layer.update(0.2);
    expect(attr(layer, 'aStart').updateRanges).toEqual([{ start: 3 * 3, count: 2 * 3 }]);
    expect(attr(layer, 'aColor').updateRanges).toEqual([{ start: 3 * 3, count: 2 * 3 }]);
  });

  it('skips the upload when nothing was emitted', () => {
    const layer = createParticleLayer({ capacity: 8 });
    emitN(layer, 1);
    layer.update(0.1);
    const version = attr(layer, 'aStart').version;
    layer.update(0.2);
    expect(attr(layer, 'aStart').version).toBe(version);
  });

  it('wraps to slot 0 after capacity, overwriting the oldest, and uploads the whole buffer', () => {
    const layer = createParticleLayer({ capacity: 4 });
    emitN(layer, 5, 100);
    expect(attr(layer, 'aStart').array[0]).toBe(104); // slot 0 overwritten by the fifth emit
    expect(attr(layer, 'aStart').array[3]).toBe(101); // slot 1 still holds the second
    layer.update(0.3);
    expect(attr(layer, 'aStart').updateRanges).toEqual([{ start: 0, count: 4 * 3 }]);
    expect(layer.spawned).toBe(5);

    emitN(layer, 1);
    layer.update(0.4);
    expect(attr(layer, 'aStart').updateRanges).toEqual([{ start: 1 * 3, count: 3 }]);
  });

  it('sets uTime on update', () => {
    const layer = createParticleLayer({ capacity: 4 });
    layer.update(7.25);
    expect(layer.mesh.material.uniforms.uTime.value).toBe(7.25);
  });
});
