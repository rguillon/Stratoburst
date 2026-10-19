import * as THREE from 'three';
import { NIGHT_SKY } from './night_rig.js';

// World-space dimming mask (D-07): one large square with a rectangular hole exactly the size of
// the playfield, laid flat just below the gameplay plane and drawn after the terrain. Seen
// through the fixed camera the hole is the playfield trapezoid, so the margins show the same
// terrain dimmed instead of black bars, for one overdraw of the margin area only.
export function createPlayfieldMask({
  halfW = 120,
  halfH = 160,
  extent = 3000,
  y = -0.5,
  opacity = 0.55,
} = {}) {
  const group = new THREE.Group();
  group.name = 'playfield-mask';

  const shape = new THREE.Shape();
  shape.moveTo(-extent, -extent);
  shape.lineTo(extent, -extent);
  shape.lineTo(extent, extent);
  shape.lineTo(-extent, extent);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-halfW, -halfH);
  hole.lineTo(-halfW, halfH);
  hole.lineTo(halfW, halfH);
  hole.lineTo(halfW, -halfH);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2); // shape XY -> world XZ, facing up
  const mask = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: NIGHT_SKY,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mask.name = 'playfield-dim';
  mask.position.y = y;
  mask.renderOrder = 5;
  group.add(mask);

  // The outline sits below the bloom threshold (a cool violet-grey): it marks the edge without glowing.
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0, -halfH),
      new THREE.Vector3(halfW, 0, -halfH),
      new THREE.Vector3(halfW, 0, halfH),
      new THREE.Vector3(-halfW, 0, halfH),
    ]),
    new THREE.LineBasicMaterial({ color: 0x3a3f6b }),
  );
  outline.name = 'playfield-outline';
  outline.position.y = 0.05;
  outline.renderOrder = 6;
  group.add(outline);

  return group;
}
