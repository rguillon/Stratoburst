import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FOG_DENSITY, NIGHT_SKY, createNightRig } from '../../src/render/night_rig.js';
import { createPlayfieldMask } from '../../src/render/playfield_mask.js';
import { hueDistance, hueOf, saturationOf } from '../../src/fx/palette.js';

// The orange-yellow enemy-bullet hue (D-39): no saturated night colour may sit within 35 degrees.
const ENEMY_BULLET_HUE = 39;
const MIN_SATURATION = 0.25;
const MIN_DISTANCE = 35;

function expectClearOfBulletHue(hex, label) {
  const rgb = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  if (saturationOf(rgb) < MIN_SATURATION) return;
  expect(hueDistance(hueOf(rgb), ENEMY_BULLET_HUE), label).toBeGreaterThanOrEqual(MIN_DISTANCE);
}

describe('createNightRig', () => {
  const scene = new THREE.Scene();
  const rig = createNightRig(scene);

  it('adds exactly three lights: one hemisphere and two directional', () => {
    const lights = scene.children.filter((child) => child.isLight);
    expect(lights).toHaveLength(3);
    expect(lights.filter((light) => light.isHemisphereLight)).toHaveLength(1);
    expect(lights.filter((light) => light.isDirectionalLight)).toHaveLength(2);
    expect(scene.children).toHaveLength(3);
  });

  it('returns the hemisphere, moon, fill and fog it created', () => {
    expect(rig.hemi.isHemisphereLight).toBe(true);
    expect(rig.moon.isDirectionalLight).toBe(true);
    expect(rig.fill.isDirectionalLight).toBe(true);
    expect(rig.moon).not.toBe(rig.fill);
    expect(rig.fog).toBe(scene.fog);
  });

  it('uses one dark blue-violet NIGHT_SKY for the background and the fog', () => {
    expect(NIGHT_SKY).toBe(0x07061a);
    expect(scene.background.getHex()).toBe(NIGHT_SKY);
    expect(scene.fog.isFogExp2).toBe(true);
    expect(scene.fog.color.getHex()).toBe(NIGHT_SKY);
    expect(scene.fog.density).toBe(FOG_DENSITY);
  });

  it('keeps the fog light at the fitted camera distance (0.08 to 0.25 at 650 units)', () => {
    const factor = 1 - Math.exp(-((FOG_DENSITY * 650) ** 2));
    expect(factor).toBeGreaterThan(0.08);
    expect(factor).toBeLessThan(0.25);
  });

  it('puts the moon at the default sun position so air shadows do not move', () => {
    expect(rig.moon.position.toArray()).toEqual([-120, 300, 160]);
  });

  it('puts the moon at a passed sun position', () => {
    const custom = createNightRig(new THREE.Scene(), { sunPosition: [10, 200, 30] });
    expect(custom.moon.position.toArray()).toEqual([10, 200, 30]);
  });

  it('lights the fill from the opposite side of the moon', () => {
    expect(Math.sign(rig.fill.position.x)).toBe(-Math.sign(rig.moon.position.x));
    expect(Math.sign(rig.fill.position.z)).toBe(-Math.sign(rig.moon.position.z));
  });

  it('has no warm tint: every light and the sky stay clear of the bullet hue', () => {
    expectClearOfBulletHue(NIGHT_SKY, 'sky');
    expectClearOfBulletHue(rig.hemi.color.getHex(), 'hemisphere sky');
    expectClearOfBulletHue(rig.hemi.groundColor.getHex(), 'hemisphere ground');
    expectClearOfBulletHue(rig.moon.color.getHex(), 'moon');
    expectClearOfBulletHue(rig.fill.color.getHex(), 'fill');
  });
});

describe('the playfield mask colours', () => {
  const group = createPlayfieldMask();
  const dim = group.getObjectByName('playfield-dim');
  const outline = group.getObjectByName('playfield-outline');

  it('dims with the night sky colour', () => {
    expect(dim.material.color.getHex()).toBe(NIGHT_SKY);
  });

  it('keeps the outline below 1.0 in every channel so it never blooms', () => {
    for (const channel of outline.material.color.toArray()) expect(channel).toBeLessThan(1);
  });

  it('keeps the dim and outline colours clear of the bullet hue', () => {
    expectClearOfBulletHue(dim.material.color.getHex(), 'mask dim');
    expectClearOfBulletHue(outline.material.color.getHex(), 'mask outline');
  });
});
