import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOV_DEG,
  altitudeScale,
  applyCameraFit,
  fitCamera,
} from '../../src/render/camera_fit.js';
import { createGroundLayer, TERRAIN_DEPTH } from '../../src/render/ground_layer.js';
import {
  cityY,
  createCityLayer,
  terrainWindow,
  unitBoxModel,
  windowCapacity,
} from '../../src/render/city_layer.js';
import { PALETTE } from '../../src/fx/palette.js';
import { sceneryModel, sceneryTint } from '../../src/render/models/scenery_models.js';

const W = 240;
const H = 320;
const RATIO = 0.94;
const Y0 = -40;
const STRIDE = 6;
const ASPECTS = {
  'phone 9/19.5': 9 / 19.5,
  '3/4 portrait': 3 / 4,
  '4/3 landscape': 4 / 3,
  '16/9': 16 / 9,
};
// scenery_kinds as the manifest ships them: name -> value.
const KINDS = { SLUM_HOUSE: 0, TOWER: 2, SIGN: 3, RUNWAY_LIGHT: 6, FIRE: 7 };
const TOWER = 2;
const SIGN = 3;

function fitted(aspect) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 10, 4000);
  applyCameraFit(camera, fitCamera({ aspect, halfW: W / 2, halfH: H / 2 }));
  camera.updateMatrixWorld(true);
  return camera;
}

function flat(records) {
  return Float32Array.from(records.flat());
}

function build(records, extra = {}) {
  return createCityLayer({
    layout: flat(records),
    stride: STRIDE,
    kinds: KINDS,
    ratio: RATIO,
    y0: Y0,
    playfieldW: W,
    playfieldH: H,
    geometryFor: unitBoxModel,
    ...extra,
  });
}

function meshNamed(layer, name) {
  return layer.group.children.find((child) => child.name === name);
}

