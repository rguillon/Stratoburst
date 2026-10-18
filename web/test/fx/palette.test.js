import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BULLET_EXCLUSION_DEGREES,
  BULLET_MIN_SATURATION,
  PALETTE,
  hueDistance,
  hueOf,
  saturationOf,
} from '../../src/fx/palette.js';

describe('hueOf', () => {
  it('reads the primary and secondary hues', () => {
    expect(hueOf([1, 0, 0])).toBeCloseTo(0);
    expect(hueOf([1, 1, 0])).toBeCloseTo(60);
    expect(hueOf([0, 1, 0])).toBeCloseTo(120);
    expect(hueOf([0, 1, 1])).toBeCloseTo(180);
    expect(hueOf([0, 0, 1])).toBeCloseTo(240);
    expect(hueOf([1, 0, 1])).toBeCloseTo(300);
  });

  it('wraps a magenta-leaning red into the upper half of the circle', () => {
    expect(hueOf([1, 0, 0.5])).toBeCloseTo(330);
  });

  it('gives HDR colours the hue of their normalised form', () => {
    expect(hueOf([4, 2, 0])).toBeCloseTo(hueOf([1, 0.5, 0]));
    expect(hueOf([2.4, 3.2, 4.0])).toBeCloseTo(hueOf([0.6, 0.8, 1.0]));
  });

  it('is 0 for colours with no spread', () => {
    expect(hueOf([0, 0, 0])).toBe(0);
    expect(hueOf([3, 3, 3])).toBe(0);
  });
});

describe('saturationOf', () => {
  it('is 0 for black and greys and 1 for a pure hue', () => {
    expect(saturationOf([0, 0, 0])).toBe(0);
    expect(saturationOf([0.5, 0.5, 0.5])).toBe(0);
    expect(saturationOf([2, 0, 0])).toBe(1);
  });

  it('normalises by the largest channel, so HDR does not change it', () => {
    expect(saturationOf([4, 2, 0])).toBeCloseTo(saturationOf([1, 0.5, 0]));
    expect(saturationOf([1, 0.5, 0.5])).toBeCloseTo(0.5);
  });
});

describe('hueDistance', () => {
  it('is circular and symmetric', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(90, 90)).toBe(0);
    expect(hueDistance(30, 330)).toBe(60);
  });
});

