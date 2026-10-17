import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createShipModel } from '../../src/render/ship_model.js';

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
    const ship = createShipModel({ hitboxRadius: 2 });
    const fuselage = ship.getObjectByName('fuselage');
    fuselage.geometry.computeBoundingBox();
    const box = fuselage.geometry.boundingBox;

    it('spans about 16 units wing to wing and is longer than it is wide only by the nose', () => {
      expect(box.max.x - box.min.x).toBeGreaterThan(14);
      expect(box.max.x - box.min.x).toBeLessThan(18);
    });

    it('is flat: thinner than 3 units', () => {
      expect(box.max.y - box.min.y).toBeGreaterThan(2);
      expect(box.max.y - box.min.y).toBeLessThan(3);
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

    it('has a dark canopy and tail fins', () => {
      expect(ship.getObjectByName('canopy')).toBeDefined();
      expect(ship.getObjectByName('tail-fin-left')).toBeDefined();
      expect(ship.getObjectByName('tail-fin-right')).toBeDefined();
    });

    it('keeps the fuselage albedo below 1.0 so it never blooms', () => {
      const { r, g, b } = fuselage.material.color;
      expect(Math.max(r, g, b)).toBeLessThan(1);
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
});
