// The sound table (D-29): one entry per SfxId name, in the order the manifest `sfx` map lists them.
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
});
