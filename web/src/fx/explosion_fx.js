// Turns EXPLOSION (and HIT) events into particle bursts. The recipes are data keyed by the
// manifest blast classes; `emitters` of a recipe list how many particles of which look go on
// which layer. Colours are HDR (>1) so they cross the bloom threshold; none sit in the hot-pink
// band around 330 degrees that belongs to enemy bullets.
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const scratch = new THREE.Vector3();

// A seeded mulberry32 so tests (and replays of the visuals) are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CORE_SMALL = {
  layer: 'additive',
  count: 1,
  life: [0.18, 0.18],
  speed: [0, 0],
  size: [10, 18],
  color: [4.0, 2.6, 1.2],
  gravity: 0,
  spread: 0,
};
const SPARKS_SMALL = {
  layer: 'additive',
  count: 20,
  life: [0.35, 0.6],
  speed: [30, 70],
  size: [2.5, 0.5],
  color: [3.2, 2.2, 0.9],
  gravity: 0,
  spread: 0,
};

// Keyed by blast class value (filled from the manifest in createExplosionFx).
export const RECIPES = Object.freeze({
  SMALL: Object.freeze([CORE_SMALL, SPARKS_SMALL]),
});

export function createExplosionFx({ layers, events, blast, toWorld, getScale = () => 1, rng = mulberry32(0x5c0c7ed) }) {
  const byBlast = new Map([[blast.SMALL, RECIPES.SMALL]]);

  function between(range) {
    return range[0] + (range[1] - range[0]) * rng();
  }

  function burst(emitters, x, y) {
    toWorld(x, y, scratch);
    const scale = getScale();
    for (let k = 0; k < emitters.length; k += 1) {
      const e = emitters[k];
      const layer = layers[e.layer];
      const count = Math.max(1, Math.round(e.count * scale));
      for (let i = 0; i < count; i += 1) {
        const angle = rng() * TWO_PI;
        const speed = between(e.speed);
        layer.emit(
          scratch.x,
          scratch.y,
          scratch.z,
          Math.cos(angle) * speed,
          speed * e.spread * rng(),
          Math.sin(angle) * speed,
          between(e.life),
          e.size[0],
          e.size[1],
          e.color[0],
          e.color[1],
          e.color[2],
          e.gravity,
        );
      }
    }
  }

  function handle(type, x, y, a) {
    if (type === events.EXPLOSION) {
      const emitters = byBlast.get(a);
      if (emitters) burst(emitters, x, y);
    }
  }

  return { handle };
}
