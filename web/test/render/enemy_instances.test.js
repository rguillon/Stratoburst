import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROTOR_RATE, basicEnemyGeometry, createEnemyInstances } from '../../src/render/enemy_instances.js';
import { enemyModel } from '../../src/render/models/enemy_models.js';

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
      'enemy-jet-glow',
      'enemy-heli',
      'enemy-heli-glow',
      'enemy-heli-top',
      'enemy-carrier',
      'enemy-carrier-glow',
      'enemy-tank',
      'enemy-turret',
    ]);
    for (const mesh of enemies.meshes) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.count).toBe(0);
    }
  });

  it('shares one vertex-coloured MeshStandardMaterial across the bodies', () => {
    const { enemies, byName } = build();
    const material = byName['enemy-jet'].material;
    expect(material.isMeshStandardMaterial).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.roughness).toBeCloseTo(0.55);
    expect(material.metalness).toBeCloseTo(0.25);
    const bodies = enemies.meshes.filter((mesh) => !mesh.name.endsWith('-glow') && !mesh.name.endsWith('-top'));
    expect(bodies.every((mesh) => mesh.material === material)).toBe(true);
  });

  it('draws the glow with one vertex-coloured MeshBasicMaterial', () => {
    const { byName } = build();
    const material = byName['enemy-jet-glow'].material;
    expect(material.isMeshBasicMaterial).toBe(true);
    expect(material.vertexColors).toBe(true);
  });

  it('draws nothing until told how many enemies are live', () => {
    const { enemies } = build();
    enemies.update(0);
    expect(enemies.meshes.map((mesh) => mesh.count)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
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

  it('asks geometryFor for every kind name at the starting detail', () => {
    const asked = [];
    build(8, {
      detail: 'mid',
      geometryFor: (name, detail) => {
        asked.push([name, detail]);
        return { body: new THREE.BoxGeometry(1, 1, 1), glow: null, top: null };
      },
    });
    expect(asked).toEqual(
      ['JET', 'HELI', 'CARRIER', 'TANK', 'TURRET'].map((name) => [name, 'mid']),
    );
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
    expect(enemies.meshes.map((mesh) => mesh.name)).toEqual(['enemy-mystery']);
    expect(enemies.meshes[0].count).toBe(1);
  });
});

function colourOf(mesh, i) {
  const c = new THREE.Color();
  mesh.getColorAt(i, c);
  return [c.r, c.g, c.b];
}

describe('createEnemyInstances hit flash and bad data', () => {
  it('colours a resting enemy (1, 1, 1) and a flashing one (6, 6, 6)', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, flash: 0, kind: KINDS.TANK });
    setEnemy(data, 1, { x: 20, y: 20, flash: 1, kind: KINDS.TANK });
    setEnemy(data, 2, { x: 30, y: 30, flash: 0.17, kind: KINDS.TANK });
    enemies.update(3);
    const tank = byName['enemy-tank'];
    expect(colourOf(tank, 0)).toEqual([1, 1, 1]);
    expect(colourOf(tank, 1)).toEqual([6, 6, 6]);
    expect(colourOf(tank, 2)).toEqual([6, 6, 6]);
  });

  it('keeps every body vertex colour below 1.0 so only the flash crosses the bloom threshold', () => {
    const { byName } = build();
    for (const [name, mesh] of Object.entries(byName)) {
      if (name.endsWith('-glow')) continue;
      const colours = mesh.geometry.getAttribute('color').array;
      expect(colours.length).toBeGreaterThan(0);
      expect(colours.every((v) => v < 1)).toBe(true);
    }
  });

  it('tints the primitive stand-ins with a distinct military colour per kind', () => {
    const { byName } = build();
    const first = (name) => Array.from(byName[name].geometry.getAttribute('color').array.slice(0, 3));
    expect(first('enemy-tank')).toEqual([expect.closeTo(0.62), expect.closeTo(0.52), expect.closeTo(0.34)]);
    expect(first('enemy-tank')).not.toEqual(first('enemy-turret'));
  });

  it('an enemy that stops flashing goes back to the base colour', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, flash: 1, kind: KINDS.JET });
    enemies.update(1);
    setEnemy(data, 0, { x: 10, y: 10, flash: 0, kind: KINDS.JET });
    enemies.update(1);
    expect(colourOf(byName['enemy-jet'], 0)).toEqual([1, 1, 1]);
  });

  it('flags the instance buffers for upload only on meshes that were written', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    const before = Object.fromEntries(
      Object.entries(byName).map(([name, mesh]) => [
        name,
        [mesh.instanceMatrix.version, mesh.instanceColor?.version],
      ]),
    );
    enemies.update(1);
    const heli = byName['enemy-heli'];
    expect(heli.instanceMatrix.version).toBeGreaterThan(before['enemy-heli'][0]);
    expect(heli.instanceColor.version).toBeGreaterThan(before['enemy-heli'][1]);
    const others = ['enemy-jet', 'enemy-jet-glow', 'enemy-carrier', 'enemy-carrier-glow', 'enemy-tank'];
    for (const name of [...others, 'enemy-turret']) {
      expect(byName[name].instanceMatrix.version).toBe(before[name][0]);
      expect(byName[name].instanceColor?.version).toBe(before[name][1]);
    }
  });

  it('uploads the glow matrices together with the body matrices', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.JET });
    const before = byName['enemy-jet-glow'].instanceMatrix.version;
    enemies.update(1);
    expect(byName['enemy-jet-glow'].instanceMatrix.version).toBeGreaterThan(before);
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
    const colourArrays = meshes.map((mesh) => mesh.instanceColor?.array);
    enemies.update(2);
    enemies.update(2);
    expect(enemies.meshes).toEqual(meshes);
    enemies.meshes.forEach((mesh, k) => {
      expect(mesh).toBe(meshes[k]);
      expect(mesh.instanceMatrix.array).toBe(matrixArrays[k]);
      expect(mesh.instanceColor?.array).toBe(colourArrays[k]);
    });
  });
});

