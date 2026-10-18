import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import {
  buildBomber,
  buildBomberEngine,
  buildBomberOpen,
  buildBomberStump,
  buildBomberTurret,
} from '../../../src/render/models/bomber.js';
import {
  colours,
  expectGunmetal,
  expectNoBulletHue,
  expectRedNeon,
  hasColour,
} from '../../helpers/vertex_colours.js';

const DETAILS = ['high', 'mid', 'low'];
const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

function box(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

// The height at which a ray straight down at (x, z) first meets the geometry; null when it misses.
function surfaceAt(geometry, x, z) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  return hits.length === 0 ? null : hits[0].point.y;
}

// A magenta-white core vertex: bright in every channel, with green a little behind red and blue.
const isCore = ([r, g, b]) => r >= 4 && g >= 2 && b >= 3.5 && g < r;
const hasCore = (geometry) => colours(geometry).some(isCore);

describe.each([
  ['buildBomber', buildBomber],
  ['buildBomberOpen', buildBomberOpen],
  ['buildBomberTurret', buildBomberTurret],
  ['buildBomberEngine', buildBomberEngine],
  ['buildBomberStump', buildBomberStump],
])('%s', (name, build) => {
  it.each(DETAILS)('returns a lit body and a glow at %s detail', (detail) => {
    const model = build(detail);
    expect(model.body.isBufferGeometry).toBe(true);
    expect(model.glow.isBufferGeometry).toBe(true);
    expect(vertexCount(model.body)).toBeGreaterThan(0);
    expect(vertexCount(model.glow)).toBeGreaterThan(0);
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(build('high').body);
    const mid = vertexCount(build('mid').body);
    const low = vertexCount(build('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('is dark gunmetal in the body, never blooming at rest, and never orange-yellow', () => {
    for (const detail of DETAILS) {
      const model = build(detail);
      expect(channels(model.body).every((v) => v < 1)).toBe(true);
      expectGunmetal(model.body, `${name} body`);
      expectNoBulletHue(model.glow, `${name} glow`);
    }
  });

  it('never has a pink glow vertex, which belongs to the enemy bullets', () => {
    for (const [r, g, b] of colours(build('high').glow)) {
      expect(r > 1 && b > 1 && g < r * 0.5).toBe(false);
    }
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = build('high');
    const b = build('high');
    for (const part of ['body', 'glow', 'top']) {
      if (a[part] === null) {
        expect(b[part]).toBeNull();
        continue;
      }
      expect(Array.from(a[part].getAttribute('position').array)).toEqual(
        Array.from(b[part].getAttribute('position').array),
      );
    }
  });
});

describe.each([
  ['buildBomber', buildBomber],
  ['buildBomberOpen', buildBomberOpen],
])('the airframe from %s', (_name, build) => {
  it('has no turning top: the guns are separate BOMBER_TURRET rows', () => {
    for (const detail of DETAILS) expect(build(detail).top).toBeNull();
  });

  it('spans about 120 units wing tip to wing tip and is a flat wing, wider than it is long', () => {
    const { min, max } = box(build('high').body);
    expect(max.x - min.x).toBeGreaterThan(115);
    expect(max.x - min.x).toBeLessThan(125);
    expect((min.x + max.x) / 2).toBeCloseTo(0, 5);
    expect(max.z - min.z).toBeLessThan(max.x - min.x);
    expect(max.y - min.y).toBeLessThan(20);
  });

  it('has the wing under the turret positions at +-46 and the engine positions at +-26', () => {
    const body = build('high').body;
    const decks = [];
    for (const side of [-1, 1]) {
      decks.push(surfaceAt(body, side * 46, 6), surfaceAt(body, side * 26, -2));
    }
    for (const y of decks) expect(y).not.toBeNull();
    // One flat deck: the same height under all four parts.
    for (const y of decks) expect(y).toBeCloseTo(decks[0], 1);
    // And the turret stands on it.
    expect(box(buildBomberTurret('high').body).min.y).toBeCloseTo(decks[0], 1);
  });

  it('is mirror symmetric about the centre line', () => {
    const body = build('high').body;
    for (const z of [-10, 0, 10]) {
      expect(surfaceAt(body, 40, z) ?? 0).toBeCloseTo(surfaceAt(body, -40, z) ?? 0, 3);
    }
  });

  it('carries red neon strips along the wing edges, wide across the span, and never pink', () => {
    const { glow } = build('high');
    expectRedNeon(glow, 'bomber glow');
    expect(hasColour(glow, PALETTE.NEON_RED.rgb)).toBe(true);
    const { min, max } = box(glow);
    expect(max.x - min.x).toBeGreaterThan(100);
  });
});

describe('the open core', () => {
  it('glows with a bright magenta-white core that the closed bomber does not have', () => {
    for (const detail of DETAILS) {
      expect(hasCore(buildBomberOpen(detail).glow)).toBe(true);
      expect(hasCore(buildBomber(detail).glow)).toBe(false);
    }
  });

  it('keeps the core over the middle of the wing, between the engines', () => {
    const { glow } = buildBomberOpen('high');
    const position = glow.getAttribute('position');
    const color = glow.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
      if (!isCore([color.getX(i), color.getY(i), color.getZ(i)])) continue;
      expect(Math.abs(position.getX(i))).toBeLessThan(20);
    }
  });

  it('is a different airframe from the closed one: the armour is opened up', () => {
    expect(vertexCount(buildBomberOpen('high').body)).not.toBe(vertexCount(buildBomber('high').body));
  });
});

describe('buildBomberTurret', () => {
  it('has a gun top centred on the pivot so it can turn about Y, with the barrels toward +Z', () => {
    for (const detail of DETAILS) {
      const { top } = buildBomberTurret(detail);
      expect(top.isBufferGeometry).toBe(true);
      const { min, max } = box(top);
      // The low detail sphere has an odd number of segments, so it is only nearly symmetric.
      expect(Math.abs((min.x + max.x) / 2)).toBeLessThan(detail === 'high' ? 1e-5 : 0.3);
      expect(max.z).toBeGreaterThan(8);
      expect(min.z).toBeGreaterThan(-8);
    }
  });

  it('has strictly fewer gun vertices at each lower detail', () => {
    const count = (detail) => vertexCount(buildBomberTurret(detail).top);
    expect(count('high')).toBeGreaterThan(count('mid'));
    expect(count('mid')).toBeGreaterThan(count('low'));
  });

  it('keeps the gun gunmetal and below the bloom threshold', () => {
    const { top } = buildBomberTurret('high');
    expect(channels(top).every((v) => v < 1)).toBe(true);
    expectGunmetal(top, 'bomber turret gun');
  });

  it('matches the BOMBER_TURRET hitbox: half-extent between 0.7x and 1.6x the radius of 10', () => {
    const { min, max } = box(buildBomberTurret('high').body);
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(7);
      expect(half).toBeLessThan(16);
    }
  });

  it('mounts the gun above its base plate and glows red', () => {
    const turret = buildBomberTurret('high');
    expect(box(turret.top).max.y).toBeGreaterThan(box(turret.body).max.y);
    expectRedNeon(turret.glow, 'bomber turret glow');
  });
});

