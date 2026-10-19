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
import {
  BOB_AMPLITUDE,
  BOB_RATE,
  LIFT,
  MEDAL_TIER_MAX,
  SPIN_RATE,
  createPickupInstances,
  medalRgb,
} from '../../src/render/pickup_instances.js';

const STRIDE = 4;
const W = 240;
const H = 320;
const KINDS = { RED: 0, BLUE: 1, PURPLE: 2, CRYSTAL: 3, BOMB: 4, MEDAL: 5 };

function build({ capacity = 6 } = {}) {
  const data = new Float32Array(STRIDE * capacity);
  const pickups = createPickupInstances({
    data,
    capacity,
    kinds: KINDS,
    playfieldW: W,
    playfieldH: H,
  });
  return { data, pickups };
}

function setPickup(data, i, x, y, colorIndex, kind = KINDS.CRYSTAL) {
  data.set([x, y, colorIndex, kind], i * STRIDE);
}

function matrixOf(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return m;
}

function colorOf(mesh, i) {
  const c = new THREE.Color();
  mesh.getColorAt(i, c);
  return [c.r, c.g, c.b];
}

describe('createPickupInstances', () => {
  it('builds one named InstancedMesh that draws nothing until it is told how many', () => {
    const { pickups } = build();
    expect(pickups.mesh.isInstancedMesh).toBe(true);
    expect(pickups.mesh.name).toBe('pickups');
    expect(pickups.mesh.frustumCulled).toBe(false);
    expect(pickups.mesh.count).toBe(0);
    // Instance colours exist from the start, so the shader variant never changes later.
    expect(pickups.mesh.instanceColor).not.toBeNull();
  });

  it('is a small smooth gem with a white vertex colour that the instance colour tints', () => {
    const { pickups } = build();
    const geometry = pickups.mesh.geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.max.y).toBeCloseTo(3.6, 5);
    expect(geometry.boundingBox.min.y).toBeCloseTo(-3.6, 5);
    expect(geometry.boundingBox.max.x).toBeLessThan(3);
    const colors = geometry.getAttribute('color');
    for (let i = 0; i < colors.count; i++) {
      expect([colors.getX(i), colors.getY(i), colors.getZ(i)]).toEqual([1, 1, 1]);
    }
    expect(pickups.mesh.material.vertexColors).toBe(true);
  });

  it('takes the palette colour of the packed colour index: 0 red, 1 blue, 2 purple', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    setPickup(data, 1, 100, 100, 1);
    setPickup(data, 2, 100, 100, 2);
    const before = pickups.mesh.instanceColor.version;
    pickups.update(3, 0);
    expect(pickups.mesh.instanceColor.version).toBeGreaterThan(before);
    expect(colorOf(pickups.mesh, 0)).toEqual(PALETTE.CRYSTAL_RED.rgb.map((v) => expect.closeTo(v, 5)));
    expect(colorOf(pickups.mesh, 1)).toEqual(PALETTE.CRYSTAL_BLUE.rgb.map((v) => expect.closeTo(v, 5)));
    expect(colorOf(pickups.mesh, 2)).toEqual(PALETTE.CRYSTAL_PURPLE.rgb.map((v) => expect.closeTo(v, 5)));
  });

  it('follows the colour index as Python advances the cycle', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    pickups.update(1, 0);
    const red = colorOf(pickups.mesh, 0);
    data[2] = 1;
    pickups.update(1, 0.016);
    expect(colorOf(pickups.mesh, 0)).not.toEqual(red);
    expect(colorOf(pickups.mesh, 0)[2]).toBeCloseTo(PALETTE.CRYSTAL_BLUE.rgb[2], 5);
  });

  it('draws the BOMB kind in the bomb pickup colour whatever the colour slot says', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, KINDS.BOMB, KINDS.BOMB);
    setPickup(data, 1, 100, 100, 0, KINDS.BOMB);
    pickups.update(2, 0);
    for (const i of [0, 1]) {
      expect(colorOf(pickups.mesh, i)).toEqual(PALETTE.BOMB_PICKUP.rgb.map((v) => expect.closeTo(v, 5)));
    }
  });

  it('draws a fixed-colour drop in the colour of its kind', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, KINDS.PURPLE, KINDS.PURPLE);
    pickups.update(1, 0);
    expect(colorOf(pickups.mesh, 0)[0]).toBeCloseTo(PALETTE.CRYSTAL_PURPLE.rgb[0], 5);
  });

  it('draws an out-of-range colour index red instead of nothing', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 9);
    pickups.update(1, 0);
    expect(colorOf(pickups.mesh, 0)[0]).toBeCloseTo(PALETTE.CRYSTAL_RED.rgb[0], 5);
    expect(pickups.mesh.count).toBe(1);
  });

  it('places each gem at (x - W/2, lift + bob, y - H/2)', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 120, 160, 0);
    setPickup(data, 1, 30, 300, 1);
    pickups.update(2, 0);
    expect(pickups.mesh.count).toBe(2);
    const a = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 0));
    const b = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 1));
    expect(a.x).toBe(0);
    expect(a.y).toBeCloseTo(LIFT, 5); // sin(0) = 0 at the first instance, time 0
    expect(a.z).toBe(0);
    expect(b.x).toBe(30 - 120);
    expect(b.z).toBe(300 - 160);
    expect(b.y).toBeGreaterThanOrEqual(LIFT - BOB_AMPLITUDE - 1e-6);
    expect(b.y).toBeLessThanOrEqual(LIFT + BOB_AMPLITUDE + 1e-6);
  });

  it('bobs around the lift height and never dips below the plane', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 120, 160, 0);
    let low = Infinity;
    let high = -Infinity;
    for (let t = 0; t < 2; t += 0.01) {
      pickups.update(1, t);
      const y = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 0)).y;
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    expect(low).toBeGreaterThan(0);
    expect(low).toBeCloseTo(LIFT - BOB_AMPLITUDE, 1);
    expect(high).toBeCloseTo(LIFT + BOB_AMPLITUDE, 1);
  });

  it('spins about the vertical axis with time', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 120, 160, 0);
    const angleAt = (t) => {
      pickups.update(1, t);
      const q = new THREE.Quaternion();
      matrixOf(pickups.mesh, 0).decompose(new THREE.Vector3(), q, new THREE.Vector3());
      expect(q.x).toBeCloseTo(0, 5);
      expect(q.z).toBeCloseTo(0, 5);
      return 2 * Math.atan2(q.y, q.w);
    };
    expect(angleAt(0)).toBeCloseTo(0, 5);
    expect(angleAt(0.25)).toBeCloseTo(0.25 * SPIN_RATE, 5);
    expect(BOB_RATE).toBeGreaterThan(0);
  });

  it('keeps neighbouring gems out of step with each other', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    setPickup(data, 1, 100, 100, 0);
    pickups.update(2, 0.3);
    const a = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 0));
    const b = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 1));
    expect(a.y).not.toBeCloseTo(b.y, 3);
  });

  it('clamps the count to the capacity', () => {
    const { data, pickups } = build({ capacity: 3 });
    for (let i = 0; i < 3; i++) setPickup(data, i, 10 * i, 10 * i, i);
    pickups.update(99, 0);
    expect(pickups.mesh.count).toBe(3);
  });

  it('with no pickups it draws nothing and leaves the buffers alone', () => {
    const { pickups } = build();
    const before = pickups.mesh.instanceMatrix.version;
    pickups.update(0, 1);
    expect(pickups.mesh.count).toBe(0);
    expect(pickups.mesh.instanceMatrix.version).toBe(before);
  });

  it('keeps its buffers across updates (nothing is reallocated per frame)', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    const matrices = pickups.mesh.instanceMatrix.array;
    const colors = pickups.mesh.instanceColor.array;
    for (let t = 0; t < 10; t++) pickups.update(1, t / 60);
    expect(pickups.mesh.instanceMatrix.array).toBe(matrices);
    expect(pickups.mesh.instanceColor.array).toBe(colors);
  });

  it('draws a medal in its own chip mesh, in the medal palette colour, and gems as before', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    setPickup(data, 1, 60, 80, 0, KINDS.MEDAL);
    setPickup(data, 2, 140, 120, 1);
    pickups.update(3, 0);
    expect(pickups.mesh.count).toBe(2);
    expect(pickups.medalMesh.count).toBe(1);
    expect(colorOf(pickups.medalMesh, 0)).toEqual(PALETTE.MEDAL.rgb.map((v) => expect.closeTo(v, 5)));
    expect(colorOf(pickups.mesh, 0)).toEqual(PALETTE.CRYSTAL_RED.rgb.map((v) => expect.closeTo(v, 5)));
    expect(colorOf(pickups.mesh, 1)).toEqual(PALETTE.CRYSTAL_BLUE.rgb.map((v) => expect.closeTo(v, 5)));
    const medal = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.medalMesh, 0));
    expect(medal.x).toBe(60 - 120);
    expect(medal.z).toBe(80 - 160);
    const second = new THREE.Vector3().setFromMatrixPosition(matrixOf(pickups.mesh, 1));
    expect(second.x).toBe(140 - 120);
  });

  it('builds the chip as a named, flat hexagon standing on its edge with instance colours', () => {
    const { pickups } = build();
    expect(pickups.medalMesh.isInstancedMesh).toBe(true);
    expect(pickups.medalMesh.name).toBe('medals');
    expect(pickups.medalMesh.frustumCulled).toBe(false);
    expect(pickups.medalMesh.count).toBe(0);
    expect(pickups.medalMesh.instanceColor).not.toBeNull();
    expect(pickups.medalMesh.material.vertexColors).toBe(true);
    const geometry = pickups.medalMesh.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // Standing on its edge: about 7.6 across in x and y, 1.4 thick in z.
    expect(box.max.z - box.min.z).toBeCloseTo(1.4, 5);
    expect(box.max.x - box.min.x).toBeGreaterThan(6.5);
    expect(box.max.y - box.min.y).toBeGreaterThan(6.5);
    expect(box.max.y).toBeLessThan(4);
  });

  it('with only gems the medal mesh stays empty and untouched', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0);
    const before = pickups.medalMesh.instanceMatrix.version;
    pickups.update(1, 0);
    expect(pickups.medalMesh.count).toBe(0);
    expect(pickups.medalMesh.instanceMatrix.version).toBe(before);
  });

  it('with only medals the gem mesh stays empty and untouched', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 100, 100, 0, KINDS.MEDAL);
    const before = pickups.mesh.instanceMatrix.version;
    pickups.update(1, 0);
    expect(pickups.mesh.count).toBe(0);
    expect(pickups.mesh.instanceMatrix.version).toBe(before);
  });
});

