import * as THREE from 'three';

// Flat outlines shared by the code-built aircraft (VISL-01). Both builders are deterministic.

// A closed polygon through `points`, each an [x, y] pair.
export function polygonShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

// A left-right symmetric outline from its right half. The half runs from the centre line at one
// end to the centre line at the other; the left side is the mirror image, walked back.
export function mirroredShape(halfOutline) {
  const left = halfOutline
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y]);
  return polygonShape([...halfOutline, ...left]);
}
