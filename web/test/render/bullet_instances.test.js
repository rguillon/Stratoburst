import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/fx/palette.js';
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
    const { geometry } = build({ size: 6, name: 'pbullets' });
    const position = geometry.getAttribute('position');
    const box = new THREE.Box3().setFromBufferAttribute(position);
    expect(box.max.x - box.min.x).toBeCloseTo(6);
    expect(box.max.z - box.min.z).toBeCloseTo(6);
    expect(box.max.y - box.min.y).toBeCloseTo(0);
  });

  it('keeps the flat style an HDR colour so bullets cross the bloom threshold, with an override', () => {
    const flat = build({ name: 'pbullets' }).mesh.material;
    expect(flat.uniforms.uColor.value.toArray()).toEqual([4.0, 1.6, 0.4]);
    expect(
      build({ name: 'pbullets', color: [1, 2, 3] }).mesh.material.uniforms.uColor.value.toArray(),
    ).toEqual([1, 2, 3]);
  });

  it('rejects an unknown style', () => {
    expect(() => build({ style: 'comet' })).toThrow(/unknown bullet style: comet/);
  });

  describe("style 'orb'", () => {
    it('is the default for ebullets and flat for any other channel', () => {
      expect(build().mesh.material.uniforms.uCore).toBeDefined();
      expect(build({ name: 'pbullets' }).mesh.material.uniforms.uCore).toBeUndefined();
      expect(build({ name: 'pbullets', style: 'orb' }).mesh.material.uniforms.uCore).toBeDefined();
    });

    it('is drawn on top of everything without touching depth', () => {
      const { mesh } = build();
      expect(mesh.material.depthTest).toBe(false);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.renderOrder).toBe(30);
    });

    it('takes its core, halo and rim from the palette', () => {
      const { uniforms } = build().mesh.material;
      expect(uniforms.uCore.value.toArray()).toEqual([...PALETTE.ENEMY_BULLET_CORE.rgb]);
      expect(uniforms.uHalo.value.toArray()).toEqual([...PALETTE.ENEMY_BULLET_HALO.rgb]);
      expect(uniforms.uRim.value.toArray()).toEqual([...PALETTE.ENEMY_BULLET_RIM.rgb]);
    });

    it('is LDR: no channel above 0.98, since bullets are drawn after bloom', () => {
      const { uniforms } = build().mesh.material;
      for (const key of ['uCore', 'uHalo', 'uRim']) {
        expect(Math.max(...uniforms[key].value.toArray())).toBeLessThanOrEqual(0.98);
      }
    });

    it('defaults to a quad of size 6 and scales the disc to it', () => {
      const { geometry, mesh } = build();
      const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
      expect(box.max.x - box.min.x).toBeCloseTo(6);
      expect(mesh.material.uniforms.uInvHalf.value).toBeCloseTo(1 / 3);
    });

    it('draws a disc with a white core, a pink halo and a dark rim, discarding outside it', () => {
      const { fragmentShader } = build().mesh.material;
      expect(fragmentShader).toContain('if (r > 1.0) discard;');
      expect(fragmentShader).toContain('smoothstep(0.26, 0.38, r)');
      expect(fragmentShader).toContain('uRim');
    });
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
