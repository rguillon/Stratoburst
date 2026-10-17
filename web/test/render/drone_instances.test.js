import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDroneInstances } from '../../src/render/drone_instances.js';

const STRIDE = 8;

function build(capacity = 8) {
  const data = new Float32Array(STRIDE * capacity);
  const drones = createDroneInstances({ data, capacity, playfieldW: 240, playfieldH: 320 });
  return { data, drones, mesh: drones.mesh };
}

function setDrone(data, i, { x, y, flash = 0 }) {
  data.set([x, y, 0, flash, 1, 1, 0, 0], i * STRIDE);
}

function positionOf(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

function colourOf(mesh, i) {
  const c = new THREE.Color();
  mesh.getColorAt(i, c);
  return [c.r, c.g, c.b];
}

describe('createDroneInstances', () => {
  it('is one InstancedMesh named drones with a plain 14 x 6 x 14 block', () => {
    const { mesh } = build();
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.name).toBe('drones');
    expect(mesh.geometry.parameters).toMatchObject({ width: 14, height: 6, depth: 14 });
    expect(mesh.material.isMeshStandardMaterial).toBe(true);
    expect(mesh.material.color.getHex()).toBe(0xffffff);
    expect(mesh.material.roughness).toBeCloseTo(0.7);
  });

  it('never frustum-culls (instances are placed by matrix, the base mesh sits at the origin)', () => {
    expect(build().mesh.frustumCulled).toBe(false);
  });

  it('draws nothing until told how many drones are live', () => {
    expect(build().mesh.count).toBe(0);
  });

  it('maps playfield (x, y) to world (x - W/2, 0, y - H/2)', () => {
    const { data, drones, mesh } = build();
    setDrone(data, 0, { x: 100, y: 50 });
    setDrone(data, 1, { x: 0, y: 320 });
    drones.update(2);
    expect(mesh.count).toBe(2);
    expect(positionOf(mesh, 0).toArray()).toEqual([-20, 0, -110]);
    expect(positionOf(mesh, 1).toArray()).toEqual([-120, 0, 160]);
  });

  it('colours a resting drone olive grey and a flashing one HDR white', () => {
    const { data, drones, mesh } = build();
    setDrone(data, 0, { x: 10, y: 10, flash: 0 });
    setDrone(data, 1, { x: 20, y: 20, flash: 1 });
    setDrone(data, 2, { x: 30, y: 30, flash: 0.17 });
    drones.update(3);
    const [r, g, b] = colourOf(mesh, 0);
    expect([r, g, b].map((v) => Math.round(v * 100) / 100)).toEqual([0.42, 0.45, 0.4]);
    expect(colourOf(mesh, 1)).toEqual([2, 2, 2]);
    expect(colourOf(mesh, 2)).toEqual([2, 2, 2]);
  });

  it('a drone that stops flashing goes back to the base colour', () => {
    const { data, drones, mesh } = build();
    setDrone(data, 0, { x: 10, y: 10, flash: 1 });
    drones.update(1);
    setDrone(data, 0, { x: 10, y: 10, flash: 0 });
    drones.update(1);
    expect(colourOf(mesh, 0)[0]).toBeLessThan(1);
  });

  it('clamps the count to the capacity and accepts zero', () => {
    const { drones, mesh } = build(4);
    drones.update(99);
    expect(mesh.count).toBe(4);
    drones.update(0);
    expect(mesh.count).toBe(0);
  });

  it('flags both instance buffers for upload on every update', () => {
    const { drones, mesh } = build();
    const matrixVersion = mesh.instanceMatrix.version;
    const colourVersion = mesh.instanceColor.version;
    drones.update(1);
    expect(mesh.instanceMatrix.version).toBeGreaterThan(matrixVersion);
    expect(mesh.instanceColor.version).toBeGreaterThan(colourVersion);
  });
});
