import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_FOV_DEG, applyCameraFit, fitCamera } from '../../src/render/camera_fit.js';
import { pixelDeltaToPlayfield } from '../../src/input/touch_mapper.js';

const W = 390;
const H = 844;

function phoneCamera() {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, W / H, 10, 4000);
  applyCameraFit(camera, fitCamera({ aspect: W / H }));
  camera.updateMatrixWorld(true);
  return camera;
}

function toPixels(camera, world) {
  const v = world.clone().project(camera);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}

const camera = phoneCamera();
const ship = new THREE.Vector3(0, 0, 112); // the start position (120, 272) in world space

const args = (dxPx, dyPx, shipWorld = ship) => ({
  camera,
  viewportW: W,
  viewportH: H,
  shipWorld,
  dxPx,
  dyPx,
});

describe('pixelDeltaToPlayfield', () => {
  it.each([
    [40, 0],
    [0, -60],
    [25, 25],
  ])('is exactly 1:1 on screen for a (%i, %i) px finger move (within 0.5 px)', (dxPx, dyPx) => {
    const { dx, dy } = pixelDeltaToPlayfield(args(dxPx, dyPx));
    const before = toPixels(camera, ship);
    const after = toPixels(camera, new THREE.Vector3(ship.x + dx, 0, ship.z + dy));
    expect(after.x - before.x).toBeCloseTo(dxPx, 0);
    expect(after.y - before.y).toBeCloseTo(dyPx, 0);
    expect(Math.abs(after.x - (before.x + dxPx))).toBeLessThan(0.5);
    expect(Math.abs(after.y - (before.y + dyPx))).toBeLessThan(0.5);
  });

  it('returns zeros for a zero delta', () => {
    expect(pixelDeltaToPlayfield(args(0, 0))).toEqual({ dx: 0, dy: 0 });
  });

  it.each([
    [Number.NaN, 5],
    [5, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [0, Number.NEGATIVE_INFINITY],
  ])('returns zeros for a non-finite finger delta (%s, %s)', (dxPx, dyPx) => {
    expect(pixelDeltaToPlayfield(args(dxPx, dyPx))).toEqual({ dx: 0, dy: 0 });
  });

  it('returns zeros for a non-finite ship position', () => {
    expect(pixelDeltaToPlayfield(args(10, 10, new THREE.Vector3(Number.NaN, 0, 0)))).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it('returns zeros when the ray misses the gameplay plane (a finger past the horizon)', () => {
    expect(pixelDeltaToPlayfield(args(0, -1e6))).toEqual({ dx: 0, dy: 0 });
  });

  it('maps a rightward finger to +x and an upward finger to -y (up the playfield)', () => {
    expect(pixelDeltaToPlayfield(args(30, 0)).dx).toBeGreaterThan(0);
    expect(pixelDeltaToPlayfield(args(0, -30)).dy).toBeLessThan(0);
    expect(pixelDeltaToPlayfield(args(0, 30)).dy).toBeGreaterThan(0);
  });

  it('does not skew a horizontal finger move into vertical ship movement', () => {
    expect(Math.abs(pixelDeltaToPlayfield(args(30, 0)).dy)).toBeLessThan(0.01);
  });

  it('covers more playfield units per pixel far up the screen than near the bottom (perspective)', () => {
    const far = pixelDeltaToPlayfield(args(40, 0, new THREE.Vector3(0, 0, -140))).dx;
    const near = pixelDeltaToPlayfield(args(40, 0, new THREE.Vector3(0, 0, 140))).dx;
    expect(far).toBeGreaterThan(near);
  });

  it('leaves the camera untouched', () => {
    const before = camera.matrixWorld.clone();
    pixelDeltaToPlayfield(args(10, 10));
    expect(camera.matrixWorld.equals(before)).toBe(true);
  });
});
