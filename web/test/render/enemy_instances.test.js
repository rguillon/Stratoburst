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

function colourOf(mesh, i) {
  const c = new THREE.Color();
  mesh.getColorAt(i, c);
  return [c.r, c.g, c.b];
}

describe('createEnemyInstances hit flash and bad data', () => {
  it('colours a resting enemy with its kind base colour and a flashing one HDR white', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, flash: 0, kind: KINDS.TANK });
    setEnemy(data, 1, { x: 20, y: 20, flash: 1, kind: KINDS.TANK });
    setEnemy(data, 2, { x: 30, y: 30, flash: 0.17, kind: KINDS.TANK });
    enemies.update(3);
    const tank = byName['enemy-tank'];
    expect(colourOf(tank, 0).map((v) => Math.round(v * 100) / 100)).toEqual([0.62, 0.52, 0.34]);
    expect(colourOf(tank, 1).map((v) => Math.round(v * 10) / 10)).toEqual([2.2, 2.2, 2.2]);
    expect(colourOf(tank, 2).map((v) => Math.round(v * 10) / 10)).toEqual([2.2, 2.2, 2.2]);
  });

  it('gives every kind a military base colour below 1.0 in every channel', () => {
    const { data, enemies, byName } = build();
    Object.values(KINDS).forEach((kind, i) => setEnemy(data, i, { x: 10 * i, y: 10, kind }));
    enemies.update(5);
    for (const mesh of Object.values(byName)) {
      expect(colourOf(mesh, 0).every((v) => v < 1)).toBe(true);
    }
    expect(new Set(enemies.meshes.map((mesh) => colourOf(mesh, 0).join())).size).toBe(5);
  });

  it('an enemy that stops flashing goes back to the base colour', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, flash: 1, kind: KINDS.JET });
    enemies.update(1);
    setEnemy(data, 0, { x: 10, y: 10, flash: 0, kind: KINDS.JET });
    enemies.update(1);
    expect(colourOf(byName['enemy-jet'], 0)[0]).toBeLessThan(1);
  });

  it('flags the instance buffers for upload only on meshes that were written', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    const before = Object.fromEntries(
      Object.entries(byName).map(([name, mesh]) => [
        name,
        [mesh.instanceMatrix.version, mesh.instanceColor.version],
      ]),
    );
    enemies.update(1);
    const heli = byName['enemy-heli'];
    expect(heli.instanceMatrix.version).toBeGreaterThan(before['enemy-heli'][0]);
    expect(heli.instanceColor.version).toBeGreaterThan(before['enemy-heli'][1]);
    for (const name of ['enemy-jet', 'enemy-carrier', 'enemy-tank', 'enemy-turret']) {
      expect(byName[name].instanceMatrix.version).toBe(before[name][0]);
      expect(byName[name].instanceColor.version).toBe(before[name][1]);
    }
  });

  it('does not upload a mesh again once its last instance has left', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    enemies.update(1);
    const version = byName['enemy-heli'].instanceMatrix.version;
    enemies.update(0);
    expect(byName['enemy-heli'].count).toBe(0);
    expect(byName['enemy-heli'].instanceMatrix.version).toBe(version);
  });

  it('skips an instance whose kind value is not in the manifest map (T-02-06)', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: 99 });
    setEnemy(data, 1, { x: 20, y: 20, kind: -1 });
    setEnemy(data, 2, { x: 30, y: 30, kind: 2.5 });
    setEnemy(data, 3, { x: 40, y: 40, kind: Number.NaN });
    setEnemy(data, 4, { x: 50, y: 50, kind: KINDS.TURRET });
    enemies.update(5);
    expect(enemies.meshes.reduce((total, mesh) => total + mesh.count, 0)).toBe(1);
    expect(byName['enemy-turret'].count).toBe(1);
    expect(positionOf(byName['enemy-turret'], 0).toArray()).toEqual([-70, 0, -110]);
  });

  it('clamps the count to the capacity', () => {
    const { data, enemies, byName } = build(4);
    for (let i = 0; i < 4; i++) setEnemy(data, i, { x: i, y: i, kind: KINDS.JET });
    enemies.update(99);
    expect(byName['enemy-jet'].count).toBe(4);
    enemies.update(0);
    expect(byName['enemy-jet'].count).toBe(0);
  });

  it('allocates nothing per update: meshes and attribute arrays keep their identity', () => {
    const { data, enemies } = build();
    setEnemy(data, 0, { x: 10, y: 10, flash: 1, kind: KINDS.JET });
    setEnemy(data, 1, { x: 20, y: 20, kind: KINDS.TANK });
    enemies.update(2);
    const meshes = [...enemies.meshes];
    const matrixArrays = meshes.map((mesh) => mesh.instanceMatrix.array);
    const colourArrays = meshes.map((mesh) => mesh.instanceColor.array);
    enemies.update(2);
    enemies.update(2);
    expect(enemies.meshes).toEqual(meshes);
    enemies.meshes.forEach((mesh, k) => {
      expect(mesh).toBe(meshes[k]);
      expect(mesh.instanceMatrix.array).toBe(matrixArrays[k]);
      expect(mesh.instanceColor.array).toBe(colourArrays[k]);
    });
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
