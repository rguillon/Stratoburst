import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { basicEnemyGeometry, createEnemyInstances } from '../../src/render/enemy_instances.js';

const STRIDE = 8;
const KINDS = { JET: 0, HELI: 1, CARRIER: 2, TANK: 3, TURRET: 4 };

function build(capacity = 8, extra = {}) {
  const data = new Float32Array(STRIDE * capacity);
  const enemies = createEnemyInstances({
    data,
    capacity,
    kinds: KINDS,
    playfieldW: 240,
    playfieldH: 320,
    ...extra,
  });
  const byName = Object.fromEntries(enemies.meshes.map((mesh) => [mesh.name, mesh]));
  return { data, enemies, byName };
}

function setEnemy(data, i, { x, y, angle = 0, flash = 0, kind = 0 }) {
  data.set([x, y, angle, flash, 1, kind, 0, 0], i * STRIDE);
}

function positionOf(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

function headingOf(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  // The mesh points +Z; its image under the instance matrix is the drawn heading.
  return new THREE.Vector3(0, 0, 1).transformDirection(m);
}

describe('createEnemyInstances', () => {
  it('builds one InstancedMesh per manifest kind with the gallery names', () => {
    const { enemies } = build();
    expect(enemies.meshes.map((mesh) => mesh.name)).toEqual([
      'enemy-jet',
      'enemy-heli',
      'enemy-carrier',
      'enemy-tank',
      'enemy-turret',
    ]);
    for (const mesh of enemies.meshes) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.count).toBe(0);
    }
  });

  it('shares one MeshStandardMaterial with roughness 0.6 and metalness 0.2', () => {
    const { enemies } = build();
    const [first] = enemies.meshes;
    expect(first.material.isMeshStandardMaterial).toBe(true);
    expect(first.material.roughness).toBeCloseTo(0.6);
    expect(first.material.metalness).toBeCloseTo(0.2);
    expect(enemies.meshes.every((mesh) => mesh.material === first.material)).toBe(true);
  });

  it('draws nothing until told how many enemies are live', () => {
    const { enemies } = build();
    enemies.update(0);
    expect(enemies.meshes.map((mesh) => mesh.count)).toEqual([0, 0, 0, 0, 0]);
  });

  it('routes each instance to its kind mesh and counts per kind', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 100, y: 50, kind: KINDS.TANK });
    setEnemy(data, 1, { x: 0, y: 320, kind: KINDS.JET });
    setEnemy(data, 2, { x: 240, y: 0, kind: KINDS.TANK });
    enemies.update(3);
    expect(byName['enemy-tank'].count).toBe(2);
    expect(byName['enemy-jet'].count).toBe(1);
    expect(byName['enemy-heli'].count).toBe(0);
    expect(byName['enemy-carrier'].count).toBe(0);
    expect(byName['enemy-turret'].count).toBe(0);
  });

  it('maps playfield (x, y) to world (x - W/2, 0, y - H/2)', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 100, y: 50, kind: KINDS.TANK });
    setEnemy(data, 1, { x: 0, y: 320, kind: KINDS.TANK });
    enemies.update(2);
    expect(positionOf(byName['enemy-tank'], 0).toArray()).toEqual([-20, 0, -110]);
    expect(positionOf(byName['enemy-tank'], 1).toArray()).toEqual([-120, 0, 160]);
  });

  it('turns each instance about Y by its heading angle', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, angle: 0, kind: KINDS.JET });
    setEnemy(data, 1, { x: 20, y: 20, angle: Math.PI / 2, kind: KINDS.JET });
    enemies.update(2);
    const ahead = headingOf(byName['enemy-jet'], 0);
    const side = headingOf(byName['enemy-jet'], 1);
    expect(ahead.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-5);
    expect(side.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-5);
  });

  it('rebuilds the per-kind counts on every update', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    enemies.update(1);
    expect(byName['enemy-heli'].count).toBe(1);
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.TURRET });
    enemies.update(1);
    expect(byName['enemy-heli'].count).toBe(0);
    expect(byName['enemy-turret'].count).toBe(1);
  });

  it('asks geometryFor for every kind name', () => {
    const asked = [];
    build(8, {
      geometryFor: (name) => {
        asked.push(name);
        return new THREE.BoxGeometry(1, 1, 1);
      },
    });
    expect(asked).toEqual(['JET', 'HELI', 'CARRIER', 'TANK', 'TURRET']);
  });

  it('gives a kind it has no colour for a neutral fallback', () => {
    const data = new Float32Array(STRIDE * 2);
    const enemies = createEnemyInstances({
      data,
      capacity: 2,
      kinds: { MYSTERY: 0 },
      playfieldW: 240,
      playfieldH: 320,
    });
    setEnemy(data, 0, { x: 5, y: 5, kind: 0 });
    enemies.update(1);
    expect(enemies.meshes[0].name).toBe('enemy-mystery');
    expect(enemies.meshes[0].count).toBe(1);
  });
});

describe('basicEnemyGeometry', () => {
  it('gives each gallery kind its own primitive and a box for anything else', () => {
    expect(basicEnemyGeometry('JET').type).toBe('ConeGeometry');
    expect(basicEnemyGeometry('HELI').type).toBe('CapsuleGeometry');
    expect(basicEnemyGeometry('CARRIER').type).toBe('BoxGeometry');
    expect(basicEnemyGeometry('TANK').type).toBe('BoxGeometry');
    expect(basicEnemyGeometry('TURRET').type).toBe('CylinderGeometry');
    expect(basicEnemyGeometry('MYSTERY').type).toBe('BoxGeometry');
  });

  it('points the jet along +Z: its tip is the vertex furthest along Z', () => {
    const position = basicEnemyGeometry('JET').getAttribute('position');
    let tip = 0;
    for (let i = 1; i < position.count; i++) if (position.getZ(i) > position.getZ(tip)) tip = i;
    expect(position.getZ(tip)).toBeGreaterThan(5);
    expect(position.getX(tip)).toBeCloseTo(0);
    expect(position.getY(tip)).toBeCloseTo(0);
  });
});
