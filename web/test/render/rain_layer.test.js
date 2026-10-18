import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BULLET_EXCLUSION_DEGREES,
  BULLET_MIN_SATURATION,
  PALETTE,
  hueDistance,
  hueOf,
  saturationOf,
} from '../../src/fx/palette.js';
import { RAIN_COLOR, createRainLayer } from '../../src/render/rain_layer.js';

const W = 240;
const H = 320;

function build(capacity = 600) {
  return createRainLayer({ capacity, playfieldW: W, playfieldH: H });
}

function seeds(layer) {
  return layer.mesh.geometry.getAttribute('aSeed');
}

describe('createRainLayer', () => {
  it('is one instanced draw over the whole capacity, named and never frustum-culled', () => {
    const rain = build(600);
    expect(rain.mesh.name).toBe('rain');
    expect(rain.mesh.geometry.isInstancedBufferGeometry).toBe(true);
    expect(rain.mesh.geometry.instanceCount).toBe(600);
    expect(rain.mesh.frustumCulled).toBe(false);
    expect(rain.capacity).toBe(600);
    expect(rain.count).toBe(600);
  });

  it('gives every streak a seed in [0, 1) and the same seeds on every build', () => {
    const a = seeds(build(64));
    const b = seeds(build(64));
    expect(a.itemSize).toBe(4);
    expect(a.count).toBe(64);
    for (const value of a.array) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(Array.from(a.array)).toEqual(Array.from(b.array));
  });

  it('derives every streak from the time uniform and a fract() wrap, so rain has no per-frame CPU work', () => {
    const { material } = build().mesh;
    expect(material.isShaderMaterial).toBe(true);
    expect(material.uniforms.uTime.value).toBe(0);
    expect(material.vertexShader).toMatch(/uniform float uTime/);
    expect(material.vertexShader).toMatch(/fract\(\s*uTime/);
  });

  it('draws additive, without depth writes, fog or frustum culling', () => {
    const { material } = build().mesh;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.fog).toBe(false);
  });

  it('draws below the particle layers (4) so a spark is never hidden by a drop', () => {
    expect(build().mesh.renderOrder).toBeLessThan(4);
  });

  it('streak colour is a pale cool blue-white below the bloom threshold and outside the bullet band', () => {
    expect(Math.max(...RAIN_COLOR)).toBeLessThanOrEqual(1);
    const hue = hueOf(RAIN_COLOR);
    expect(hue).toBeGreaterThan(190);
    expect(hue).toBeLessThan(250);
    const bullet = hueOf(PALETTE.ENEMY_BULLET_HALO.rgb);
    if (saturationOf(RAIN_COLOR) >= BULLET_MIN_SATURATION) {
      expect(hueDistance(hue, bullet)).toBeGreaterThanOrEqual(BULLET_EXCLUSION_DEGREES);
    }
    const { material } = build().mesh;
    expect(material.uniforms.uColor.value.toArray()).toEqual([...RAIN_COLOR]);
  });

  describe('setCount', () => {
    it('changes only the drawn instance count and visibility', () => {
      const rain = build(600);
      const version = seeds(rain).version;
      rain.setCount(300);
      expect(rain.mesh.geometry.instanceCount).toBe(300);
      expect(rain.count).toBe(300);
      expect(rain.mesh.visible).toBe(true);
      expect(seeds(rain).version).toBe(version);
      expect(rain.mesh.geometry.getAttribute('aSeed').count).toBe(600);
    });

    it('clamps to 0..capacity and floors a fraction', () => {
      const rain = build(600);
      rain.setCount(9999);
      expect(rain.count).toBe(600);
      rain.setCount(-5);
      expect(rain.count).toBe(0);
      rain.setCount(299.9);
      expect(rain.count).toBe(299);
      rain.setCount(Number.NaN);
      expect(rain.count).toBe(0);
    });

    it('hides the mesh at zero so the low tier draws nothing, and shows it again without a rebuild', () => {
      const rain = build(600);
      const material = rain.mesh.material;
      rain.setCount(0);
      expect(rain.mesh.visible).toBe(false);
      expect(rain.mesh.geometry.instanceCount).toBe(0);
      rain.setCount(600);
      expect(rain.mesh.visible).toBe(true);
      expect(rain.mesh.material).toBe(material);
    });
  });

  describe('update', () => {
    it('only writes the time uniform: no attribute upload, no count change', () => {
      const rain = build(600);
      const version = seeds(rain).version;
      rain.update(12.5);
      expect(rain.mesh.material.uniforms.uTime.value).toBe(12.5);
      expect(seeds(rain).version).toBe(version);
      expect(rain.count).toBe(600);
    });

    it('holds still when the time holds (hitstop and pause feed the same time)', () => {
      const rain = build(8);
      rain.update(3);
      rain.update(3);
      expect(rain.mesh.material.uniforms.uTime.value).toBe(3);
    });
  });
});
