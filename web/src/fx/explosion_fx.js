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

// Emitter fields: layer, count (at full quality), life [min, max] s, speed [min, max] world
// units/s, size [start, end], HDR colour, gravity scale (negative rises) and spread (share of the
// speed thrown upward; 0 keeps the burst flat on the ground plane).
function emitter(layer, count, life, speed, size, color, gravity = 0, spread = 0) {
  return Object.freeze({ layer, count, life, speed, size, color, gravity, spread });
}

const CORE = (size, life, color) => emitter('additive', 1, [life, life], [0, 0], size, color);
const SPARKS = (count) => emitter('additive', count, [0.35, 0.6], [30, 70], [2.5, 0.5], [3.2, 2.2, 0.9]);
const FIRE = (count, speed, size, life) =>
  emitter('additive', count, life, speed, size, [3.4, 1.6, 0.4], 0, 0.3);
const SMOKE = (count) =>
  emitter('normal', count, [1.0, 1.6], [8, 20], [6, 16], [0.18, 0.16, 0.15], -0.15, 0.4);

// Keyed by the manifest blast class names (SMALL, MEDIUM, LARGE).
export const RECIPES = Object.freeze({
  SMALL: Object.freeze([
    CORE([10, 18], 0.18, [4.0, 2.6, 1.2]),
    SPARKS(20),
    emitter('additive', 6, [0.6, 0.9], [10, 25], [2, 0.6], [3.0, 1.4, 0.4], 0.3, 0.5),
  ]),
  MEDIUM: Object.freeze([
    CORE([18, 30], 0.25, [4.0, 2.4, 1.0]),
    FIRE(16, [15, 40], [6, 12], [0.5, 0.8]),
    SPARKS(10),
    SMOKE(10),
  ]),
  LARGE: Object.freeze([
    CORE([26, 44], 0.32, [4.0, 2.4, 1.0]),
    FIRE(30, [20, 55], [8, 16], [0.6, 1.0]),
    SMOKE(18),
    emitter('normal', 14, [0.8, 1.4], [30, 60], [3, 2], [0.12, 0.1, 0.09], 1, 0.9),
    SPARKS(12),
  ]),
});

export const HIT_RECIPE = Object.freeze([
  emitter('additive', 4, [0.12, 0.2], [25, 45], [2, 0.4], [3, 3, 3]),
]);

// `toWorld(x, y, ground, out)` places a logical point in the world: on the gameplay plane for an air
// event, or in the ground layer (on the terrain, where the unit was drawn) when `ground` is set.
// `groundKinds` is the Set of kind values drawn in the ground layer; a HIT carries its kind.
export function createExplosionFx({
  layers,
  events,
  blast,
  toWorld,
  getScale = () => 1,
  rng = mulberry32(0x5c0c7ed),
  groundKinds = new Set(),
}) {
  const byBlast = new Map(Object.keys(RECIPES).map((name) => [blast[name], RECIPES[name]]));

  function between(range) {
    return range[0] + (range[1] - range[0]) * rng();
  }

  function burst(emitters, x, y, ground) {
    toWorld(x, y, ground, scratch);
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

  function handle(type, x, y, a, b) {
    if (type === events.EXPLOSION) {
      const emitters = byBlast.get(a);
      if (emitters) burst(emitters, x, y, b);
    } else if (type === events.HIT) {
      burst(HIT_RECIPE, x, y, groundKinds.has(a) ? 1 : 0);
    }
  }

  return { handle };
}
