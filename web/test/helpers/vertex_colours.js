import { expect } from 'vitest';
import {
  BULLET_EXCLUSION_DEGREES,
  BULLET_MIN_SATURATION,
  PALETTE,
  hueDistance,
  hueOf,
  saturationOf,
} from '../../src/fx/palette.js';

// Helpers shared by the model tests: read a geometry's vertex colours and check the faction
// colour rules (D-38) against them.

export function colours(geometry) {
  const color = geometry.getAttribute('color');
  return Array.from({ length: color.count }, (_, i) => [color.getX(i), color.getY(i), color.getZ(i)]);
}

export function hasColour(geometry, rgb, tolerance = 1e-4) {
  return colours(geometry).some((c) => c.every((v, k) => Math.abs(v - rgb[k]) < tolerance));
}

// Dark gunmetal: no channel above 0.3 and a low saturation, so it reads as steel and never blooms.
export function expectGunmetal(geometry, label) {
  for (const rgb of colours(geometry)) {
    expect(Math.max(...rgb), `${label} ${rgb}`).toBeLessThanOrEqual(0.3);
    expect(saturationOf(rgb), `${label} ${rgb}`).toBeLessThan(0.3);
  }
}

// A glow geometry carries red neon: a vertex colour equal to NEON_RED or the engine red.
export function expectRedNeon(geometry, label) {
  const red = hasColour(geometry, PALETTE.NEON_RED.rgb) || hasColour(geometry, PALETTE.ENGINE.rgb);
  expect(red, `${label} has no red neon`).toBe(true);
}

// No vertex colour may be a saturated orange-yellow (the enemy-bullet band, D-39).
export function expectNoBulletHue(geometry, label) {
  const bullet = hueOf(PALETTE.ENEMY_BULLET_HALO.rgb);
  for (const rgb of colours(geometry)) {
    if (saturationOf(rgb) < BULLET_MIN_SATURATION) continue;
    expect(hueDistance(hueOf(rgb), bullet), `${label} ${rgb}`).toBeGreaterThanOrEqual(
      BULLET_EXCLUSION_DEGREES,
    );
  }
}
