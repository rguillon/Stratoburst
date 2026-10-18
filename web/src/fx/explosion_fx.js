// Turns EXPLOSION, HIT, PICKUP and MEDAL events into particle bursts. The recipes are data keyed by the
// manifest blast classes; `emitters` of a recipe list how many particles of which look go on
// which layer. Every colour comes from PALETTE, whose test keeps saturated colours out of the
// orange-yellow band around 40 degrees that belongs to enemy bullets (D-39).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

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
// A `ring` emitter spaces its particles evenly around the circle instead of at random angles.
function emitter(layer, count, life, speed, size, color, gravity = 0, spread = 0, ring = false) {
  return Object.freeze({ layer, count, life, speed, size, color, gravity, spread, ring });
}

const CORE = (size, life, color) => emitter('additive', 1, [life, life], [0, 0], size, color);
const SPARKS = (count) =>
  emitter('additive', count, [0.35, 0.6], [30, 70], [2.5, 0.5], PALETTE.SPARK.rgb);
const FIRE = (count, speed, size, life) =>
  emitter('additive', count, life, speed, size, PALETTE.FIRE.rgb, 0, 0.3);
const SMOKE = (count) =>
  emitter('normal', count, [1.0, 1.6], [8, 20], [6, 16], PALETTE.SMOKE.rgb, -0.15, 0.4);

// A ring spaces its particles evenly around the circle, flat on the ground plane: the white ring of the
// ship's hit and death (PLYR-06) and of the boss's final blast (D-14).
const WHITE_RING = (count, life, speed) =>
  emitter('additive', count, life, speed, [2.5, 0.5], PALETTE.HIT_SPARK.rgb, 0, 0, true);

// Keyed by the manifest blast class names (SMALL, MEDIUM, LARGE, HUGE).
export const RECIPES = Object.freeze({
  SMALL: Object.freeze([
    CORE([10, 18], 0.18, PALETTE.FIRE_CORE.rgb),
    SPARKS(20),
    emitter('additive', 6, [0.6, 0.9], [10, 25], [2, 0.6], PALETTE.EMBER.rgb, 0.3, 0.5),
  ]),
  MEDIUM: Object.freeze([
    CORE([18, 30], 0.25, PALETTE.FIRE_CORE.rgb),
    FIRE(16, [15, 40], [6, 12], [0.5, 0.8]),
    SPARKS(10),
    SMOKE(10),
  ]),
  LARGE: Object.freeze([
    CORE([26, 44], 0.32, PALETTE.FIRE_CORE.rgb),
    FIRE(30, [20, 55], [8, 16], [0.6, 1.0]),
    SMOKE(18),
    emitter('normal', 14, [0.8, 1.4], [30, 60], [3, 2], PALETTE.DEBRIS.rgb, 1, 0.9),
    SPARKS(12),
  ]),
  // The boss's death (D-14), the biggest blast in the game: a core nearly twice LARGE's, a fireball of
  // 60 over a wall of smoke and falling debris, cyan sparks, magenta embers and a white ring of 24.
  // Counts scale with the tier and the layers keep their fixed capacities, so it cannot grow a buffer
  // (T-03-25); sizes never scale.
  HUGE: Object.freeze([
    CORE([46, 80], 0.45, PALETTE.FIRE_CORE.rgb),
    FIRE(60, [25, 80], [10, 22], [0.8, 1.4]),
    SMOKE(36),
    emitter('normal', 28, [1.0, 1.8], [35, 80], [3, 2], PALETTE.DEBRIS.rgb, 1, 0.9),
    SPARKS(30),
    emitter('additive', 20, [0.8, 1.4], [15, 45], [3, 0.8], PALETTE.EMBER.rgb, 0.3, 0.5),
    WHITE_RING(24, [0.5, 0.8], [70, 95]),
  ]),
});

// A destroyed city target (D-33, D-40) throws electrical sparks on top of its blast: a white-hot flash,
// cyan sparks and magenta embers. Counts scale with the tier like every recipe (T-03-21).
export const CITY_SPARKS = Object.freeze([
  CORE([14, 26], 0.2, PALETTE.FIRE_CORE.rgb),
  emitter('additive', 24, [0.4, 0.8], [35, 80], [2.8, 0.5], PALETTE.SPARK.rgb, 0.3, 0.6),
  emitter('additive', 12, [0.6, 1.0], [12, 30], [2.4, 0.6], PALETTE.EMBER.rgb, 0.3, 0.5),
]);