describe('createEnemyInstances models', () => {
  const matrixOf = (mesh, i) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    return m.toArray();
  };

  it('draws a kind with a model by a body mesh and a glow mesh with the same matrices', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 100, y: 50, angle: 0.7, kind: KINDS.JET });
    setEnemy(data, 1, { x: 30, y: 200, angle: 2, kind: KINDS.JET });
    enemies.update(2);
    const body = byName['enemy-jet'];
    const glow = byName['enemy-jet-glow'];
    expect(body.count).toBe(2);
    expect(glow.count).toBe(2);
    for (let i = 0; i < 2; i++) expect(matrixOf(glow, i)).toEqual(matrixOf(body, i));
  });

  it('builds the jet from the code-built model and keeps primitives for kinds without one', () => {
    const { byName } = build();
    expect(byName['enemy-jet'].geometry).toBe(enemyModel('JET', 'high').body);
    expect(byName['enemy-jet-glow'].geometry).toBe(enemyModel('JET', 'high').glow);
    expect(byName['enemy-tank'].geometry.type).toBe('BoxGeometry');
    expect(byName['enemy-turret'].geometry.type).toBe('CylinderGeometry');
    expect(byName['enemy-tank-glow']).toBeUndefined();
  });

  it('starts at the requested detail', () => {
    const { byName } = build(8, { detail: 'low' });
    expect(byName['enemy-jet'].geometry).toBe(enemyModel('JET', 'low').body);
  });

  it('setDetail swaps the cached geometries on the existing meshes, creating nothing', () => {
    const { enemies, byName } = build();
    const meshes = [...enemies.meshes];
    const primitive = byName['enemy-tank'].geometry;
    for (const detail of ['low', 'mid', 'high']) {
      enemies.setDetail(detail);
      expect(byName['enemy-jet'].geometry).toBe(enemyModel('JET', detail).body);
      expect(byName['enemy-jet-glow'].geometry).toBe(enemyModel('JET', detail).glow);
      expect(byName['enemy-tank'].geometry).toBe(primitive);
      expect(enemies.meshes).toHaveLength(meshes.length);
      enemies.meshes.forEach((mesh, k) => expect(mesh).toBe(meshes[k]));
    }
  });

  it('gives a lower detail fewer vertices on the drawn jet', () => {
    const { enemies, byName } = build();
    const count = () => byName['enemy-jet'].geometry.getAttribute('position').count;
    enemies.setDetail('high');
    const high = count();
    enemies.setDetail('low');
    expect(count()).toBeLessThan(high);
  });

  it('draws nothing for zero live enemies after drawing some', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.JET });
    enemies.update(1);
    enemies.update(0);
    expect(byName['enemy-jet'].count).toBe(0);
    expect(byName['enemy-jet-glow'].count).toBe(0);
  });
});