describe('PALETTE', () => {
  const halo = PALETTE.ENEMY_BULLET_HALO.rgb;
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it('is frozen, all the way down', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true);
    expect(Object.isFrozen(PALETTE.FIRE)).toBe(true);
    expect(Object.isFrozen(PALETTE.FIRE.rgb)).toBe(true);
  });

  it('only uses the known roles', () => {
    const roles = new Set(['bullet', 'effect', 'weapon', 'pickup', 'scene', 'neutral']);
    for (const [name, { role }] of Object.entries(PALETTE)) {
      expect(roles.has(role), `${name} has role ${role}`).toBe(true);
    }
  });

  it('exports the reservation constants under their bullet names', () => {
    expect(BULLET_EXCLUSION_DEGREES).toBe(35);
    expect(BULLET_MIN_SATURATION).toBe(0.25);
  });

  it('keeps the enemy bullet halo orange-yellow and low dynamic range (it is drawn after bloom)', () => {
    const hue = hueOf(halo);
    expect(hue).toBeGreaterThanOrEqual(36);
    expect(hue).toBeLessThanOrEqual(46);
    expect(Math.max(...halo)).toBeLessThanOrEqual(0.98);
    expect(Math.max(...PALETTE.ENEMY_BULLET_CORE.rgb)).toBeLessThanOrEqual(0.98);
  });

  it('gives each orb layer a distinct luminance so it reads without hue: white core, dark rim', () => {
    expect(luma(PALETTE.ENEMY_BULLET_CORE.rgb)).toBeGreaterThan(luma(halo));
    expect(luma(halo)).toBeGreaterThan(luma(PALETTE.ENEMY_BULLET_RIM.rgb) * 3);
  });

  it('reserves orange-yellow: no saturated effect, weapon, pickup or scene colour is within 35 degrees of it', () => {
    const guarded = Object.entries(PALETTE).filter(([, { role }]) =>
      ['effect', 'weapon', 'pickup', 'scene'].includes(role),
    );
    expect(guarded.length).toBeGreaterThan(20);
    const offenders = guarded
      .filter(([, { rgb }]) => saturationOf(rgb) >= BULLET_MIN_SATURATION)
      .filter(([, { rgb }]) => hueDistance(hueOf(rgb), hueOf(halo)) < BULLET_EXCLUSION_DEGREES)
      .map(([name]) => name);
    expect(offenders, `colours too close to the enemy-bullet hue: ${offenders.join(', ')}`).toEqual([]);
  });

  it('moves fire and explosions off orange: white-hot core, red fire, magenta embers, cyan sparks', () => {
    expect(saturationOf(PALETTE.FIRE_CORE.rgb)).toBeLessThan(0.25);
    expect(hueDistance(hueOf(PALETTE.FIRE.rgb), 355)).toBeLessThanOrEqual(10);
    expect(hueDistance(hueOf(PALETTE.EMBER.rgb), 313)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.SPARK.rgb), 195)).toBeLessThanOrEqual(15);
  });

  it('retints the vulcan tracer and red crystal crimson, the bomb pickup acid green, the medal white-cyan', () => {
    expect(hueDistance(hueOf(PALETTE.VULCAN_TRACER.rgb), 350)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.CRYSTAL_RED.rgb), 350)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.BOMB_PICKUP.rgb), 114)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.MEDAL.rgb), 190)).toBeLessThanOrEqual(15);
  });

  it('defines the neon scene entries and the red beacon', () => {
    for (const name of [
      'NEON_CYAN',
      'NEON_MAGENTA',
      'NEON_RED',
      'NEON_VIOLET',
      'NEON_BLUE',
      'NEON_GREEN',
    ]) {
      expect(PALETTE[name]?.role, name).toBe('scene');
    }
    expect(PALETTE.BEACON_RED.role).toBe('effect');
    expect(PALETTE.BEACON_AMBER).toBeUndefined();
  });

  it('places the blue laser near 215 and the purple missiles near 257 degrees', () => {
    expect(hueOf(PALETTE.LASER_GLOW.rgb)).toBeGreaterThan(205);
    expect(hueOf(PALETTE.LASER_GLOW.rgb)).toBeLessThan(235);
    expect(hueOf(PALETTE.MISSILE.rgb)).toBeGreaterThan(245);
    expect(hueOf(PALETTE.MISSILE.rgb)).toBeLessThan(270);
  });
});

