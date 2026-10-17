import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBulletInstances } from '../../src/render/bullet_instances.js';

const STRIDE = 4;

function build(overrides = {}) {
  const capacity = overrides.capacity ?? 16;
  const data = new Float32Array(STRIDE * capacity);
  const bullets = createBulletInstances({
    data,
    capacity,
    playfieldW: 240,
    playfieldH: 320,
    ...overrides,
  });
  return { data, bullets, mesh: bullets.mesh, geometry: bullets.mesh.geometry };
}

describe('createBulletInstances', () => {
  it('is one instanced draw named after the channel, never frustum-culled', () => {
    const { mesh } = build({ name: 'pbullets' });
    expect(mesh.name).toBe('pbullets');
    expect(mesh.geometry.isInstancedBufferGeometry).toBe(true);
    expect(mesh.frustumCulled).toBe(false);
  });

  it('defaults the name to ebullets', () => {
    expect(build().mesh.name).toBe('ebullets');
  });

  it('draws nothing until told how many bullets are live', () => {
    expect(build().geometry.instanceCount).toBe(0);
  });

  it('shares the Python-assigned array with the GPU attribute (no copy)', () => {
    const { data, geometry } = build();
    const attribute = geometry.getAttribute('aData');
    expect(attribute.array).toBe(data);
    expect(attribute.itemSize).toBe(4);
    expect(attribute.usage).toBe(THREE.DynamicDrawUsage);
  });

  it('centres the playfield through the halfW / halfH uniforms', () => {
    const { mesh } = build();
    expect(mesh.material.uniforms.halfW.value).toBe(120);
    expect(mesh.material.uniforms.halfH.value).toBe(160);
  });

  it('gives the bullet quad the requested size, flat on the ground plane', () => {
    const { geometry } = build({ size: 6 });
    const position = geometry.getAttribute('position');
    const box = new THREE.Box3().setFromBufferAttribute(position);
    expect(box.max.x - box.min.x).toBeCloseTo(6);
    expect(box.max.z - box.min.z).toBeCloseTo(6);
    expect(box.max.y - box.min.y).toBeCloseTo(0);
  });

  it('uses an HDR colour by default so bullets cross the bloom threshold, and accepts an override', () => {
    expect(build().mesh.material.uniforms.uColor.value.toArray()).toEqual([4.0, 1.6, 0.4]);
    expect(build({ color: [1, 2, 3] }).mesh.material.uniforms.uColor.value.toArray()).toEqual([
      1, 2, 3,
    ]);
  });

  describe('update', () => {
    it('sets the instance count and uploads exactly the live prefix', () => {
      const { bullets, geometry } = build();
      const attribute = geometry.getAttribute('aData');
      const version = attribute.version;

      bullets.update(5);

      expect(geometry.instanceCount).toBe(5);
      expect(attribute.updateRanges).toEqual([{ start: 0, count: 5 * STRIDE }]);
      expect(attribute.version).toBeGreaterThan(version);
    });

    it('clamps the count to the capacity', () => {
      const { bullets, geometry } = build({ capacity: 8 });

      bullets.update(1000);

      expect(geometry.instanceCount).toBe(8);
      expect(geometry.getAttribute('aData').updateRanges).toEqual([{ start: 0, count: 8 * STRIDE }]);
    });

    it('replaces the previous upload range instead of accumulating them', () => {
      const { bullets, geometry } = build();

      bullets.update(10);
      bullets.update(3);

      expect(geometry.getAttribute('aData').updateRanges).toEqual([{ start: 0, count: 3 * STRIDE }]);
      expect(geometry.instanceCount).toBe(3);
    });

    it('draws nothing again when the count drops to zero', () => {
      const { bullets, geometry } = build();

      bullets.update(4);
      bullets.update(0);

      expect(geometry.instanceCount).toBe(0);
    });
  });
});