function localPosition(mesh, index) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(index, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

// Records at a regular spacing of towers, one every `gap` distance units from 0 to `end`.
function towerRun(gap, end) {
  const records = [];
  for (let d = 0; d <= end; d += gap) records.push([TOWER, 100, d, 10, 20, 0]);
  return records;
}

describe('cityY', () => {
  it('is y0 + ratio * (scroll - d), the mapping Python uses for ground rows', () => {
    expect(cityY(0, 0, Y0, RATIO)).toBe(Y0);
    expect(cityY(100, 40, Y0, RATIO)).toBeCloseTo(Y0 + RATIO * 60, 12);
    expect(cityY(0, 100, Y0, RATIO)).toBeCloseTo(Y0 - RATIO * 100, 12);
  });
});

describe('ground-frame alignment (NDC)', () => {
  for (const [name, aspect] of Object.entries(ASPECTS)) {
    it(`NDC: a city instance, a ground-layer point and the gameplay-plane point agree at ${name}`, () => {
      const camera = fitted(aspect);
      const ground = createGroundLayer({ playfieldW: W, playfieldH: H });
      ground.refit(camera);
      const scroll = 777.5;
      for (const [x, d] of [
        [30, 700],
        [120, 600],
        [211, 800],
        [5, 760],
      ]) {
        const layer = build([[TOWER, x, d, 12, 20, 0]]);
        ground.group.add(layer.group);
        layer.update(scroll);
        ground.group.updateMatrixWorld(true);

        const mesh = meshNamed(layer, 'city-tower');
        expect(mesh.count).toBe(1);
        const instance = localPosition(mesh, 0).applyMatrix4(mesh.matrixWorld).project(camera);

        const y = cityY(scroll, d, Y0, RATIO);
        const plane = new THREE.Vector3(x - W / 2, 0, y - H / 2).project(camera);
        const marker = new THREE.Object3D();
        marker.position.set(x - W / 2, 0, y - H / 2);
        ground.group.add(marker);
        ground.group.updateMatrixWorld(true);
        const point = marker.getWorldPosition(new THREE.Vector3()).project(camera);
        ground.group.remove(marker);
        ground.group.remove(layer.group);

        for (const other of [point, plane]) {
          expect(Math.abs(instance.x - other.x)).toBeLessThan(1e-6);
          expect(Math.abs(instance.y - other.y)).toBeLessThan(1e-6);
        }
      }
    });
  }
});

describe('terrainWindow', () => {
  // The terrain visible through the fitted camera, found independently with a raycaster: the
  // frustum corners hit the terrain plane, and each hit is mapped back into logical coordinates.
  function visibleRange(aspect) {
    const camera = fitted(aspect);
    const k = altitudeScale(camera.position.y, TERRAIN_DEPTH, 0);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TERRAIN_DEPTH);
    const raycaster = new THREE.Raycaster();
    let yMin = Infinity;
    let yMax = -Infinity;
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const [nx, ny] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      const lx = (hit.x - camera.position.x * (1 - k)) / k + W / 2;
      const ly = (hit.z - camera.position.z * (1 - k)) / k + H / 2;
      xMin = Math.min(xMin, lx);
      xMax = Math.max(xMax, lx);
      yMin = Math.min(yMin, ly);
      yMax = Math.max(yMax, ly);
    }
    return { xMin, xMax, yMin, yMax };
  }

  const window = terrainWindow({ playfieldW: W, playfieldH: H });

  for (const [name, aspect] of Object.entries(ASPECTS)) {
    it(`covers the whole visible terrain at ${name}`, () => {
      const seen = visibleRange(aspect);
      expect(window.yMin).toBeLessThanOrEqual(seen.yMin);
      expect(window.yMax).toBeGreaterThanOrEqual(seen.yMax);
      expect(window.xMin).toBeLessThanOrEqual(seen.xMin);
      expect(window.xMax).toBeGreaterThanOrEqual(seen.xMax);
    });
  }

  it('is not absurdly larger than the playfield (it bounds the draw cost)', () => {
    expect(window.yMax - window.yMin).toBeLessThan(2000);
    expect(window.xMax - window.xMin).toBeLessThan(2000);
    expect(window.yMin).toBeLessThan(0);
    expect(window.yMax).toBeGreaterThan(H);
  });

  it('is cached: the same inputs give the same object', () => {
    expect(terrainWindow({ playfieldW: W, playfieldH: H })).toBe(window);
  });

  it('uses a custom list of aspects when asked', () => {
    const narrow = terrainWindow({ playfieldW: W, playfieldH: H, aspects: [1] });
    expect(narrow).not.toBe(window);
    expect(narrow.yMax - narrow.yMin).toBeLessThan(window.yMax - window.yMin);
  });
});

describe('windowCapacity', () => {
  it('is the most distances inside any closed span', () => {
    expect(windowCapacity([0, 10, 20, 30, 40], 20, false, 0)).toBe(3);
    expect(windowCapacity([0, 1, 2, 100, 101], 5, false, 0)).toBe(3);
    expect(windowCapacity([], 50, false, 0)).toBe(0);
  });

  it('counts across the seam of a loop', () => {
    // Three at the very end and two at the start fall inside one 12-wide span when wrapped.
    expect(windowCapacity([1, 2, 90, 95, 99], 12, true, 100)).toBe(5);
    expect(windowCapacity([1, 2, 90, 95, 99], 12, false, 100)).toBe(3);
  });
});

