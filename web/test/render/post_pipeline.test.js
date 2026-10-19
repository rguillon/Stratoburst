import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPostPipeline } from '../../src/render/post_pipeline.js';
import { TIERS } from '../../src/quality/tiers.js';

// EffectComposer only asks the renderer for its size and pixel ratio when it is built, so a stub is
// enough to inspect the pass list without a GL context.
const renderer = {
  getSize: (out) => out.set(800, 600),
  getPixelRatio: () => 1,
};
const camera = new THREE.PerspectiveCamera();

function build(options) {
  return createPostPipeline(renderer, new THREE.Scene(), camera, options);
}

describe('createPostPipeline', () => {
  it('lists scene, bloom, bullets, output when a bullet scene is given', () => {
    expect(build({ bulletScene: new THREE.Scene() }).passNames()).toEqual([
      'scene',
      'bloom',
      'bullets',
      'output',
    ]);
  });

  it('has no bullet pass without a bullet scene', () => {
    expect(build().passNames()).toEqual(['scene', 'bloom', 'output']);
  });

  it('draws the bullet scene over the bloomed frame: colour kept, depth cleared', () => {
    const bulletScene = new THREE.Scene();
    const pipeline = build({ bulletScene });
    const pass = pipeline.composer.passes[2];
    expect(pass.scene).toBe(bulletScene);
    expect(pass.clear).toBe(false);
    expect(pass.clearDepth).toBe(true);
    expect(pass.needsSwap).toBe(false);
  });

  it('bypasses the composer on the off bloom tier and re-enables it on the others', () => {
    const pipeline = build({ bulletScene: new THREE.Scene() });
    expect(pipeline.enabled).toBe(true);
    pipeline.setTier({ bloom: 'off' });
    expect(pipeline.enabled).toBe(false);
    pipeline.setTier({ bloom: 'half' });
    expect(pipeline.enabled).toBe(true);
    expect(pipeline.bloomPass.scale).toBe(0.5);
  });

  it('seeds the live base strength from the constructor strength', () => {
    expect(build().bloomPass.baseStrength).toBe(0.45);
    expect(build({ strength: 0.7 }).bloomPass.baseStrength).toBe(0.7);
  });

  it('applies the tier bloom strength to both the pass and its base', () => {
    const pipeline = build();
    pipeline.setTier(TIERS.mid);
    expect(pipeline.bloomPass.strength).toBe(0.5);
    expect(pipeline.bloomPass.baseStrength).toBe(0.5);
    pipeline.setTier(TIERS.high);
    expect(pipeline.bloomPass.strength).toBe(0.6);
    expect(pipeline.bloomPass.baseStrength).toBe(0.6);
  });

  it('leaves the pass disabled on the low tier and does not touch the strength', () => {
    const pipeline = build();
    pipeline.setTier(TIERS.high);
    pipeline.setTier(TIERS.low);
    expect(pipeline.enabled).toBe(false);
    expect(pipeline.bloomPass.strength).toBe(0.6);
    expect(pipeline.bloomPass.baseStrength).toBe(0.6);
  });
});
