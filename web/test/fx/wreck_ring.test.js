import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createWreckRing } from '../../src/fx/wreck_ring.js';
import { enemyModel } from '../../src/render/models/enemy_models.js';

const EVENTS = { EXPLOSION: 1, HIT: 2 };
const KINDS = { TANK: 3, TURRET: 4 };
const W = 240;
const H = 320;
const RATIO = 0.94;

function build(options = {}) {
  const state = { scroll: 100 };
  const asked = [];
  const ring = createWreckRing({
    kinds: KINDS,
    events: EVENTS,
    geometryFor: (name, detail) => {
      asked.push([name, detail]);
      return enemyModel(name, detail);
    },
    ratio: RATIO,
    getScroll: () => state.scroll,
    playfieldW: W,
    playfieldH: H,
    ...options,
  });
  const byName = Object.fromEntries(ring.meshes.map((mesh) => [mesh.name, mesh]));
  return { ring, state, asked, byName };
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

describe('createWreckRing', () => {
  it('builds one InstancedMesh per ground kind from the low-detail body, grouped for the ground layer', () => {
    const { ring, asked, byName } = build();
    expect(ring.group.name).toBe('wreck-ring');
    expect(ring.group.children).toEqual(ring.meshes);
    expect(ring.meshes.map((mesh) => mesh.name)).toEqual(['wreck-tank', 'wreck-turret']);
    expect(asked).toEqual([
      ['TANK', 'low'],
      ['TURRET', 'low'],
    ]);
    expect(byName['wreck-tank'].geometry).toBe(enemyModel('TANK', 'low').body);
    for (const mesh of ring.meshes) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.count).toBe(0);
    }
    expect(ring.spawned).toBe(0);
    expect(ring.live).toBe(0);
  });

  it('adds a wreck for a ground EXPLOSION and draws it at the kill position', () => {
    const { ring, byName } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    expect(ring.spawned).toBe(1);
    ring.update(100);
    expect(ring.live).toBe(1);
    expect(byName['wreck-tank'].count).toBe(1);
    expect(byName['wreck-turret'].count).toBe(0);
    expect(positionOf(byName['wreck-tank'], 0).toArray()).toEqual([-20, 0, -110]);
  });

  it('adds nothing for an air EXPLOSION, another event, or an unknown kind', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 1, 0, KINDS.TANK);
    ring.handle(EVENTS.HIT, 100, 50, 0, 1, KINDS.TANK);
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, 0); // a JET value is not a ground kind here
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, 99);
    expect(ring.spawned).toBe(0);
    ring.update(100);
    expect(ring.live).toBe(0);
  });

  it('moves a wreck down by the ground ratio times the scroll since the kill', () => {
    const { ring, byName } = build();
    ring.handle(EVENTS.EXPLOSION, 60, 40, 2, 1, KINDS.TURRET);
    ring.update(100 + 50);
    const p = positionOf(byName['wreck-turret'], 0);
    expect(p.x).toBeCloseTo(60 - W / 2, 4);
    expect(p.z).toBeCloseTo(40 + RATIO * 50 - H / 2, 3);
  });

  it('records the scroll at each kill separately', () => {
    const { ring, state, byName } = build();
    ring.handle(EVENTS.EXPLOSION, 10, 10, 2, 1, KINDS.TANK);
    state.scroll = 140;
    ring.handle(EVENTS.EXPLOSION, 10, 10, 2, 1, KINDS.TANK);
    ring.update(160);
    expect(positionOf(byName['wreck-tank'], 0).z).toBeCloseTo(10 + RATIO * 60 - H / 2, 3);
    expect(positionOf(byName['wreck-tank'], 1).z).toBeCloseTo(10 + RATIO * 20 - H / 2, 3);
  });

  it('stops drawing a wreck once it has passed PLAYFIELD_H + 40', () => {
    const { ring, byName } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 300, 2, 1, KINDS.TANK);
    // y = 300 + 0.94 * s: still drawn at 359.9, retired past 360
    ring.update(100 + 63.8);
    expect(ring.live).toBe(1);
    ring.update(100 + 64.5);
    expect(ring.live).toBe(0);
    expect(byName['wreck-tank'].count).toBe(0);
  });

  it('overwrites the oldest wreck when the 13th arrives', () => {
    const { ring, state, byName } = build();
    for (let i = 0; i < 12; i++) {
      state.scroll = 100;
      ring.handle(EVENTS.EXPLOSION, i * 10, 100, 2, 1, KINDS.TANK);
    }
    ring.update(100);
    expect(ring.live).toBe(12);
    ring.handle(EVENTS.EXPLOSION, 230, 100, 2, 1, KINDS.TANK);
    expect(ring.spawned).toBe(13);
    ring.update(100);
    expect(ring.live).toBe(12);
    const xs = [];
    for (let i = 0; i < 12; i++) xs.push(positionOf(byName['wreck-tank'], i).x + W / 2);
    expect(xs).not.toContain(0); // the first wreck (x = 0) was overwritten
    expect(xs).toContain(230);
  });

  it('charrs the instances well below the bloom threshold', () => {
    const { ring, byName } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    ring.update(100);
    const rgb = colourOf(byName['wreck-tank'], 0);
    expect(rgb[0]).toBeCloseTo(0.12, 5);
    expect(rgb[1]).toBeCloseTo(0.11, 5);
    expect(rgb[2]).toBeCloseTo(0.1, 5);
    expect(Math.max(...rgb)).toBeLessThan(0.2);
  });

  it('gives each wreck a seeded yaw, the same for the same seed', () => {
    const yawOf = (ring, mesh) => {
      ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
      ring.update(100);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      return new THREE.Vector3(0, 0, 1).transformDirection(m).toArray();
    };
    const a = build();
    const b = build();
    expect(yawOf(a.ring, a.byName['wreck-tank'])).toEqual(yawOf(b.ring, b.byName['wreck-tank']));
  });

  it('uploads an instance buffer only when something was written', () => {
    const { ring, byName } = build();
    const versions = Object.fromEntries(
      Object.entries(byName).map(([name, mesh]) => [name, mesh.instanceMatrix.version]),
    );
    ring.update(100);
    expect(byName['wreck-tank'].instanceMatrix.version).toBe(versions['wreck-tank']);
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    ring.update(100);
    expect(byName['wreck-tank'].instanceMatrix.version).toBeGreaterThan(versions['wreck-tank']);
    expect(byName['wreck-turret'].instanceMatrix.version).toBe(versions['wreck-turret']);
  });

  it('allocates nothing per update: meshes and attribute arrays keep their identity', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    ring.update(100);
    const meshes = [...ring.meshes];
    const matrices = meshes.map((mesh) => mesh.instanceMatrix.array);
    const colours = meshes.map((mesh) => mesh.instanceColor.array);
    ring.update(101);
    ring.update(102);
    ring.meshes.forEach((mesh, k) => {
      expect(mesh).toBe(meshes[k]);
      expect(mesh.instanceMatrix.array).toBe(matrices[k]);
      expect(mesh.instanceColor.array).toBe(colours[k]);
    });
  });

  it('holds twelve wrecks by default', () => {
    const { byName } = build();
    expect(byName['wreck-tank'].instanceMatrix.count).toBe(12);
  });
});