describe('createCityLayer', () => {
  it('builds at most two meshes per scenery kind that has a placement, named after the kind', () => {
    const layer = build([
      [TOWER, 10, 0, 10, 20, 0],
      [SIGN, 12, 5, 2, 8, 1],
    ]);
    expect(layer.group.name).toBe('city-layer');
    const names = layer.group.children.map((child) => child.name);
    expect(names).toContain('city-tower');
    expect(names).toContain('city-sign');
    expect(names).not.toContain('city-fire');
    expect(layer.group.children.length).toBeLessThanOrEqual(2 * Object.keys(KINDS).length);
    expect(layer.group.children.every((child) => child.isInstancedMesh)).toBe(true);
    expect(layer.group.children.every((child) => child.frustumCulled === false)).toBe(true);
  });

  it('sizes each kind from the layout: the most placements in any window-length span of distance', () => {
    const records = towerRun(25, 4000);
    const layer = build(records);
    const span = (layer.window.yMax - layer.window.yMin) / RATIO;
    const distances = records.map((r) => r[2]);
    let most = 0;
    for (const start of distances) {
      most = Math.max(most, distances.filter((d) => d >= start && d <= start + span).length);
    }
    expect(layer.capacities.TOWER).toBe(most);
    expect(meshNamed(layer, 'city-tower').instanceMatrix.count).toBe(most);
    expect(most).toBeLessThan(records.length);
  });

  it('draws exactly the placements whose y falls in the window and puts them in plane coordinates', () => {
    const layer = build(towerRun(25, 4000));
    const mesh = meshNamed(layer, 'city-tower');
    for (const scroll of [0, 313.7, 1500, 3999]) {
      layer.update(scroll);
      const expected = [];
      for (let d = 0; d <= 4000; d += 25) {
        const y = cityY(scroll, d, Y0, RATIO);
        if (y >= layer.window.yMin && y <= layer.window.yMax) expected.push(d);
      }
      expect(mesh.count).toBe(expected.length);
      expect(layer.drawn).toBe(expected.length);
      const zs = Array.from({ length: mesh.count }, (_, i) => localPosition(mesh, i).z);
      const wanted = expected.map((d) => cityY(scroll, d, Y0, RATIO) - H / 2);
      expect(zs.map((z) => Math.round(z * 1000)).sort((a, b) => a - b)).toEqual(
        wanted.map((z) => Math.round(z * 1000)).sort((a, b) => a - b),
      );
      expect(localPosition(mesh, 0).x).toBeCloseTo(100 - W / 2, 4);
      expect(localPosition(mesh, 0).y).toBe(0);
    }
  });

  it('scales an instance by its width and height and sets no rotation', () => {
    const layer = build([[TOWER, 40, 0, 12, 30, 0]]);
    layer.update(0);
    const mesh = meshNamed(layer, 'city-tower');
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    m.decompose(position, quaternion, scale);
    expect(scale.toArray().map((v) => Math.round(v * 1000) / 1000)).toEqual([12, 30, 12]);
    expect(quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6);
  });

  it('writes no matrix outside the drawn set and reuses its buffers', () => {
    const layer = build(towerRun(25, 4000));
    const mesh = meshNamed(layer, 'city-tower');
    const buffer = mesh.instanceMatrix.array;
    layer.update(1000);
    const before = Float32Array.from(buffer);
    const drawn = mesh.count;
    expect(drawn).toBeGreaterThan(0);
    layer.update(1010);
    expect(mesh.instanceMatrix.array).toBe(buffer);
    // Past the drawn count the buffer still holds what it held after the first update.
    const written = Math.max(drawn, mesh.count);
    expect(Array.from(buffer.slice(written * 16))).toEqual(Array.from(before.slice(written * 16)));
    expect(mesh.instanceMatrix.version).toBeGreaterThan(0);
  });

  it('uploads nothing and draws nothing when no placement is in the window', () => {
    const layer = build([[TOWER, 40, 0, 12, 30, 0]]);
    const mesh = meshNamed(layer, 'city-tower');
    layer.update(100000);
    expect(mesh.count).toBe(0);
    expect(layer.drawn).toBe(0);
  });

  it('shows the right blocks after a jump back (restart) and a jump forward (?at=)', () => {
    const records = towerRun(40, 8800);
    const layer = build(records);
    const mesh = meshNamed(layer, 'city-tower');
    const countAt = (scroll) => {
      layer.update(scroll);
      return mesh.count;
    };
    const fresh = (scroll) => {
      const other = build(records);
      other.update(scroll);
      return meshNamed(other, 'city-tower').count;
    };
    layer.update(5000);
    expect(countAt(0)).toBe(fresh(0));
    expect(countAt(8320)).toBe(fresh(8320));
    expect(countAt(2000)).toBe(fresh(2000));
    expect(countAt(2000.5)).toBe(fresh(2000.5));
    expect(layer.drawn).toBe(fresh(2000.5));
  });

  it('draws the same instances after a jump as after walking there', () => {
    const records = towerRun(40, 8800);
    const jumped = build(records);
    const walked = build(records);
    jumped.update(5000);
    jumped.update(0);
    walked.update(0);
    const a = meshNamed(jumped, 'city-tower');
    const b = meshNamed(walked, 'city-tower');
    expect(a.count).toBe(b.count);
    expect(Array.from(a.instanceMatrix.array.slice(0, a.count * 16))).toEqual(
      Array.from(b.instanceMatrix.array.slice(0, b.count * 16)),
    );
  });

  it('wraps at the stage length in loop mode with no gap at the seam', () => {
    const length = 1000;
    const records = towerRun(40, 960); // 0, 40, ..., 960; the next wrapped tower is at 1000
    const layer = build(records, { loop: true, length });
    const mesh = meshNamed(layer, 'city-tower');
    for (const scroll of [0, 480, 990, 1000, 1035, 2010, 7777]) {
      layer.update(scroll);
      const expected = [];
      for (let n = -2; n < 12; n++) {
        for (const r of records) {
          const y = cityY(scroll, r[2] + n * length, Y0, RATIO);
          if (y >= layer.window.yMin && y <= layer.window.yMax) expected.push(Math.round(y * 100));
        }
      }
      const drawn = Array.from({ length: mesh.count }, (_, i) =>
        Math.round((localPosition(mesh, i).z + H / 2) * 100),
      );
      expect(drawn.sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    }
    // Across the seam the spacing stays 40 whichever side of it the towers come from.
    layer.update(990);
    const ys = Array.from({ length: mesh.count }, (_, i) => localPosition(mesh, i).z).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(40 * RATIO, 3);
  });

  it('sizes loop capacity across the seam', () => {
    const records = [];
    for (let d = 0; d < 1000; d += 10) records.push([TOWER, 100, d, 10, 20, 0]);
    const layer = build(records, { loop: true, length: 1000 });
    const span = (layer.window.yMax - layer.window.yMin) / RATIO;
    expect(layer.capacities.TOWER).toBe(Math.min(100, Math.floor(span / 10) + 1));
    for (let scroll = 0; scroll < 2100; scroll += 37) {
      layer.update(scroll);
      expect(meshNamed(layer, 'city-tower').count).toBeLessThanOrEqual(layer.capacities.TOWER);
    }
  });

  it('skips records of a kind the manifest does not name and ignores kinds with no placement', () => {
    const layer = build([
      [99, 10, 0, 10, 20, 0],
      [TOWER, 10, 0, 10, 20, 0],
    ]);
    layer.update(0);
    expect(layer.drawn).toBe(1);
    expect(layer.group.children.map((c) => c.name)).toEqual(['city-tower']);
  });

  it('builds nothing for an empty layout', () => {
    const layer = build([]);
    layer.update(123);
    expect(layer.group.children).toHaveLength(0);
    expect(layer.drawn).toBe(0);
  });

  it('asks the geometry seam for body and glow, and setDetail swaps cached geometry only', () => {
    const calls = [];
    const geometries = new Map();
    const geometryFor = (name, detail) => {
      calls.push(`${name}:${detail}`);
      const key = `${name}:${detail}`;
      if (!geometries.has(key)) {
        geometries.set(key, {
          body: new THREE.BoxGeometry(1, 1, 1),
          glow: name === 'TOWER' ? new THREE.BoxGeometry(1, 1, 1) : null,
        });
      }
      return geometries.get(key);
    };
    const layer = build(
      [
        [TOWER, 10, 0, 10, 20, 0],
        [SIGN, 10, 0, 2, 8, 0],
      ],
      { geometryFor, detail: 'high' },
    );
    expect(layer.group.children.map((c) => c.name).sort()).toEqual(['city-sign', 'city-tower', 'city-tower-glow']);
    const tower = meshNamed(layer, 'city-tower');
    const glow = meshNamed(layer, 'city-tower-glow');
    expect(tower.geometry).toBe(geometries.get('TOWER:high').body);
    layer.setDetail('low');
    expect(tower.geometry).toBe(geometries.get('TOWER:low').body);
    expect(glow.geometry).toBe(geometries.get('TOWER:low').glow);
    expect(meshNamed(layer, 'city-sign').geometry).toBe(geometries.get('SIGN:low').body);
    layer.setDetail('nonsense');
    expect(tower.geometry).toBe(geometries.get('TOWER:low').body);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('keeps a body and a glow mesh in step with the same matrices', () => {
    const geometryFor = () => ({ body: new THREE.BoxGeometry(1, 1, 1), glow: new THREE.BoxGeometry(1, 1, 1) });
    const layer = build([[TOWER, 10, 0, 10, 20, 0]], { geometryFor });
    layer.update(0);
    const body = meshNamed(layer, 'city-tower');
    const glow = meshNamed(layer, 'city-tower-glow');
    expect(glow.count).toBe(body.count);
    expect(Array.from(glow.instanceMatrix.array.slice(0, 16))).toEqual(
      Array.from(body.instanceMatrix.array.slice(0, 16)),
    );
  });

  it('draws its unit box stand-ins from the default geometry seam', () => {
    const model = unitBoxModel('TOWER', 'high');
    expect(model.glow).toBeNull();
    expect(unitBoxModel('TOWER', 'low')).toBe(model);
    model.body.computeBoundingBox();
    expect(model.body.boundingBox.min.y).toBe(0);
    expect(model.body.boundingBox.max.y).toBe(1);
    expect(Math.max(...Array.from(model.body.getAttribute('color').array))).toBeLessThan(1);
  });

  it('draws sceneryModel by default and tints the glow of SIGN, TOWER and RUNWAY_LIGHT by variant', () => {
    const layer = createCityLayer({
      layout: flat([
        [SIGN, 10, 0, 2, 8, 0],
        [SIGN, 20, 1, 2, 8, 3],
        [TOWER, 30, 2, 10, 20, 5],
        [6, 40, 3, 1.5, 0.6, 0],
        [6, 50, 4, 1.5, 0.6, 1],
        [7, 60, 5, 10, 2, 1],
      ]),
      stride: STRIDE,
      kinds: KINDS,
      ratio: RATIO,
      y0: Y0,
      playfieldW: W,
      playfieldH: H,
    });
    layer.update(0);
    expect(meshNamed(layer, 'city-sign').geometry).toBe(sceneryModel('SIGN', 'high').body);
    const glowColours = (name) => {
      const glow = meshNamed(layer, name);
      return Array.from({ length: glow.count }, (_, i) => glow.getColorAt(i, new THREE.Color()).toArray());
    };
    const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-5);
    const [first, second] = glowColours('city-sign-glow');
    expect(near(first, PALETTE.NEON_CYAN.rgb)).toBe(true);
    expect(near(second, PALETTE.NEON_VIOLET.rgb)).toBe(true);
    expect(near(glowColours('city-tower-glow')[0], PALETTE.NEON_GREEN.rgb)).toBe(true);
    const [blue, green] = glowColours('city-runway-light-glow');
    expect(near(blue, PALETTE.NEON_BLUE.rgb)).toBe(true);
    expect(near(green, PALETTE.NEON_GREEN.rgb)).toBe(true);
    // A kind with no tint keeps no instance colour at all.
    expect(meshNamed(layer, 'city-fire-glow').instanceColor).toBeNull();
  });

  it('retints after a jump so every drawn glow instance keeps its own variant hue', () => {
    const records = [];
    for (let d = 0; d < 2000; d += 10) records.push([SIGN, 10, d, 2, 8, (d / 10) % 6]);
    const layer = createCityLayer({
      layout: flat(records),
      stride: STRIDE,
      kinds: KINDS,
      ratio: RATIO,
      y0: Y0,
      playfieldW: W,
      playfieldH: H,
    });
    layer.update(1000);
    layer.update(30);
    const glow = meshNamed(layer, 'city-sign-glow');
    const body = meshNamed(layer, 'city-sign');
    expect(glow.count).toBe(body.count);
    expect(glow.count).toBeGreaterThan(5);
    for (let i = 0; i < glow.count; i++) {
      const z = localPosition(body, i).z + H / 2;
      const d = Math.round((Y0 + RATIO * 30 - z) / RATIO / 10) * 10;
      const expected = sceneryTint('SIGN', (d / 10) % 6);
      const rgb = glow.getColorAt(i, new THREE.Color()).toArray();
      expect(rgb.every((v, k) => Math.abs(v - expected[k]) < 1e-5)).toBe(true);
    }
  });
});
