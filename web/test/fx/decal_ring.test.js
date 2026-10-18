import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDecalRing } from '../../src/fx/decal_ring.js';

const EVENTS = { EXPLOSION: 1, HIT: 2 };
const BLAST = { SMALL: 0, MEDIUM: 1, LARGE: 2 };
const W = 240;
const H = 320;
const RATIO = 0.94;

function build(options = {}) {
  const state = { scroll: 100 };
  const ring = createDecalRing({
    events: EVENTS,
    blast: BLAST,
    ratio: RATIO,
    getScroll: () => state.scroll,
    playfieldW: W,
    playfieldH: H,
    ...options,
  });
  return { ring, state, geometry: ring.mesh.geometry };
}

// The drawn marks as [x, y, size] triples, in draw order.
function drawn(ring) {
  const array = ring.mesh.geometry.getAttribute('aMark').array;
  const out = [];
  for (let i = 0; i < ring.mesh.geometry.instanceCount; i++) {
    out.push([array[i * 4], array[i * 4 + 1], array[i * 4 + 2]]);
  }
  return out;
}

describe('createDecalRing', () => {
  it('is one instanced draw below the shadows and the dim mask, never frustum-culled', () => {
    const { ring, geometry } = build();
    expect(ring.mesh.name).toBe('scorch-decals');
    expect(geometry.isInstancedBufferGeometry).toBe(true);
    expect(ring.mesh.frustumCulled).toBe(false);
    expect(ring.mesh.renderOrder).toBe(2);
    expect(geometry.instanceCount).toBe(0);
    expect(ring.live).toBe(0);
  });

  it('draws without writing depth, blends normally and offsets the polygons against the terrain', () => {
    const { material } = build().ring.mesh;
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.polygonOffsetUnits).toBeLessThan(0);
  });

  it('is a dark soft scorch with alpha up to 0.85', () => {
    const { uniforms } = build().ring.mesh.material;
    expect(uniforms.uColor.value.toArray()).toEqual([0.04, 0.035, 0.03]);
    expect(uniforms.uAlpha.value).toBe(0.85);
  });

  it('allocates one 48-slot instance buffer', () => {
    const { geometry } = build();
    expect(geometry.getAttribute('aMark').count).toBe(48);
  });

  it('scorches a ground MEDIUM kill at 16 and a ground LARGE kill at 24', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, BLAST.MEDIUM, 1, 3);
    ring.handle(EVENTS.EXPLOSION, 60, 80, BLAST.LARGE, 1, 4);
    ring.update(100);
    expect(ring.live).toBe(2);
    // newest first
    expect(drawn(ring)).toEqual([
      [60, 80, 24],
      [100, 50, 16],
    ]);
  });

  it('adds nothing for an air explosion, a SMALL blast, or another event', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, BLAST.LARGE, 0, 0);
    ring.handle(EVENTS.EXPLOSION, 100, 50, BLAST.SMALL, 1, 3);
    ring.handle(EVENTS.HIT, 100, 50, BLAST.LARGE, 1, 3);
    ring.update(100);
    expect(ring.live).toBe(0);
    expect(ring.mesh.geometry.instanceCount).toBe(0);
  });

  it('moves a mark down by the ground ratio times the scroll since the kill', () => {
    const { ring } = build();
    ring.handle(EVENTS.EXPLOSION, 100, 50, BLAST.MEDIUM, 1, 3);
    ring.update(100 + 50);
    expect(drawn(ring)[0][1]).toBeCloseTo(50 + RATIO * 50, 3);
  });

  it('records the scroll at each mark separately', () => {
    const { ring, state } = build();
    ring.add(10, 10, 16);
    state.scroll = 140;
    ring.add(10, 10, 16);
    ring.update(160);
    const marks = drawn(ring);
    expect(marks[0][1]).toBeCloseTo(10 + RATIO * 20, 3);
    expect(marks[1][1]).toBeCloseTo(10 + RATIO * 60, 3);
  });

  it('lets other plans add a mark of any size (the bomb)', () => {
    const { ring } = build();
    ring.add(120, 160, 40);
    ring.update(100);
    expect(drawn(ring)).toEqual([[120, 160, 40]]);
  });

  it('stops drawing a mark once its whole disc is below the bottom edge', () => {
    const { ring } = build();
    ring.add(100, 300, 16);
    // y = 300 + 0.94 * s; the disc leaves at y > 320 + 8 = 328
    ring.update(100 + 29.5);
    expect(ring.live).toBe(1);
    ring.update(100 + 30.5);
    expect(ring.live).toBe(0);
    expect(ring.mesh.geometry.instanceCount).toBe(0);
  });

  it('compacts the drawn marks when an older one has scrolled off', () => {
    const { ring, state } = build();
    ring.add(10, 300, 16);
    state.scroll = 200;
    ring.add(20, 20, 16);
    ring.update(200 + 40);
    expect(ring.live).toBe(1);
    expect(drawn(ring)[0][0]).toBe(20);
  });

  it('overwrites the oldest mark when the 49th arrives', () => {
    const { ring } = build();
    for (let i = 0; i < 48; i++) ring.add(i, 100, 16);
    ring.update(100);
    expect(ring.live).toBe(48);
    ring.add(500, 100, 16);
    ring.update(100);
    expect(ring.live).toBe(48);
    const xs = drawn(ring).map((mark) => mark[0]);
    expect(xs).not.toContain(0);
    expect(xs).toContain(500);
    expect(xs[0]).toBe(500);
  });

  it('uploads only the drawn range', () => {
    const { ring, geometry } = build();
    const attribute = geometry.getAttribute('aMark');
    const version = attribute.version;
    ring.update(100);
    expect(attribute.version).toBe(version);
    ring.add(10, 10, 16);
    ring.add(20, 10, 16);
    ring.update(100);
    expect(attribute.version).toBeGreaterThan(version);
    expect(attribute.updateRanges).toEqual([{ start: 0, count: 8 }]);
  });

  it('gives each mark a seeded seed, the same for the same rng', () => {
    const seedOf = (ring) => {
      ring.add(10, 10, 16);
      ring.update(100);
      return ring.mesh.geometry.getAttribute('aMark').array[3];
    };
    const a = seedOf(build().ring);
    const b = seedOf(build().ring);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('allocates nothing per update: the attribute array keeps its identity', () => {
    const { ring, geometry } = build();
    ring.add(10, 10, 16);
    ring.update(100);
    const attribute = geometry.getAttribute('aMark');
    const array = attribute.array;
    ring.update(101);
    ring.update(102);
    expect(geometry.getAttribute('aMark')).toBe(attribute);
    expect(attribute.array).toBe(array);
  });
});
