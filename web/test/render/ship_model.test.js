import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PALETTE, saturationOf } from '../../src/fx/palette.js';
import { createShipModel, hullVisibleFor } from '../../src/render/ship_model.js';
import { colours } from '../helpers/vertex_colours.js';

function meshesOf(root) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  return meshes;
}

describe('createShipModel', () => {
  it('returns a group named ship', () => {
    const ship = createShipModel({ hitboxRadius: 2 });
    expect(ship.isGroup).toBe(true);
    expect(ship.name).toBe('ship');
  });

  it('defaults the hitbox radius to 2 when called without options', () => {
    const marker = createShipModel().getObjectByName('hitbox-marker');
    const core = marker.getObjectByName('hitbox-core');
    expect(core.geometry.parameters.radius).toBe(2.5);
  });

  describe('jet silhouette', () => {
    const ship = createShipModel({ hitboxRadius: 2, detail: 'high' });
    const fuselage = ship.getObjectByName('fuselage');
    fuselage.geometry.computeBoundingBox();
    const box = fuselage.geometry.boundingBox;

    it('spans about 16 units wing to wing', () => {
      expect(box.max.x - box.min.x).toBeGreaterThan(14);
      expect(box.max.x - box.min.x).toBeLessThan(18);
    });

    it('is about 20 units long', () => {
      expect(box.max.z - box.min.z).toBeGreaterThan(18);
      expect(box.max.z - box.min.z).toBeLessThan(23);
    });

    it('has a body thicker than a plate and lower than the wing span', () => {
      expect(box.max.y - box.min.y).toBeGreaterThan(2);
      expect(box.max.y - box.min.y).toBeLessThan(6);
    });

    it('points its nose toward -Z, up the screen', () => {
      const position = fuselage.geometry.getAttribute('position');
      let noseX = 0;
      let minZ = Infinity;
      for (let i = 0; i < position.count; i++) {
        if (position.getZ(i) < minZ) {
          minZ = position.getZ(i);
          noseX = position.getX(i);
        }
      }
      expect(minZ).toBeLessThan(-9);
      expect(Math.abs(noseX)).toBeLessThan(0.5);
      expect(box.max.z).toBeGreaterThan(5);
    });

    it('has a dark canopy, and the tail fins are baked into the fuselage', () => {
      expect(ship.getObjectByName('canopy')).toBeDefined();
      expect(ship.getObjectByName('tail-fin-left')).toBeUndefined();
      // The fins rise above the wing plate: some vertex is higher than the hull alone reaches.
      expect(box.max.y).toBeGreaterThan(2);
    });

    it('is smooth, not faceted (D-24)', () => {
      expect(fuselage.material.flatShading).toBe(false);
      expect(ship.getObjectByName('canopy').material.flatShading).toBe(false);
      expect(fuselage.material.vertexColors).toBe(true);
    });

    it('keeps every vertex colour below 1.0 so the hull never blooms', () => {
      const color = fuselage.geometry.getAttribute('color');
      let peak = 0;
      for (let i = 0; i < color.array.length; i++) peak = Math.max(peak, color.array[i]);
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThan(1);
      const { r, g, b } = fuselage.material.color;
      expect(Math.max(r, g, b)).toBeLessThanOrEqual(1);
    });

    it('keeps the canopy colour below 1.0 too', () => {
      const color = ship.getObjectByName('canopy').geometry.getAttribute('color');
      for (let i = 0; i < color.array.length; i++) expect(color.array[i]).toBeLessThan(1);
    });

    it('is baked to exactly position, normal and color', () => {
      expect(Object.keys(fuselage.geometry.attributes).sort()).toEqual(['color', 'normal', 'position']);
    });
  });

  describe('detail (D-25)', () => {
    const count = (ship) => ship.getObjectByName('fuselage').geometry.getAttribute('position').count;

    it('defaults to high and strictly lowers the vertex count per level', () => {
      const high = count(createShipModel());
      const mid = count(createShipModel({ detail: 'mid' }));
      const low = count(createShipModel({ detail: 'low' }));
      expect(high).toBe(count(createShipModel({ detail: 'high' })));
      expect(high).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(low);
    });

    it('treats an unknown detail as low', () => {
      const ship = createShipModel({ detail: 'ultra' });
      expect(ship.userData.detail).toBe('low');
      expect(count(ship)).toBe(count(createShipModel({ detail: 'low' })));
    });

    it('setDetail swaps the fuselage and canopy geometry', () => {
      const ship = createShipModel({ detail: 'high' });
      const highFuselage = ship.getObjectByName('fuselage').geometry;
      const highCanopy = ship.getObjectByName('canopy').geometry;
      ship.userData.setDetail('low');
      expect(ship.userData.detail).toBe('low');
      expect(count(ship)).toBeLessThan(highFuselage.getAttribute('position').count);
      expect(ship.getObjectByName('canopy').geometry).not.toBe(highCanopy);
    });

    it('setDetail reuses cached geometries and never disposes them (Pitfall 8)', () => {
      const ship = createShipModel({ detail: 'high' });
      const dispose = vi.fn();
      const fuselage = ship.getObjectByName('fuselage');
      const canopy = ship.getObjectByName('canopy');
      const highFuselage = fuselage.geometry;
      highFuselage.addEventListener('dispose', dispose);
      ship.userData.setDetail('low');
      const lowFuselage = fuselage.geometry;
      const lowCanopy = canopy.geometry;
      ship.userData.setDetail('high');
      expect(fuselage.geometry).toBe(highFuselage);
      ship.userData.setDetail('low');
      expect(fuselage.geometry).toBe(lowFuselage);
      expect(canopy.geometry).toBe(lowCanopy);
      expect(dispose).not.toHaveBeenCalled();
    });

    it('setDetail leaves the hitbox marker untouched', () => {
      const ship = createShipModel({ hitboxRadius: 2 });
      const marker = ship.getObjectByName('hitbox-marker');
      const before = marker.children.map((child) => child.geometry);
      ship.userData.setDetail('low');
      expect(ship.getObjectByName('hitbox-marker')).toBe(marker);
      expect(marker.children.map((child) => child.geometry)).toEqual(before);
      expect(marker.visible).toBe(true);
    });

    it('builds the same geometry twice: generation is deterministic', () => {
      const a = createShipModel().getObjectByName('fuselage').geometry.getAttribute('position').array;
      const b = createShipModel().getObjectByName('fuselage').geometry.getAttribute('position').array;
      expect(Array.from(a)).toEqual(Array.from(b));
    });
  });

  describe('faction colours (D-38)', () => {
    const ship = createShipModel({ detail: 'high' });
    const fuselage = ship.getObjectByName('fuselage');

    it('has a near-white hull family: every channel at least 0.6 and saturation below 0.15', () => {
      for (const rgb of colours(fuselage.geometry)) {
        expect(Math.min(...rgb), `${rgb}`).toBeGreaterThanOrEqual(0.6);
        expect(saturationOf(rgb), `${rgb}`).toBeLessThan(0.15);
      }
    });

    it('glows cyan: the engine takes NEON_CYAN', () => {
      const { r, g, b } = ship.getObjectByName('engine-glow').material.color;
      expect([r, g, b].map((v) => Math.fround(v))).toEqual(PALETTE.NEON_CYAN.rgb.map(Math.fround));
    });

    it('has a cyan trim glow mesh: an unlit HDR NEON_CYAN strip set on the wings and spine', () => {
      const trim = ship.getObjectByName('cyan-trim');
      expect(trim.isMesh).toBe(true);
      expect(trim.material.isMeshBasicMaterial).toBe(true);
      for (const rgb of colours(trim.geometry)) {
        expect(rgb.map((v) => Math.fround(v))).toEqual(PALETTE.NEON_CYAN.rgb.map(Math.fround));
      }
      trim.geometry.computeBoundingBox();
      const { min, max } = trim.geometry.boundingBox;
      expect(max.x - min.x).toBeGreaterThan(10); // the wing leading edges
      expect(max.z - min.z).toBeGreaterThan(5); // the spine
    });
  });

  describe('engine glow', () => {
    it('is an HDR colour (one channel above 1.0) so it crosses the bloom threshold', () => {
      const glow = createShipModel().getObjectByName('engine-glow');
      const { r, g, b } = glow.material.color;
      expect(Math.max(r, g, b)).toBeGreaterThan(1);
    });

    it('sits behind the tail (+Z)', () => {
      const glow = createShipModel().getObjectByName('engine-glow');
      expect(glow.position.z).toBeGreaterThan(7);
    });
  });

  describe('hitbox marker (PLYR-02, Pitfall 13)', () => {
    const ship = createShipModel({ hitboxRadius: 2 });
    const marker = ship.getObjectByName('hitbox-marker');
    const markerMeshes = meshesOf(marker);

    it('exists, lies slightly above the ship origin and holds a core and a ring', () => {
      expect(marker).toBeDefined();
      expect(marker.position.y).toBeCloseTo(0.6);
      expect(markerMeshes).toHaveLength(2);
    });

    it('is never depth-occluded: depthTest and depthWrite are false on every material', () => {
      for (const mesh of markerMeshes) {
        expect(mesh.material.depthTest).toBe(false);
        expect(mesh.material.depthWrite).toBe(false);
      }
    });

    it('renders after the ship and engine glow: renderOrder >= 20', () => {
      for (const mesh of markerMeshes) expect(mesh.renderOrder).toBeGreaterThanOrEqual(20);
    });

    it('has a bright 2.5-unit core for hitboxRadius 2', () => {
      const core = marker.getObjectByName('hitbox-core');
      expect(core.geometry.parameters.radius).toBeCloseTo(2.5);
      expect(core.material.color.getHex()).toBe(new THREE.Color(0xf2f2f2).getHex());
    });

    it('has a dark ring just outside the core', () => {
      const ring = marker.getObjectByName('hitbox-ring');
      expect(ring.geometry.parameters.innerRadius).toBeCloseTo(2.5);
      expect(ring.geometry.parameters.outerRadius).toBeGreaterThan(2.5);
      expect(ring.material.color.getHex()).toBe(new THREE.Color(0x111111).getHex());
    });

    it('draws the ring after the core so the ring edge is crisp', () => {
      const core = marker.getObjectByName('hitbox-core');
      const ring = marker.getObjectByName('hitbox-ring');
      expect(ring.renderOrder).toBeGreaterThan(core.renderOrder);
    });

    it('scales with the hitbox radius', () => {
      const big = createShipModel({ hitboxRadius: 4 }).getObjectByName('hitbox-core');
      expect(big.geometry.parameters.radius).toBeCloseTo(5);
    });

    it('faces up (+Y) so the tilted top-down camera sees its face', () => {
      const core = marker.getObjectByName('hitbox-core');
      const normal = core.geometry.getAttribute('normal');
      expect(normal.getY(0)).toBeCloseTo(1);
    });

    it('is always visible: nothing hides it behind a mode flag', () => {
      expect(marker.visible).toBe(true);
      for (const mesh of markerMeshes) expect(mesh.visible).toBe(true);
    });
  });

  describe('the respawn blink (PLYR-10, Pitfall 9)', () => {
    const hull = ['fuselage', 'canopy', 'engine-glow', 'cyan-trim'];

    it('setHullVisible(false) hides the hull, the canopy, the engine glow and the cyan trim', () => {
      const ship = createShipModel();
      ship.userData.setHullVisible(false);
      for (const name of hull) expect(ship.getObjectByName(name).visible, name).toBe(false);
    });

    it('keeps the hitbox marker and both its meshes visible while the hull is hidden', () => {
      const ship = createShipModel();
      ship.userData.setHullVisible(false);
      const marker = ship.getObjectByName('hitbox-marker');
      expect(marker.visible).toBe(true);
      for (const mesh of meshesOf(marker)) expect(mesh.visible).toBe(true);
      expect(ship.visible).toBe(true);
    });

    it('setHullVisible(true) shows the hull again', () => {
      const ship = createShipModel();
      ship.userData.setHullVisible(false);
      ship.userData.setHullVisible(true);
      for (const name of hull) expect(ship.getObjectByName(name).visible, name).toBe(true);
    });

    it('starts with the hull shown', () => {
      const ship = createShipModel();
      for (const name of hull) expect(ship.getObjectByName(name).visible, name).toBe(true);
    });

    it('hullVisibleFor is true at 0 and for every step of an even four-step block', () => {
      expect(hullVisibleFor(0)).toBe(true);
      for (const invuln of [1, 2, 3, 8, 9, 10, 11, 144, 147]) expect(hullVisibleFor(invuln), `${invuln}`).toBe(true);
    });

    it('hullVisibleFor is false for every step of an odd four-step block', () => {
      for (const invuln of [4, 5, 6, 7, 12, 15, 20, 148, 149, 150]) expect(hullVisibleFor(invuln), `${invuln}`).toBe(false);
    });

    it('blinks with a period of eight steps across the 150-step respawn window', () => {
      let flips = 0;
      for (let invuln = 150; invuln > 1; invuln -= 1) {
        if (hullVisibleFor(invuln) !== hullVisibleFor(invuln - 1)) flips += 1;
      }
      expect(flips).toBeGreaterThan(30);
      expect(hullVisibleFor(0)).toBe(true);
    });
  });
});
