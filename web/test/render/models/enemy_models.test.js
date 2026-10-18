import { describe, expect, it } from 'vitest';
import { BUILDERS, enemyModel, hasModel, warmModels } from '../../../src/render/models/enemy_models.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;

describe('enemyModel', () => {
  it('returns the identical cached object for the same kind and detail', () => {
    expect(enemyModel('JET', 'mid')).toBe(enemyModel('JET', 'mid'));
  });

  it('caches each detail separately', () => {
    const high = enemyModel('JET', 'high');
    const low = enemyModel('JET', 'low');
    expect(high).not.toBe(low);
    expect(vertexCount(high.body)).toBeGreaterThan(vertexCount(low.body));
  });

  it('treats an unknown detail as the cheapest one', () => {
    expect(enemyModel('JET', 'bogus')).toBe(enemyModel('JET', 'low'));
  });

  it('throws an Error naming an unknown kind', () => {
    expect(() => enemyModel('BOGUS', 'mid')).toThrow(Error);
    expect(() => enemyModel('BOGUS', 'mid')).toThrow(/BOGUS/);
  });

  it('does not mistake an Object.prototype name for a kind', () => {
    expect(hasModel('constructor')).toBe(false);
    expect(() => enemyModel('toString', 'mid')).toThrow(/toString/);
  });
});

describe('every registered kind', () => {
  for (const name of Object.keys(BUILDERS)) {
    for (const detail of ['high', 'mid', 'low']) {
      it(`${name} at ${detail} builds a body and a glow`, () => {
        const model = enemyModel(name, detail);
        expect(vertexCount(model.body)).toBeGreaterThan(0);
        expect(model.glow === null || vertexCount(model.glow) > 0).toBe(true);
      });
    }

    it(`${name} is deterministic`, () => {
      const a = BUILDERS[name]('mid');
      const b = BUILDERS[name]('mid');
      expect(Array.from(a.body.getAttribute('position').array)).toEqual(
        Array.from(b.body.getAttribute('position').array),
      );
    });
  }
});

describe('TANK', () => {
  it('is cached per detail and has a turret top', () => {
    for (const detail of ['high', 'mid', 'low']) {
      expect(enemyModel('TANK', detail)).toBe(enemyModel('TANK', detail));
      expect(enemyModel('TANK', detail).top).not.toBeNull();
    }
  });

  it('has fewer body vertices at each lower detail', () => {
    const count = (detail) => vertexCount(enemyModel('TANK', detail).body);
    expect(count('high')).toBeGreaterThan(count('mid'));
    expect(count('mid')).toBeGreaterThan(count('low'));
  });
});

const MANIFEST_KINDS = ['JET', 'HELI', 'CARRIER', 'TANK', 'TURRET'];

describe('the manifest roster', () => {
  it('has a builder for every manifest kind, so no primitive shape is drawn', () => {
    for (const name of MANIFEST_KINDS) expect(hasModel(name)).toBe(true);
    expect(Object.keys(BUILDERS).sort()).toEqual([...MANIFEST_KINDS].sort());
  });

  it('warms every manifest kind', () => {
    expect(warmModels(MANIFEST_KINDS)).toEqual(MANIFEST_KINDS);
  });

  it('gives the ground kinds a top that can turn toward the player', () => {
    for (const name of ['TANK', 'TURRET']) {
      for (const detail of ['high', 'mid', 'low']) expect(enemyModel(name, detail).top).not.toBeNull();
    }
  });
});

describe('hasModel', () => {
  it('is true for kinds with a builder and false for the rest', () => {
    expect(hasModel('JET')).toBe(true);
    expect(hasModel('TANK')).toBe(true);
    expect(hasModel('MYSTERY')).toBe(false);
  });
});

describe('warmModels', () => {
  it('builds every detail of the kinds with a builder, skips the others and returns the warmed list', () => {
    const warmed = warmModels(['JET', 'MYSTERY', 'TANK']);
    expect(warmed).toEqual(['JET', 'TANK']);
    for (const detail of ['high', 'mid', 'low']) {
      expect(enemyModel('JET', detail)).toBe(enemyModel('JET', detail));
      expect(enemyModel('TANK', detail)).toBe(enemyModel('TANK', detail));
    }
  });

  it('warms nothing for an empty list', () => {
    expect(warmModels([])).toEqual([]);
  });
});