// The smouldering trickle: emit(x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity).
function smouldering(options = {}) {
  const emitted = { additive: [], normal: [] };
  const layer = (name) => ({ emit: (...args) => emitted[name].push(args) });
  const scale = { value: 1 };
  const built = build({
    layers: { additive: layer('additive'), normal: layer('normal') },
    getScale: () => scale.value,
    // Distinct from the gameplay plane so a test can see the ground layer was used.
    toWorld: (x, y, out) => out.set(x - 120, -40, y - 160),
    ...options,
  });
  return { ...built, emitted, scale };
}

// Advance the effect clock by `seconds` in 1/60 s frames, from `from`.
function run(ring, from, seconds, scroll = 100) {
  const frames = Math.round(seconds * 60);
  for (let f = 1; f <= frames; f++) ring.update(scroll, from + f / 60);
  return from + frames / 60;
}

function hueOf([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('the smouldering trickle', () => {
  it('puffs dark smoke on the normal layer about every 0.18 s at particleScale 1', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(ring, 0, 3.6);
    expect(emitted.normal.length).toBeGreaterThanOrEqual(19);
    expect(emitted.normal.length).toBeLessThanOrEqual(21);
    for (const p of emitted.normal) {
      expect(Math.max(p[9], p[10], p[11])).toBeLessThan(0.3); // dark
      expect(p[12]).toBeLessThan(0); // negative gravity: it rises
      expect(p[4]).toBeGreaterThan(0); // and starts upward
    }
  });

  it('flickers small orange flames on the additive layer every 0.3 s during the first 6 s only', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    const t = run(ring, 0, 6);
    expect(emitted.additive.length).toBeGreaterThanOrEqual(19);
    expect(emitted.additive.length).toBeLessThanOrEqual(21);
    const before = emitted.additive.length;
    run(ring, t, 4);
    expect(emitted.additive.length).toBe(before); // no flames after 6 s
  });

  it('keeps smoking after the flames die', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    const t = run(ring, 0, 8);
    const before = emitted.normal.length;
    run(ring, t, 1.8);
    expect(emitted.normal.length - before).toBeGreaterThanOrEqual(9);
  });

  it('paints the flames orange and never pink', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(ring, 0, 3);
    expect(emitted.additive.length).toBeGreaterThan(0);
    for (const p of emitted.additive) {
      const rgb = [p[9], p[10], p[11]];
      const hue = hueOf(rgb);
      expect(hue).toBeGreaterThanOrEqual(15);
      expect(hue).toBeLessThanOrEqual(45);
      expect(p[7]).toBeLessThan(6); // small
    }
  });

  it('scales the rate by getScale()', () => {
    const full = smouldering();
    full.ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(full.ring, 0, 3.6);
    const low = smouldering();
    low.scale.value = 0.35;
    low.ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(low.ring, 0, 3.6);
    const ratio = low.emitted.normal.length / full.emitted.normal.length;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.45);
    const flameRatio = low.emitted.additive.length / full.emitted.additive.length;
    expect(flameRatio).toBeGreaterThan(0.2);
    expect(flameRatio).toBeLessThan(0.5);
  });

  it('places the puffs at the wreck position in the ground layer', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(ring, 0, 1);
    const [first] = emitted.normal;
    expect(first[0]).toBeCloseTo(-20, 5);
    expect(first[1]).toBeCloseTo(-40, 5);
    expect(first[2]).toBeCloseTo(-110, 5);
  });

  it('follows the wreck down the screen with the ground scroll', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    run(ring, 0, 1, 100 + 50);
    const [first] = emitted.normal;
    expect(first[2]).toBeCloseTo(50 + RATIO * 50 - 160, 3);
  });

  it('emits nothing for a wreck that is off screen', () => {
    const below = smouldering();
    below.ring.handle(EVENTS.EXPLOSION, 100, 300, 2, 1, KINDS.TANK);
    run(below.ring, 0, 2, 100 + 40); // y = 300 + 0.94 * 40 = 337.6, past the bottom
    expect(below.emitted.normal).toHaveLength(0);
    expect(below.emitted.additive).toHaveLength(0);
    const above = smouldering();
    above.state.scroll = 100;
    above.ring.handle(EVENTS.EXPLOSION, 100, 20, 2, 1, KINDS.TANK);
    run(above.ring, 0, 2, 100 - 40); // y = 20 - 37.6 < 0
    expect(above.emitted.normal).toHaveLength(0);
    expect(above.emitted.additive).toHaveLength(0);
  });

  it('emits nothing without a particle layer', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    expect(() => run(ring, 0, 1)).not.toThrow();
    expect(ring.live).toBe(1);
  });

  it('counts a long frame as at most a quarter second', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    ring.update(100, 60); // a minute-long gap, such as a tab returning from the background
    expect(emitted.normal.length).toBeLessThanOrEqual(2);
    expect(emitted.additive.length).toBeLessThanOrEqual(1);
  });

  it('ignores a clock that runs backwards', () => {
    const { ring, emitted } = smouldering();
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    ring.update(100, 5);
    const before = emitted.normal.length;
    ring.update(100, 4);
    expect(emitted.normal.length).toBe(before);
  });

  it('starts a new wreck fresh when it overwrites a slot: flames again, no carried accumulator', () => {
    const { ring, emitted } = smouldering({ capacity: 1 });
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
    const t = run(ring, 0, 8);
    const before = emitted.additive.length;
    ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TURRET);
    run(ring, t, 3);
    expect(emitted.additive.length - before).toBeGreaterThanOrEqual(9);
  });

  it('is deterministic with the default seeded rng', () => {
    const a = smouldering();
    const b = smouldering();
    for (const { ring } of [a, b]) {
      ring.handle(EVENTS.EXPLOSION, 100, 50, 2, 1, KINDS.TANK);
      run(ring, 0, 2);
    }
    expect(a.emitted.normal).toEqual(b.emitted.normal);
    expect(a.emitted.additive).toEqual(b.emitted.additive);
  });
});

