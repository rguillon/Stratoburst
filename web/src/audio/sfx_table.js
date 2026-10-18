// The sound table (D-29): one entry per SfxId name, in the order of the Python SfxId enum.
// Which sound plays is decided in Python; this only says what each one is made of and how it is
// mixed. `params` are the 21 ZzFX sound designer values, in its order:
//   volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
//   pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay,
//   tremolo, filter (positive filter = low-pass cut-off in Hz).
// `volume` is the per-sound gain (0..1), `cooldownMs` the least time between two voices of the same
// sound (enforced by the voice limiter), `priority` what survives when voices run out.

export const SFX_TABLE = Object.freeze({
  // Explosions: noise-heavy with a falling pitch and a low-passed thump; larger means longer and lower.
  EXPLODE_SMALL: {
    params: [1, 0.1, 300, 0, 0.02, 0.22, 4, 1.8, -8, 0, 0, 0, 0, 0.5, 0, 0.2, 0, 0.7, 0.03, 0, 2400],
    volume: 0.7,
    cooldownMs: 40,
    priority: 5,
  },
  EXPLODE_MEDIUM: {
    params: [1, 0.1, 160, 0, 0.04, 0.45, 4, 2, -5, 0, 0, 0, 0, 0.6, 0, 0.25, 0.02, 0.7, 0.06, 0, 1200],
    volume: 0.85,
    cooldownMs: 60,
    priority: 5,
  },
  EXPLODE_LARGE: {
    params: [1, 0.08, 90, 0, 0.08, 0.9, 4, 2.2, -3, 0, 0, 0, 0, 0.7, 0, 0.35, 0.04, 0.7, 0.12, 0, 800],
    volume: 1,
    cooldownMs: 90,
    priority: 5,
  },
  // Shots are short and snappy, and mixed quiet so they never bury the explosions.
  VULCAN: {
    params: [0.9, 0.05, 640, 0, 0.01, 0.05, 2, 1.2, -12, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.005, 0, 0],
    volume: 0.3,
    cooldownMs: 60,
    priority: 1,
  },
  // A soft whoosh.
  MISSILE: {
    params: [0.8, 0.1, 200, 0.03, 0.05, 0.25, 4, 1.5, -2, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.6, 0.05, 0, 1800],
    volume: 0.3,
    cooldownMs: 80,
    priority: 1,
  },
  // A tiny tick.
  HIT: {
    params: [1, 0.05, 900, 0, 0, 0.025, 3, 1, -6, 0, 0, 0, 0, 0.2, 0, 0, 0, 1, 0, 0, 0],
    volume: 0.25,
    cooldownMs: 40,
    priority: 1,
  },
  // Pickups chime brightly: a rising two-step bell.
  WEAPON_UP: {
    params: [1, 0, 660, 0.005, 0.08, 0.25, 0, 1, 0, 0, 330, 0.06, 0, 0, 0, 0, 0.06, 0.6, 0.02, 0, 0],
    volume: 0.7,
    cooldownMs: 100,
    priority: 5,
  },
  // A two-note blip.
  WEAPON_SWITCH: {
    params: [1, 0, 520, 0, 0.02, 0.1, 1, 1, 0, 0, 260, 0.05, 0, 0, 0, 0, 0, 0.7, 0.01, 0, 0],
    volume: 0.5,
    cooldownMs: 80,
    priority: 4,
  },
  // A bright arpeggio: the pitch jump repeats every 0.14 s.
  MAX: {
    params: [1, 0, 523, 0.005, 0.2, 0.4, 0, 1, 0, 0, 261, 0.07, 0.14, 0, 0, 0, 0.08, 0.7, 0.03, 0.1, 0],
    volume: 0.8,
    cooldownMs: 200,
    priority: 6,
  },
  BOMB_PICKUP: {
    params: [1, 0, 880, 0.005, 0.1, 0.35, 0, 1, 0, 0, 440, 0.08, 0, 0, 0, 0, 0.08, 0.6, 0.02, 0.2, 0],
    volume: 0.75,
    cooldownMs: 100,
    priority: 5,
  },
  // A rising whoosh.
  BOMB_LAUNCH: {
    params: [0.9, 0.1, 90, 0.1, 0.3, 0.5, 4, 2, 12, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.8, 0.1, 0, 1400],
    volume: 0.8,
    cooldownMs: 200,
    priority: 7,
  },
  // The largest, longest noise boom.
  BOMB_BLAST: {
    params: [1, 0.05, 60, 0, 0.25, 1.6, 4, 2.4, -1.5, 0, 0, 0, 0, 0.8, 0, 0.45, 0.06, 0.8, 0.2, 0, 700],
    volume: 1,
    cooldownMs: 300,
    priority: 10,
  },
  // A sharp alarm blip.
  PLAYER_HIT: {
    params: [1, 0, 880, 0, 0.04, 0.2, 2, 1, 0, 0, -440, 0.06, 0.1, 0, 0, 0.1, 0, 0.8, 0.01, 0, 0],
    volume: 0.9,
    cooldownMs: 100,
    priority: 10,
  },
  // A heavy crunch.
  DEATH: {
    params: [1, 0.1, 70, 0, 0.12, 1.1, 4, 2.4, -2, 0, 0, 0, 0, 0.9, 0, 0.5, 0.05, 0.7, 0.15, 0, 500],
    volume: 1,
    cooldownMs: 300,
    priority: 10,
  },
  // A rising tone.
  RESPAWN: {
    params: [0.8, 0, 220, 0.1, 0.25, 0.2, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.1, 0, 0],
    volume: 0.6,
    cooldownMs: 300,
    priority: 7,
  },
  // A bright save chord.
  DEATHBOMB: {
    params: [1, 0, 660, 0.005, 0.25, 0.5, 1, 1, 0, 0, 330, 0.08, 0.16, 0, 0, 0, 0.1, 0.7, 0.05, 0.3, 0],
    volume: 0.8,
    cooldownMs: 300,
    priority: 8,
  },
  // A quiet pew.
  ENEMY_FIRE: {
    params: [0.8, 0.05, 700, 0, 0.01, 0.12, 1, 1, -14, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.01, 0, 0],
    volume: 0.15,
    cooldownMs: 50,
    priority: 1,
  },
  // A loopable tone: no attack and no release, so a looped source has no clicks.
  LASER_HUM: {
    params: [0.6, 0, 100, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    volume: 0.25,
    cooldownMs: 0,
    priority: 3,
  },
});
