import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBossSweep, silhouetteAlpha } from '../../src/fx/boss_sweep.js';
import { PALETTE } from '../../src/fx/palette.js';
import { TERRAIN_DEPTH } from '../../src/render/ground_layer.js';

const FLOW_STATES = { INTRO: 0, PLAY: 1, MIDBOSS: 2, WARNING: 3, BOSS: 4, CLEAR: 5 };
const W = 240;
const H = 320;
const OVERHEAD_SUN = new THREE.Vector3(0, 100, 0);

function build(extra = {}) {
  return createBossSweep({
    playfieldW: W,
    playfieldH: H,
    flowStates: FLOW_STATES,
    sunPosition: OVERHEAD_SUN,
    ...extra,
  });
}

// The logical y the sweep is at, read back from its world z (the sun is overhead, so there is no offset).
const logicalY = (sweep) => sweep.mesh.position.z + H / 2;

describe('createBossSweep', () => {
  it('is one flat, transparent, dark silhouette at terrain depth, drawn with the air shadows', () => {
    const { mesh } = build();
    expect(mesh.isMesh).toBe(true);
    expect(mesh.name).toBe('boss-sweep');
    expect(mesh.frustumCulled).toBe(false);
    // Above the scorch marks (2), below the dim mask (5): the same slot as the air shadows.
    expect(mesh.renderOrder).toBe(3);
    const { material } = mesh;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.color.toArray()).toEqual(new THREE.Color().setRGB(...PALETTE.SHADOW.rgb).toArray());
    expect(material.alphaMap).not.toBeNull();
    const heights = Array.from(mesh.geometry.getAttribute('position').array).filter((_, k) => k % 3 === 1);
    expect(Math.max(...heights.map(Math.abs))).toBeLessThan(1e-6);
    expect(mesh.position.y).toBeCloseTo(TERRAIN_DEPTH + 0.3, 4);
  });

  it('is visible only while FLOW is WARNING', () => {
    const sweep = build();
    expect(sweep.mesh.visible).toBe(false);
    for (const [name, value] of Object.entries(FLOW_STATES)) {
      sweep.update(value, 0.5);
      expect(sweep.mesh.visible, name).toBe(name === 'WARNING');
    }
    sweep.update(-1, 0.5); // the gallery
    expect(sweep.mesh.visible).toBe(false);
  });

  it('goes from below the playfield at FLOW_T 0 to above it at FLOW_T 1, driven by FLOW_T', () => {
    const sweep = build();
    sweep.update(FLOW_STATES.WARNING, 0);
    expect(logicalY(sweep)).toBeCloseTo(H + 120, 4);
    sweep.update(FLOW_STATES.WARNING, 1);
    expect(logicalY(sweep)).toBeCloseTo(-120, 4);
    sweep.update(FLOW_STATES.WARNING, 0.5);
    expect(logicalY(sweep)).toBeCloseTo((H + 120 + -120) / 2, 4);
    // Monotone: always moving up the screen as the WARNING goes on.
    let previous = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      sweep.update(FLOW_STATES.WARNING, t);
      expect(logicalY(sweep)).toBeLessThan(previous);
      previous = logicalY(sweep);
    }
  });

  it('crosses the whole playfield: on screen in the middle, off screen at both ends', () => {
    const sweep = build();
    const half = sweep.size.depth / 2;
    sweep.update(FLOW_STATES.WARNING, 0);
    expect(logicalY(sweep) - half).toBeGreaterThan(H); // wholly below the bottom edge
    sweep.update(FLOW_STATES.WARNING, 1);
    expect(logicalY(sweep) + half).toBeLessThan(0); // wholly above the top edge
  });

  it('clamps an out-of-range or broken FLOW_T', () => {
    const sweep = build();
    sweep.update(FLOW_STATES.WARNING, 7);
    expect(logicalY(sweep)).toBeCloseTo(-120, 4);
    sweep.update(FLOW_STATES.WARNING, -3);
    expect(logicalY(sweep)).toBeCloseTo(H + 120, 4);
    sweep.update(FLOW_STATES.WARNING, Number.NaN);
    expect(logicalY(sweep)).toBeCloseTo(H + 120, 4);
  });

  it('is centred on the middle column', () => {
    const sweep = build();
    sweep.update(FLOW_STATES.WARNING, 0.5);
    expect(sweep.mesh.position.x).toBeCloseTo(0, 6);
  });

  it('is displaced along the sun direction like the air shadows, by the altitude', () => {
    const sweep = build({ sunPosition: new THREE.Vector3(-120, 300, 160), altitude: 40 });
    sweep.update(FLOW_STATES.WARNING, 0.5);
    expect(sweep.mesh.position.x).toBeCloseTo((120 / 300) * 40, 4);
    // Half way through the WARNING the sweep is at logical y H / 2, the world z of 0.
    expect(sweep.mesh.position.z).toBeCloseTo((-160 / 300) * 40, 4);
  });

  it('is wider than the 120-unit bomber wing, so the shadow of the whole airframe fits', () => {
    expect(build().size.width).toBeGreaterThan(120);
  });

  it('allocates nothing per frame: the same objects are reused', () => {
    const sweep = build();
    const { position } = sweep.mesh;
    const { material } = sweep.mesh;
    for (let t = 0; t < 1; t += 0.05) sweep.update(FLOW_STATES.WARNING, t);
    expect(sweep.mesh.position).toBe(position);
    expect(sweep.mesh.material).toBe(material);
  });

  it('can be shown once while the shaders compile, then hidden by the next update', () => {
    const sweep = build();
    sweep.update(FLOW_STATES.WARNING, 0.5);
    expect(sweep.mesh.visible).toBe(true);
    sweep.update(-1, 0);
    expect(sweep.mesh.visible).toBe(false);
  });
});

describe('silhouetteAlpha', () => {
  it('is solid over the middle of the wing and clear far outside it', () => {
    expect(silhouetteAlpha(0, 0)).toBe(1);
    expect(silhouetteAlpha(40, 0)).toBe(1);
    expect(silhouetteAlpha(0, 60)).toBe(0);
    expect(silhouetteAlpha(100, 0)).toBe(0);
    expect(silhouetteAlpha(60, 40)).toBe(0);
  });

  it('is mirror symmetric about the centre line', () => {
    for (const [x, y] of [[20, 5], [45, 0], [58, 4], [30, -10], [12, 22]]) {
      expect(silhouetteAlpha(-x, y)).toBeCloseTo(silhouetteAlpha(x, y), 9);
    }
  });

  it('has a soft edge: partial alpha right on the outline', () => {
    // The leading edge runs from (10, 25) to (60, 8): at x = 35 it is at y = 16.5.
    const edge = silhouetteAlpha(35, 16.5);
    expect(edge).toBeGreaterThan(0.2);
    expect(edge).toBeLessThan(0.8);
    expect(silhouetteAlpha(35, 14)).toBeGreaterThan(edge);
    expect(silhouetteAlpha(35, 19)).toBeLessThan(edge);
  });

  it('is a flying wing: much wider than it is deep', () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let x = -90; x <= 90; x += 1) {
      for (let y = -50; y <= 50; y += 1) {
        if (silhouetteAlpha(x, y) < 0.5) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    expect(maxX - minX).toBeGreaterThan(110);
    expect(maxX - minX).toBeLessThan(130);
    expect(maxY - minY).toBeLessThan(maxX - minX);
    expect(maxY).toBeGreaterThan(20); // the nose is on the +y side
    expect(minY).toBeLessThan(-12);
  });
});
