import { describe, expect, it } from 'vitest';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  BUILDINGS_PER_CHUNK,
  CHUNK_COUNT,
  CHUNK_LEN,
  TERRAIN_DEPTH,
  TERRAIN_WIDTH,
  chunkLayout,
  createTerrainRing,
  generateChunkBuildings,
} from '../../src/render/terrain_ring.js';

// A canvas stand-in: the ring paints one texture at startup, and node has no DOM.
function fakeCanvas() {
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  return { width: 0, height: 0, getContext: () => ctx };
}

describe('chunkLayout', () => {
  it('lays a ring of four chunks one behind and two ahead of the base chunk', () => {
    expect(chunkLayout(0, 400, 4).map((c) => c.chunkIndex)).toEqual([-1, 0, 1, 2]);
    expect(chunkLayout(950, 400, 4).map((c) => c.chunkIndex)).toEqual([1, 2, 3, 4]);
  });

  it('tiles contiguously: neighbouring chunk centres are exactly one chunk apart', () => {
    for (const scroll of [0, 1, 123.4, 399.9, 400, 8000.25]) {
      const layout = chunkLayout(scroll, 400, 4);
      for (let i = 1; i < layout.length; i++) {
        expect(layout[i - 1].z - layout[i].z).toBeCloseTo(400, 9);
      }
    }
  });

  it('moves the world toward +Z as the scroll grows, including across a recycle', () => {
    const zOf = (scroll, index) => chunkLayout(scroll, 400, 4).find((c) => c.chunkIndex === index).z;
    expect(zOf(1, 1) - zOf(0, 1)).toBeCloseTo(1, 9);
    expect(zOf(400.5, 2) - zOf(399.5, 2)).toBeCloseTo(1, 9);
    expect(chunkLayout(0, 400, 4)[1]).toEqual({ chunkIndex: 0, z: -200 });
  });

  it('keeps world-space values small for a long session by working relative to the base chunk', () => {
    const scroll = 400 * 1_000_000 + 123;
    for (const { z } of chunkLayout(scroll, 400, 4)) {
      expect(Math.abs(z)).toBeLessThanOrEqual(1200);
    }
  });

  it('recycles exactly one chunk when the scroll crosses a chunk boundary', () => {
    const before = new Set(chunkLayout(399.9, 400, 4).map((c) => c.chunkIndex));
    const after = new Set(chunkLayout(400, 400, 4).map((c) => c.chunkIndex));
    expect([...after].filter((i) => !before.has(i))).toEqual([3]);
    expect([...before].filter((i) => !after.has(i))).toEqual([-1]);
  });

  it('handles a negative scroll', () => {
    expect(chunkLayout(-1, 400, 4).map((c) => c.chunkIndex)).toEqual([-2, -1, 0, 1]);
  });
});

