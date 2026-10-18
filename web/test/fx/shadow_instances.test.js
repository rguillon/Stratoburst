import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/fx/palette.js';
import { createShadowInstances } from '../../src/fx/shadow_instances.js';
import { TERRAIN_DEPTH } from '../../src/render/ground_layer.js';

const STRIDE = 8;
const KINDS = { JET: 0, HELI: 1, CARRIER: 2, TANK: 3, TURRET: 4 };
const GROUND = new Set([3, 4]);
const RADII = [9, 10, 14, 11, 10];
const SUN = new THREE.Vector3(-120, 300, 160);
const W = 240;
const H = 320;

function build(capacity = 6, extra = {}) {
  const data = new Float32Array(STRIDE * capacity);
  const shadows = createShadowInstances({
    data,
    capacity,
    kinds: KINDS,
    groundKinds: GROUND,
    radii: RADII,
    sunPosition: SUN,
    playfieldW: W,
    playfieldH: H,
    ...extra,
  });
  return { data, shadows };
}

function setEnemy(data, i, x, y, kind) {
  data.set([x, y, 0, 0, 1, kind, 0, 0], i * STRIDE);
}

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

function shadowAt(mesh, i) {
  mesh.getMatrixAt(i, matrix);
  matrix.decompose(position, quaternion, scale);
  return { position: position.clone(), scale: scale.clone() };
}

describe('createShadowInstances', () => {
  it('is one flat, soft, dark InstancedMesh with room for every enemy plus the ship', () => {
    const { shadows } = build(6);
    const { mesh } = shadows;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.name).toBe('air-shadows');
    expect(mesh.instanceMatrix.count).toBe(7);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.count).toBe(0);
    // Above the scorch marks (2), below the dim mask (5).
    expect(mesh.renderOrder).toBe(3);
    const { material } = mesh;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.uniforms.uColor.value.toArray()).toEqual(PALETTE.SHADOW.rgb);
    expect(material.uniforms.uAlpha.value).toBe(0.45);
    // The quad lies flat: every vertex is at height zero (to rounding).
    const heights = Array.from(mesh.geometry.getAttribute('position').array).filter((_, k) => k % 3 === 1);
    expect(Math.max(...heights.map(Math.abs))).toBeLessThan(1e-6);
  });

  it('draws one shadow per air enemy plus the ship, displaced along the sun direction by 40 units', () => {
    const { data, shadows } = build();
    setEnemy(data, 0, 60, 100, 0);
    setEnemy(data, 1, 180, 40, 2);
    shadows.update(2, 120, 280, true);
    const { mesh } = shadows;
    expect(mesh.count).toBe(3);
    const offsetX = (120 / 300) * 40; // 16
    const offsetZ = (-160 / 300) * 40; // -21.33
    const jet = shadowAt(mesh, 0);
    expect(jet.position.x).toBeCloseTo(60 - 120 + offsetX, 4);
    expect(jet.position.y).toBeCloseTo(TERRAIN_DEPTH + 0.3, 4);
    expect(jet.position.z).toBeCloseTo(100 - 160 + offsetZ, 4);
    const carrier = shadowAt(mesh, 1);
    expect(carrier.position.x).toBeCloseTo(180 - 120 + offsetX, 4);
    expect(carrier.position.z).toBeCloseTo(40 - 160 + offsetZ, 4);
    const ship = shadowAt(mesh, 2);
    expect(ship.position.x).toBeCloseTo(120 - 120 + offsetX, 4);
    expect(ship.position.z).toBeCloseTo(280 - 160 + offsetZ, 4);
    expect(offsetX).toBeCloseTo(16, 4);
    expect(offsetZ).toBeCloseTo(-21.3, 1);
  });

  it('scales each shadow to 1.5 times the unit radius, and the ship uses radius 9', () => {
    const { data, shadows } = build();
    setEnemy(data, 0, 60, 100, 0); // JET radius 9
    setEnemy(data, 1, 100, 100, 2); // CARRIER radius 14
    shadows.update(2, 120, 280, true);
    expect(shadowAt(shadows.mesh, 0).scale.x).toBeCloseTo(13.5, 4);
    expect(shadowAt(shadows.mesh, 0).scale.z).toBeCloseTo(13.5, 4);
    expect(shadowAt(shadows.mesh, 1).scale.x).toBeCloseTo(21, 4);
    expect(shadowAt(shadows.mesh, 2).scale.x).toBeCloseTo(13.5, 4);
  });

  it('skips ground kinds and kinds it does not know', () => {
    const { data, shadows } = build();
    setEnemy(data, 0, 60, 100, 3); // TANK
    setEnemy(data, 1, 90, 100, 1); // HELI
    setEnemy(data, 2, 120, 100, 4); // TURRET
    setEnemy(data, 3, 150, 100, 9); // no such kind
    shadows.update(4, 120, 280, true);
    expect(shadows.mesh.count).toBe(2); // the helicopter and the ship
    expect(shadowAt(shadows.mesh, 0).position.x).toBeCloseTo(90 - 120 + 16, 4);
  });

  it('omits the ship shadow when the ship is hidden', () => {
    const { data, shadows } = build();
    setEnemy(data, 0, 60, 100, 0);
    shadows.update(1, 120, 280, false);
    expect(shadows.mesh.count).toBe(1);
    shadows.update(0, 120, 280, false);
    expect(shadows.mesh.count).toBe(0);
    shadows.update(0, 120, 280, true);
    expect(shadows.mesh.count).toBe(1);
  });

  it('never draws more than the capacity plus the ship, whatever count it is told', () => {
    const { data, shadows } = build(2);
    setEnemy(data, 0, 60, 100, 0);
    setEnemy(data, 1, 90, 100, 0);
    shadows.update(500, 120, 280, true);
    expect(shadows.mesh.count).toBe(3);
  });

  it('follows the sun: a sun straight overhead puts the shadow right under the unit', () => {
    const { data, shadows } = build(6, { sunPosition: new THREE.Vector3(0, 100, 0), altitude: 25 });
    setEnemy(data, 0, 60, 100, 0);
    shadows.update(1, 120, 280, false);
    const jet = shadowAt(shadows.mesh, 0);
    expect(jet.position.x).toBeCloseTo(60 - 120, 4);
    expect(jet.position.z).toBeCloseTo(100 - 160, 4);
  });

  it('honours a custom terrain depth and uploads only when something was written', () => {
    const { data, shadows } = build(6, { terrainDepth: -10 });
    const { mesh } = shadows;
    setEnemy(data, 0, 60, 100, 0);
    const before = mesh.instanceMatrix.version;
    shadows.update(0, 120, 280, false);
    expect(mesh.instanceMatrix.version).toBe(before);
    shadows.update(1, 120, 280, false);
    expect(mesh.instanceMatrix.version).toBe(before + 1);
    expect(shadowAt(mesh, 0).position.y).toBeCloseTo(-10 + 0.3, 4);
  });

  it('allocates nothing per update: the same matrix buffer is rewritten', () => {
    const { data, shadows } = build();
    const { mesh } = shadows;
    const buffer = mesh.instanceMatrix.array;
    setEnemy(data, 0, 60, 100, 0);
    for (let i = 0; i < 20; i += 1) shadows.update(1, 100 + i, 280, true);
    expect(mesh.instanceMatrix.array).toBe(buffer);
    expect(mesh.count).toBe(2);
  });
});