describe('buildBomberEngine', () => {
  it('has no turning top', () => {
    for (const detail of DETAILS) expect(buildBomberEngine(detail).top).toBeNull();
  });

  it('is a pod along the flight direction that matches the BOMBER_ENGINE radius of 12', () => {
    const { min, max } = box(buildBomberEngine('high').body);
    expect((max.z - min.z) / 2).toBeGreaterThan(8.4);
    expect((max.z - min.z) / 2).toBeLessThan(19.2);
    expect((max.x - min.x) / 2).toBeGreaterThan(3);
    expect((max.x - min.x) / 2).toBeLessThan(19.2);
    expect(max.z - min.z).toBeGreaterThan(max.x - min.x);
  });

  it('stands on the wing deck', () => {
    const wing = box(buildBomber('high').body);
    const engine = box(buildBomberEngine('high').body);
    const deck = surfaceAt(buildBomber('high').body, 26, -2);
    expect(engine.min.y).toBeGreaterThan(deck - 1.5);
    expect(engine.min.y).toBeLessThan(deck + 1.5);
    expect(engine.max.y).toBeLessThan(wing.max.y + 12);
  });

  it('glows with the red engine exhaust at the tail', () => {
    const { glow } = buildBomberEngine('high');
    expect(hasColour(glow, PALETTE.ENGINE.rgb)).toBe(true);
    const { min } = box(glow);
    expect(min.z).toBeLessThan(-8);
  });
});

describe('buildBomberStump', () => {
  it('has no turning top', () => {
    for (const detail of DETAILS) expect(buildBomberStump(detail).top).toBeNull();
  });

  it('sits at the wing deck height and is lower than the turret it replaced', () => {
    const stump = box(buildBomberStump('high').body);
    const turret = buildBomberTurret('high');
    expect(stump.min.y).toBeCloseTo(box(turret.body).min.y, 1);
    expect(stump.max.y).toBeLessThan(box(turret.top).max.y);
  });

  it('fits inside the BOMBER_STUMP radius of 6 closely enough to read as a stump', () => {
    const { min, max } = box(buildBomberStump('high').body);
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(4.2);
      expect(half).toBeLessThan(9.6);
    }
  });

  it('is charred, with a dim red ember glow that stays a glow', () => {
    const embers = colours(buildBomberStump('high').glow);
    expect(embers.some(([r, g, b]) => r > 1 && g < r * 0.3 && b < r * 0.3)).toBe(true);
    const peak = Math.max(...embers.map(([r]) => r));
    expect(peak).toBeLessThan(Math.max(...colours(buildBomberTurret('high').glow).map(([r]) => r)));
  });
});
