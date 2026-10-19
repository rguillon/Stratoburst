import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import { buildTrain, buildTrainStump, buildTrainTurret } from '../../../src/render/models/train.js';
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

describe.each([
  ['buildTrain', buildTrain],
  ['buildTrainTurret', buildTrainTurret],
  ['buildTrainStump', buildTrainStump],
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

describe('buildTrain', () => {
  it('has no turning top: the guns are separate TRAIN_TURRET rows', () => {
    for (const detail of DETAILS) expect(buildTrain(detail).top).toBeNull();
  });

  it('spans about 64 units along its heading, so the turret parts at +-22 sit on it', () => {
    const { min, max } = box(buildTrain('high').body);
    expect(max.z - min.z).toBeGreaterThan(60);
    expect(max.z - min.z).toBeLessThan(68);
    expect(min.z).toBeLessThan(-22);
    expect(max.z).toBeGreaterThan(22);
    expect((min.z + max.z) / 2).toBeCloseTo(0, 0);
  });

  it('is a long low hull: much longer than wide and kept low', () => {
    const { min, max } = box(buildTrain('high').body);
    expect(max.z - min.z).toBeGreaterThan(2.5 * (max.x - min.x));
    expect(max.y - min.y).toBeLessThan(12);
    expect((min.x + max.x) / 2).toBeCloseTo(0, 5);
    expect(max.x - min.x).toBeLessThan(2 * 28); // inside the hull circle of radius 28
  });

  it('carries red neon strips along its length and a red beacon, and never pink', () => {
    const { glow } = buildTrain('high');
    expectRedNeon(glow, 'train glow');
    expect(hasColour(glow, PALETTE.NEON_RED.rgb)).toBe(true);
    const { min, max } = box(glow);
    expect(max.z - min.z).toBeGreaterThan(50);
  });

  it('gives each turret mount a flat deck at the height the turret parts sit on', () => {
    const { max } = box(buildTrain('high').body);
    const turret = box(buildTrainTurret('high').body);
    expect(turret.min.y).toBeGreaterThan(max.y - 2.5);
    expect(turret.min.y).toBeLessThan(max.y + 1);
  });
});

describe('buildTrainTurret', () => {
  it('has a gun top centred on the pivot so it can turn about Y, with the barrels toward +Z', () => {
    for (const detail of DETAILS) {
      const { top } = buildTrainTurret(detail);
      expect(top.isBufferGeometry).toBe(true);
      const { min, max } = box(top);
      // The low detail sphere has an odd number of segments, so it is only nearly symmetric.
      expect(Math.abs((min.x + max.x) / 2)).toBeLessThan(detail === 'high' ? 1e-5 : 0.3);
      expect(max.z).toBeGreaterThan(8);
      expect(min.z).toBeGreaterThan(-8);
    }
  });

  it('has strictly fewer gun vertices at each lower detail', () => {
    const count = (detail) => vertexCount(buildTrainTurret(detail).top);
    expect(count('high')).toBeGreaterThan(count('mid'));
    expect(count('mid')).toBeGreaterThan(count('low'));
  });

  it('keeps the gun gunmetal and below the bloom threshold', () => {
    const { top } = buildTrainTurret('high');
    expect(channels(top).every((v) => v < 1)).toBe(true);
    expectGunmetal(top, 'train turret gun');
  });

  it('matches the TRAIN_TURRET hitbox: half-extent between 0.7x and 1.6x the radius of 11', () => {
    const { min, max } = box(buildTrainTurret('high').body);
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(7.7);
      expect(half).toBeLessThan(17.6);
    }
  });

  it('mounts the gun above its base plate and glows red', () => {
    const turret = buildTrainTurret('high');
    expect(box(turret.top).max.y).toBeGreaterThan(box(turret.body).max.y);
    expectRedNeon(turret.glow, 'train turret glow');
  });
});

describe('buildTrainStump', () => {
  it('has no turning top', () => {
    for (const detail of DETAILS) expect(buildTrainStump(detail).top).toBeNull();
  });

  it('sits at the turret mount height and is lower than the turret it replaced', () => {
    const stump = box(buildTrainStump('high').body);
    const turret = box(buildTrainTurret('high').body);
    expect(stump.min.y).toBeCloseTo(turret.min.y, 1);
    expect(stump.max.y).toBeLessThan(box(buildTrainTurret('high').top).max.y);
  });

  it('is charred, with a dim red ember glow that stays a glow', () => {
    const { glow } = buildTrainStump('high');
    const embers = colours(glow);
    expect(embers.some(([r, g, b]) => r > 1 && g < r * 0.3 && b < r * 0.3)).toBe(true);
    // Dimmer than the live turret's neon.
    const peak = Math.max(...embers.map(([r]) => r));
    expect(peak).toBeLessThan(Math.max(...colours(buildTrainTurret('high').glow).map(([r]) => r)));
  });
});