describe('medal tier colours', () => {
  const rgbOf = (tier) => medalRgb(tier, [0, 0, 0]);
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it('starts at the medal palette colour and ends at the palette white', () => {
    expect(MEDAL_TIER_MAX).toBe(6);
    expect(rgbOf(0)).toEqual(PALETTE.MEDAL.rgb);
    expect(rgbOf(MEDAL_TIER_MAX)).toEqual(PALETTE.MEDAL_WHITE.rgb);
    const white = rgbOf(MEDAL_TIER_MAX);
    expect(saturationOf(white)).toBe(0);
  });

  it('brightens with every tier', () => {
    for (let tier = 1; tier <= MEDAL_TIER_MAX; tier++) {
      expect(luma(rgbOf(tier))).toBeGreaterThan(luma(rgbOf(tier - 1)));
    }
  });

  it('never leaves the allowed band: no tier is near the reserved enemy bullet hue', () => {
    const halo = PALETTE.ENEMY_BULLET_HALO.rgb;
    for (let tier = 0; tier <= MEDAL_TIER_MAX; tier++) {
      const rgb = rgbOf(tier);
      const offender =
        saturationOf(rgb) >= BULLET_MIN_SATURATION &&
        hueDistance(hueOf(rgb), hueOf(halo)) < BULLET_EXCLUSION_DEGREES;
      expect(offender, `tier ${tier}`).toBe(false);
      // Never gold: the red channel never leads the blue one.
      expect(rgb[0]).toBeLessThanOrEqual(rgb[2] + 1e-9);
    }
  });

  it('clamps an out-of-range or non-numeric tier to the nearest valid one', () => {
    expect(rgbOf(-3)).toEqual(rgbOf(0));
    expect(rgbOf(99)).toEqual(rgbOf(MEDAL_TIER_MAX));
    expect(rgbOf(Number.NaN)).toEqual(rgbOf(0));
  });

  it('draws each chip in the colour of the tier Python packed for it', () => {
    const { data, pickups } = build();
    setPickup(data, 0, 60, 80, 0, KINDS.MEDAL);
    setPickup(data, 1, 100, 80, 3, KINDS.MEDAL);
    setPickup(data, 2, 140, 80, 6, KINDS.MEDAL);
    pickups.update(3, 0);
    for (const [i, tier] of [[0, 0], [1, 3], [2, 6]]) {
      expect(colorOf(pickups.medalMesh, i)).toEqual(rgbOf(tier).map((v) => expect.closeTo(v, 5)));
    }
  });
});