export const HIT_RECIPE = Object.freeze([
  emitter('additive', 4, [0.12, 0.2], [25, 45], [2, 0.4], PALETTE.HIT_SPARK.rgb),
]);

// The player's ship (PLYR-06): a fatal hit flashes a quick white ring as the grace-window warning,
// and the death is a LARGE-sized fireball plus a bigger ring of 16 white sparks. Counts scale with
// the tier like every recipe; the sizes never do.
export const PLAYER_HIT_RECIPE = Object.freeze([WHITE_RING(10, [0.15, 0.22], [35, 45])]);
export const PLAYER_DEATH_RECIPE = Object.freeze([...RECIPES.LARGE, WHITE_RING(16, [0.5, 0.7], [55, 70])]);

// Catching a pickup: a short ring of sparkles that flies outward flat on the plane. The colour is the
// caught pickup's, so the recipe's own colour is only a placeholder that `colorFor` replaces.
export const PICKUP_RECIPE = Object.freeze([
  emitter('additive', 10, [0.3, 0.3], [30, 60], [3, 0.8], PALETTE.SPARK.rgb),
]);

// The palette crystal entry for each colour index of Python's cycle (0 red, 1 blue, 2 purple).
const CRYSTAL_COLORS = Object.freeze([PALETTE.CRYSTAL_RED, PALETTE.CRYSTAL_BLUE, PALETTE.CRYSTAL_PURPLE]);

// `toWorld(x, y, ground, out)` places a logical point in the world: on the gameplay plane for an air
// event, or in the ground layer (on the terrain, where the unit was drawn) when `ground` is set.
// `groundKinds` is the Set of kind values drawn in the ground layer; a HIT carries its kind.
// `pickupKinds` is the manifest's pickup name -> value map; only BOMB needs a colour of its own.
// `cityKinds` is the Set of kind values that are city targets: their EXPLOSION adds CITY_SPARKS.
export function createExplosionFx({
  layers,
  events,
  blast,
  pickupKinds = {},
  toWorld,
  getScale = () => 1,
  rng = mulberry32(0x5c0c7ed),
  groundKinds = new Set(),
  cityKinds = new Set(),
}) {
  let cityBursts = 0;
  const byBlast = new Map(Object.keys(RECIPES).map((name) => [blast[name], RECIPES[name]]));

  function between(range) {
    return range[0] + (range[1] - range[0]) * rng();
  }

  // `rgb`, when given, replaces every emitter's colour (the sparkle takes the caught pickup's).
  function burst(emitters, x, y, ground, rgb = null) {
    toWorld(x, y, ground, scratch);
    const scale = getScale();
    for (let k = 0; k < emitters.length; k += 1) {
      const e = emitters[k];
      const color = rgb ?? e.color;
      const layer = layers[e.layer];
      const count = Math.max(1, Math.round(e.count * scale));
      for (let i = 0; i < count; i += 1) {
        const angle = e.ring ? (i / count) * TWO_PI : rng() * TWO_PI;
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
          color[0],
          color[1],
          color[2],
          e.gravity,
        );
      }
    }
  }

  // A BOMB shows its own colour; any other pickup shows the colour index at the catch (c). An index
  // outside the cycle (a protocol fault) is drawn red rather than not at all.
  function pickupColor(kind, colorIndex) {
    if (kind === pickupKinds.BOMB) return PALETTE.BOMB_PICKUP.rgb;
    return (CRYSTAL_COLORS[colorIndex] ?? PALETTE.CRYSTAL_RED).rgb;
  }

  function handle(type, x, y, a, b, c) {
    if (type === events.EXPLOSION) {
      const emitters = byBlast.get(a);
      if (emitters) {
        burst(emitters, x, y, b);
        if (cityKinds.has(c)) {
          burst(CITY_SPARKS, x, y, b);
          cityBursts += 1;
        }
      }
    } else if (type === events.HIT) {
      burst(HIT_RECIPE, x, y, groundKinds.has(a) ? 1 : 0);
    } else if (type === events.PICKUP) {
      burst(PICKUP_RECIPE, x, y, 0, pickupColor(a, c));
    } else if (type === events.MEDAL) {
      burst(PICKUP_RECIPE, x, y, 0, PALETTE.MEDAL.rgb);
    } else if (type === events.PLAYER_HIT) {
      burst(PLAYER_HIT_RECIPE, x, y, 0);
    } else if (type === events.PLAYER_DEATH) {
      burst(PLAYER_DEATH_RECIPE, x, y, 0);
    }
  }

  return {
    handle,
    // City target bursts played so far (e2e).
    get cityBursts() {
      return cityBursts;
    },
  };
}