// The colour scan (RESEARCH Pitfall 10): PALETTE is only one of the places a colour lives, so the
// reservation is also enforced over every module in web/src and over the page CSS. The scanner is
// a pure function over a source string and a file name, so a fixture can prove it can fail.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
// Colour channels are never negative, so a position such as [120, 200, -160] is not a colour.
const NUMBER = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const CONSTANT = new RegExp(
  String.raw`^(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=\s*\[\s*${NUMBER}\s*,\s*${NUMBER}\s*,\s*${NUMBER}\s*\]`,
);
const SET_RGB = new RegExp(String.raw`setRGB\(\s*${NUMBER}\s*,\s*${NUMBER}\s*,\s*${NUMBER}\s*[,)]`, 'g');
// A line that hands a colour to three, a light, the fog, a canvas, a CSS colour or a background.
const COLOUR_CONTEXT = /Color\(|\w*Light\(|Fog\(|FogExp2\(|fillStyle|\bcolor\s*:|background/;
const HEX = /(?:0x|#)([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
const CSS_RGB = /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/g;

function offends(rgb) {
  const bullet = hueOf(PALETTE.ENEMY_BULLET_HALO.rgb);
  return (
    saturationOf(rgb) >= BULLET_MIN_SATURATION && hueDistance(hueOf(rgb), bullet) < BULLET_EXCLUSION_DEGREES
  );
}

function hexToRgb(digits) {
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

// Returns "file:line: text" for every saturated colour inside the bullet band.
function scanSource(source, file, { html = false } = {}) {
  const found = [];
  source.split('\n').forEach((text, index) => {
    const where = `${file}:${index + 1}: ${text.trim()}`;
    const rgbs = [];
    if (!html) {
      const constant = CONSTANT.exec(text.trim());
      if (constant) {
        const rgb = constant.slice(1, 4).map(Number);
        if (Math.max(...rgb) > 1) rgbs.push(rgb);
      }
      for (const match of text.matchAll(SET_RGB)) {
        const rgb = match.slice(1, 4).map(Number);
        if (Math.max(...rgb) > 1) rgbs.push(rgb);
      }
    }
    if (html || COLOUR_CONTEXT.test(text)) {
      for (const match of text.matchAll(HEX)) rgbs.push(hexToRgb(match[1]));
      for (const match of text.matchAll(CSS_RGB)) rgbs.push(match.slice(1, 4).map(Number));
    }
    if (rgbs.some(offends)) found.push(where);
  });
  return found;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

describe('colour scan', () => {
  it('scan: reports a deliberately out-of-band fixture so the scan can fail', () => {
    const fixture = [
      'const FLAME = [3.4, 1.6, 0.4];',
      'mesh.material.color.setRGB(3.0, 1.2, 0.4);',
      'const lamp = new THREE.PointLight(0xffaa00, 1);',
      "scene.fog = new THREE.FogExp2('#ff9a2e', 0.001);",
      "ctx.fillStyle = '#ffb347';",
      'const WARM = new THREE.Color(0xffa500);',
    ].join('\n');
    expect(scanSource(fixture, 'fixture.js')).toHaveLength(6);
    const page = '  color: rgb(255, 191, 32);\n  background: rgba(255, 122, 20, 0.7);\n  border: 1px solid #ff8a3d;';
    expect(scanSource(page, 'fixture.html', { html: true })).toHaveLength(3);
  });

  it('scan: passes in-band-safe colours: neon hues, greys, and LDR constants', () => {
    const fixture = [
      'const CYAN = [0.4, 3.2, 3.8];',
      'const HULL = [0.82, 0.85, 0.9];',
      'mesh.color.setRGB(1, 1, 1);',
      'scene.background = new THREE.Color(0x07061a);',
      "ctx.fillStyle = '#2b2b2d';",
      'const seed = mulberry32(0xb0b0b0);',
      'const LANES = [-80, 0, 80];',
      'const FILL_POSITION = [120, 200, -160];',
    ].join('\n');
    expect(scanSource(fixture, 'safe.js')).toEqual([]);
    expect(scanSource('color: #1bd7ff; background: rgba(7, 6, 26, 0.72); color: #fff;', 'safe.html', { html: true })).toEqual([]);
  });

  it('scan: no module in web/src has a saturated colour within 35 degrees of the enemy-bullet hue', () => {
    const files = sourceFiles(join(ROOT, 'web/src'));
    expect(files.length).toBeGreaterThan(30);
    const offenders = files.flatMap((path) =>
      scanSource(readFileSync(path, 'utf8'), relative(ROOT, path)),
    );
    expect(offenders, `colours in the enemy-bullet band:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('scan: index.html has no amber or orange left: every page colour is outside the band', () => {
    const page = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(page).toContain('rgb(57, 255, 35)');
    const offenders = scanSource(page, 'index.html', { html: true });
    expect(offenders, `colours in the enemy-bullet band:\n${offenders.join('\n')}`).toEqual([]);
  });
});
