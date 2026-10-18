import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/fx/palette.js';
import { TRAIL_CADENCE_S, createMissileInstances } from '../../src/render/missile_instances.js';

const STRIDE = 4;
const W = 240;
const H = 320;

function build({ capacity = 6, scale = 1 } = {}) {
  const data = new Float32Array(STRIDE * capacity);
  const emitted = [];
  const state = { scale };
  const missiles = createMissileInstances({
    data,
    capacity,
    layers: { additive: { emit: (...args) => emitted.push(args) } },
    getScale: () => state.scale,
    playfieldW: W,
    playfieldH: H,
  });
  return { data, emitted, missiles, state };
}

function setMissile(data, i, x, y, angle = 0, life = 0) {
  data.set([x, y, angle, life], i * STRIDE);
}

function matrixOf(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return m;
}

describe('createMissileInstances', () => {
  it('builds one named InstancedMesh that draws nothing until it is told how many', () => {
    const { missiles } = build();
    expect(missiles.mesh.isInstancedMesh).toBe(true);
    expect(missiles.mesh.name).toBe('missiles');
    expect(missiles.mesh.frustumCulled).toBe(false);
    expect(missiles.mesh.count).toBe(0);
  });

  it('is violet: HDR vertex colours of the missile palette entry, nowhere near pink', () => {
    const { missiles } = build();
    const colors = missiles.mesh.geometry.getAttribute('color');
    expect(colors.count).toBeGreaterThan(0);
    const [r, g, b] = PALETTE.MISSILE.rgb;
    for (let i = 0; i < colors.count; i++) {
      expect([colors.getX(i), colors.getY(i), colors.getZ(i)]).toEqual([
        expect.closeTo(r, 5),
        expect.closeTo(g, 5),
        expect.closeTo(b, 5),
      ]);
    }
    expect(missiles.mesh.material.vertexColors).toBe(true);
  });

  it('models the nose pointing up the screen (negative Z) and is a small shape', () => {
    const { missiles } = build();
    const geometry = missiles.mesh.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box.min.z).toBeCloseTo(-3.5, 5);
    expect(box.max.z).toBeCloseTo(3.5, 5);
    expect(box.max.x).toBeLessThan(2);
  });

  it('places each missile at (x - W/2, 0, y - H/2) and sets the count', () => {
    const { data, missiles } = build();
    setMissile(data, 0, 120, 160);
    setMissile(data, 1, 30, 300);
    missiles.update(2, 0);
    expect(missiles.mesh.count).toBe(2);
    const a = new THREE.Vector3().setFromMatrixPosition(matrixOf(missiles.mesh, 0));
    const b = new THREE.Vector3().setFromMatrixPosition(matrixOf(missiles.mesh, 1));
    expect([a.x, a.y, a.z]).toEqual([0, 0, 0]);
    expect([b.x, b.y, b.z]).toEqual([30 - 120, 0, 300 - 160]);
  });

  it('points the nose along the flight angle (0 = up the screen, positive = to the right)', () => {
    const { data, missiles } = build();
    const angles = [0, Math.PI / 2, -Math.PI / 4, Math.PI];
    angles.forEach((angle, i) => setMissile(data, i, 100, 100, angle));
    missiles.update(angles.length, 0);
    angles.forEach((angle, i) => {
      const heading = new THREE.Vector3(0, 0, -1).transformDirection(matrixOf(missiles.mesh, i));
      expect(heading.x).toBeCloseTo(Math.sin(angle), 5);
      expect(heading.z).toBeCloseTo(-Math.cos(angle), 5);
    });
  });

  it('clamps the count to the capacity', () => {
    const { data, missiles } = build({ capacity: 3 });
    for (let i = 0; i < 3; i++) setMissile(data, i, 10 * i, 10 * i);
    missiles.update(99, 0);
    expect(missiles.mesh.count).toBe(3);
  });

  it('with no missiles it draws nothing and emits no trail', () => {
    const { emitted, missiles } = build();
    missiles.update(0, 0);
    missiles.update(0, 1);
    expect(missiles.mesh.count).toBe(0);
    expect(emitted).toEqual([]);
  });
});

describe('the exhaust trail', () => {
  it('puffs once per live missile at its tail, in the trail colour, and not again within 50 ms', () => {
    const { data, emitted, missiles } = build();
    setMissile(data, 0, 120, 160, 0);
    setMissile(data, 1, 60, 100, 0);
    missiles.update(2, 1);
    expect(emitted).toHaveLength(2);
    missiles.update(2, 1 + TRAIL_CADENCE_S / 2);
    expect(emitted).toHaveLength(2);
    missiles.update(2, 1 + TRAIL_CADENCE_S + 0.001);
    expect(emitted).toHaveLength(4);

    const [x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity] = emitted[0];
    // Heading up the screen, so the tail is below the missile centre (larger z) and the puff drifts back.
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBe(0);
    expect(z).toBeGreaterThan(0);
    expect(vx).toBeCloseTo(0, 5);
    expect(vy).toBe(0);
    expect(vz).toBeGreaterThan(0);
    expect(life).toBeGreaterThan(0);
    expect(size0).toBeGreaterThan(size1);
    expect([r, g, b]).toEqual(PALETTE.MISSILE_TRAIL.rgb);
    expect(gravity).toBe(0);
  });

  it('puffs behind a missile that flies sideways', () => {
    const { data, emitted, missiles } = build();
    setMissile(data, 0, 120, 160, Math.PI / 2); // flying right
    missiles.update(1, 0);
    const [x, , z, vx, , vz] = emitted[0];
    expect(x).toBeLessThan(0);
    expect(z).toBeCloseTo(0, 5);
    expect(vx).toBeLessThan(0);
    expect(vz).toBeCloseTo(0, 5);
  });

  it('puffs round(count * scale) missiles per cadence tick at lower tiers, never zero for a live one', () => {
    const { data, emitted, missiles, state } = build({ capacity: 6, scale: 0.35 });
    for (let i = 0; i < 6; i++) setMissile(data, i, 20 * i, 50);
    missiles.update(6, 0);
    expect(emitted).toHaveLength(2); // round(6 * 0.35)

    emitted.length = 0;
    state.scale = 0.35;
    setMissile(data, 0, 100, 100);
    missiles.update(1, 1);
    expect(emitted).toHaveLength(1); // round(0.35) is 0, floored to 1
  });

  it('rotates which missiles are puffed so a capped count serves all of them over time', () => {
    const { data, emitted, missiles } = build({ capacity: 4, scale: 0.5 });
    for (let i = 0; i < 4; i++) setMissile(data, i, 40 * i, 80);
    const seen = new Set();
    for (let tick = 0; tick < 4; tick++) {
      emitted.length = 0;
      missiles.update(4, tick);
      for (const args of emitted) seen.add(args[0]);
    }
    expect(seen.size).toBe(4);
  });

  it('keeps the rotation valid when the missile count shrinks', () => {
    const { data, emitted, missiles } = build({ capacity: 5, scale: 1 });
    for (let i = 0; i < 5; i++) setMissile(data, i, 20 * i, 80);
    missiles.update(5, 0);
    emitted.length = 0;
    missiles.update(2, 1);
    expect(emitted).toHaveLength(2);
    for (const args of emitted) expect(Number.isFinite(args[0])).toBe(true);
  });
});
