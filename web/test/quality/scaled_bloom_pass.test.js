import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ScaledBloomPass } from '../../src/quality/scaled_bloom_pass.js';

const resolution = new THREE.Vector2(800, 600);

describe('ScaledBloomPass', () => {
  it('renders bloom at the given fraction of the pass size', () => {
    const pass = new ScaledBloomPass(resolution, 0.45, 0.25, 1, 0.5);
    pass.setSize(800, 600);
    expect(pass.renderTargetBright.width).toBe(200); // round(800 * 0.5 / 2)
    expect(pass.renderTargetBright.height).toBe(150);
  });

  it('defaults to full scale', () => {
    const pass = new ScaledBloomPass(resolution, 0.45, 0.25, 1);
    pass.setSize(800, 600);
    expect(pass.renderTargetBright.width).toBe(400);
  });

  it('setScale re-applies the last size', () => {
    const pass = new ScaledBloomPass(resolution, 0.45, 0.25, 1);
    pass.setSize(800, 600);
    pass.setScale(0.5);
    expect(pass.renderTargetBright.width).toBe(200);
    pass.setScale(1);
    expect(pass.renderTargetBright.width).toBe(400);
  });

  it('never collapses below one pixel', () => {
    const pass = new ScaledBloomPass(resolution, 0.45, 0.25, 1, 0.5);
    pass.setSize(1, 1);
    expect(pass.renderTargetBright.width).toBeGreaterThanOrEqual(1);
  });
});