describe('createEnemyInstances tops', () => {
  const headingOfTop = (mesh, i) => headingOf(mesh, i);
  const angleOf = (heading) => Math.atan2(heading.x, heading.z);
  const wrapped = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  it('gives a kind whose model has a top a third mesh sharing the body material', () => {
    const { byName } = build();
    expect(byName['enemy-heli-top'].isInstancedMesh).toBe(true);
    expect(byName['enemy-heli-top'].material).toBe(byName['enemy-heli'].material);
    expect(byName['enemy-jet-top']).toBeUndefined();
    expect(byName['enemy-carrier-top']).toBeUndefined();
  });

  it('exports the rotor rate of 30 rad/s', () => {
    expect(ROTOR_RATE).toBe(30);
  });

  it('turns the heli rotor by angle + timeS * ROTOR_RATE and leaves the body at its heading', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, angle: 0.4, kind: KINDS.HELI });
    enemies.update(1, 0.05);
    const expected = wrapped(0.4 + 0.05 * ROTOR_RATE);
    expect(angleOf(headingOfTop(byName['enemy-heli-top'], 0))).toBeCloseTo(expected, 4);
    expect(angleOf(headingOf(byName['enemy-heli'], 0))).toBeCloseTo(0.4, 4);
    enemies.update(1, 0.1);
    expect(angleOf(headingOfTop(byName['enemy-heli-top'], 0))).toBeCloseTo(wrapped(0.4 + 3), 4);
  });

  it('writes the top at the body position with the same count and flash colour', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 100, y: 50, kind: KINDS.HELI });
    setEnemy(data, 1, { x: 30, y: 60, flash: 1, kind: KINDS.HELI });
    enemies.update(2, 1);
    const top = byName['enemy-heli-top'];
    expect(top.count).toBe(2);
    expect(positionOf(top, 0).toArray()).toEqual(positionOf(byName['enemy-heli'], 0).toArray());
    expect(colourOf(top, 0)).toEqual([1, 1, 1]);
    expect(colourOf(top, 1)).toEqual([6, 6, 6]);
  });

  it('draws no tops once the last helicopter has left', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    enemies.update(1);
    enemies.update(0);
    expect(byName['enemy-heli-top'].count).toBe(0);
  });

  it('turns the top of any other kind by the aux aim angle', () => {
    const data = new Float32Array(STRIDE * 4);
    const enemies = createEnemyInstances({
      data,
      capacity: 4,
      kinds: KINDS,
      playfieldW: 240,
      playfieldH: 320,
      geometryFor: (name) => ({
        body: new THREE.BoxGeometry(1, 1, 1),
        glow: null,
        top: name === 'TURRET' ? new THREE.BoxGeometry(1, 1, 3) : null,
      }),
    });
    const top = enemies.meshes.find((mesh) => mesh.name === 'enemy-turret-top');
    data.set([10, 10, 0.2, 0, 1, KINDS.TURRET, 1.1, 0], 0);
    enemies.update(1, 5);
    expect(angleOf(headingOf(top, 0))).toBeCloseTo(1.1, 4);
  });

  it('setDetail swaps the top geometry too and creates no mesh', () => {
    const { enemies, byName } = build();
    const before = enemies.meshes.length;
    enemies.setDetail('low');
    expect(byName['enemy-heli-top'].geometry).toBe(enemyModel('HELI', 'low').top);
    expect(byName['enemy-heli'].geometry).toBe(enemyModel('HELI', 'low').body);
    expect(byName['enemy-carrier-glow'].geometry).toBe(enemyModel('CARRIER', 'low').glow);
    enemies.setDetail('high');
    expect(byName['enemy-heli-top'].geometry).toBe(enemyModel('HELI', 'high').top);
    expect(enemies.meshes).toHaveLength(before);
  });

  it('allocates nothing when updating with a clock: arrays keep their identity', () => {
    const { data, enemies, byName } = build();
    setEnemy(data, 0, { x: 10, y: 10, kind: KINDS.HELI });
    enemies.update(1, 0.1);
    const top = byName['enemy-heli-top'];
    const matrices = top.instanceMatrix.array;
    const colours = top.instanceColor.array;
    enemies.update(1, 0.2);
    expect(top.instanceMatrix.array).toBe(matrices);
    expect(top.instanceColor.array).toBe(colours);
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