describe('generateChunkBuildings', () => {
  it('is deterministic for the same seed and chunk, and differs for another chunk or seed', () => {
    expect(generateChunkBuildings(1, 7)).toEqual(generateChunkBuildings(1, 7));
    expect(generateChunkBuildings(1, 7)).not.toEqual(generateChunkBuildings(1, 8));
    expect(generateChunkBuildings(1, 7)).not.toEqual(generateChunkBuildings(2, 7));
  });

  it('returns 40 buildings inside the chunk footprint with sane sizes', () => {
    expect(BUILDINGS_PER_CHUNK).toBe(40);
    for (const index of [-3, 0, 5]) {
      const buildings = generateChunkBuildings(1, index);
      expect(buildings).toHaveLength(40);
      for (const b of buildings) {
        expect(Math.abs(b.x)).toBeLessThanOrEqual(TERRAIN_WIDTH / 2);
        expect(Math.abs(b.z)).toBeLessThanOrEqual(CHUNK_LEN / 2);
        expect(b.w).toBeGreaterThan(0);
        expect(b.d).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
        expect(b.h).toBeLessThan(40); // tops stay below the gameplay plane (terrain sits at -40)
        expect(b.shade).toBeGreaterThanOrEqual(0);
        expect(b.shade).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leaves open lanes for later ground units', () => {
    for (let seed = 1; seed <= 5; seed++) {
      for (let index = -5; index <= 5; index++) {
        for (const b of generateChunkBuildings(seed, index)) {
          for (const lane of [-80, 0, 80]) {
            expect(Math.abs(b.x - lane)).toBeGreaterThanOrEqual(14 + b.w / 2 - 1e-9);
          }
        }
      }
    }
  });
});

describe('createTerrainRing', () => {
  function makeRing() {
    return createTerrainRing({ createCanvas: fakeCanvas });
  }
  const versions = (ring) => ring.group.children.map((chunk) => chunk.children[1].instanceMatrix.version);

  it('builds a ring of four chunks, each a ground plane plus one instanced building mesh', () => {
    const ring = makeRing();
    expect(CHUNK_COUNT).toBe(4);
    expect(ring.group.children).toHaveLength(4);
    for (const chunk of ring.group.children) {
      expect(chunk.children).toHaveLength(2);
      expect(chunk.children[0].isMesh).toBe(true);
      expect(chunk.children[1].isInstancedMesh).toBe(true);
      expect(chunk.children[1].count).toBe(40);
    }
    expect(ring.group.position.y).toBe(-40);
  });

  it('positions the chunks from the scroll', () => {
    const ring = makeRing();
    ring.update(0);
    expect(ring.group.children.map((c) => c.position.z).sort((a, b) => a - b)).toEqual([
      -1000, -600, -200, 200,
    ]);
    ring.update(50);
    expect(ring.group.children.map((c) => c.position.z).sort((a, b) => a - b)).toEqual([
      -950, -550, -150, 250,
    ]);
  });

  it('rewrites building matrices only when a slot gets a new chunk index', () => {
    const ring = makeRing();
    ring.update(0);
    const first = versions(ring);
    ring.update(37);
    expect(versions(ring)).toEqual(first);
    ring.update(399.9);
    expect(versions(ring)).toEqual(first);
    ring.update(400);
    const changed = versions(ring).filter((v, i) => v !== first[i]);
    expect(changed).toHaveLength(1);
  });

  it('exports the terrain depth and uses it as the default ground height', () => {
    expect(TERRAIN_DEPTH).toBe(-40);
    expect(makeRing().group.position.y).toBe(TERRAIN_DEPTH);
    expect(createTerrainRing({ createCanvas: fakeCanvas, depthY: -10 }).group.position.y).toBe(-10);
  });

  describe('detail (D-24, D-25)', () => {
    const buildings = (ring) => ring.group.children.map((chunk) => chunk.children[1]);
    const matrices = (ring) => buildings(ring).map((mesh) => Array.from(mesh.instanceMatrix.array));

    it('builds softened rounded boxes with smooth shading at high and mid', () => {
      for (const detail of ['high', 'mid']) {
        const ring = createTerrainRing({ createCanvas: fakeCanvas, detail });
        for (const mesh of buildings(ring)) {
          expect(mesh.geometry).toBeInstanceOf(RoundedBoxGeometry);
          expect(mesh.geometry.parameters.radius).toBeCloseTo(0.08);
          expect(mesh.material.flatShading).toBe(false);
        }
      }
      const high = buildings(createTerrainRing({ createCanvas: fakeCanvas, detail: 'high' }))[0];
      const mid = buildings(createTerrainRing({ createCanvas: fakeCanvas, detail: 'mid' }))[0];
      expect(high.geometry.parameters.segments).toBe(3);
      expect(mid.geometry.parameters.segments).toBe(2);
    });

    it('builds plain flat-shaded boxes at low', () => {
      const ring = createTerrainRing({ createCanvas: fakeCanvas, detail: 'low' });
      for (const mesh of buildings(ring)) {
        expect(mesh.geometry.type).toBe('BoxGeometry');
        expect(mesh.material.flatShading).toBe(true);
      }
    });

    it('starts at high by default and at low for an unknown detail', () => {
      expect(buildings(makeRing())[0].geometry).toBeInstanceOf(RoundedBoxGeometry);
      const odd = createTerrainRing({ createCanvas: fakeCanvas, detail: 'ultra' });
      expect(buildings(odd)[0].geometry.type).toBe('BoxGeometry');
    });

    it('setDetail swaps every chunk without regenerating building placement', () => {
      const ring = makeRing();
      ring.update(120);
      const before = matrices(ring);
      const versionsBefore = versions(ring);
      ring.setDetail('low');
      for (const mesh of buildings(ring)) {
        expect(mesh.geometry.type).toBe('BoxGeometry');
        expect(mesh.material.flatShading).toBe(true);
      }
      expect(matrices(ring)).toEqual(before);
      expect(versions(ring)).toEqual(versionsBefore);
    });

    it('setDetail reuses cached geometries and materials and never disposes them (Pitfall 8)', () => {
      const ring = makeRing();
      const highGeometry = buildings(ring)[0].geometry;
      const highMaterial = buildings(ring)[0].material;
      let disposed = 0;
      highGeometry.addEventListener('dispose', () => (disposed += 1));
      ring.setDetail('low');
      const lowGeometry = buildings(ring)[0].geometry;
      ring.setDetail('high');
      expect(buildings(ring)[0].geometry).toBe(highGeometry);
      expect(buildings(ring)[0].material).toBe(highMaterial);
      ring.setDetail('low');
      expect(buildings(ring)[0].geometry).toBe(lowGeometry);
      // All chunks share one geometry per detail.
      expect(new Set(buildings(ring).map((mesh) => mesh.geometry)).size).toBe(1);
      expect(disposed).toBe(0);
    });

    it('keeps the new detail across a chunk recycle', () => {
      const ring = makeRing();
      ring.setDetail('mid');
      ring.update(900);
      for (const mesh of buildings(ring)) expect(mesh.geometry.parameters.segments).toBe(2);
    });
  });
});
