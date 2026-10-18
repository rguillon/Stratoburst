import { buildSamples } from './zzfx_synth.js';

const SAMPLE_RATE = 44100;
// The generator's positional parameters come first and its options object follows them, so a
// shorter list is padded with undefined (each takes its default) to keep the options in place.
const PARAM_COUNT = 21;

// Renders every table entry to samples. Pure CPU work with no browser object, so it runs during
// loading (overlapping the runtime download), long before the start tap creates the AudioContext.
// Returns a Map from sound name to its Float32Array.
export function synthesizeAll(table, { sampleRate = SAMPLE_RATE, random = Math.random } = {}) {
  const samples = new Map();
  for (const [name, entry] of Object.entries(table)) {
    const params = Array.from({ length: PARAM_COUNT }, (_, i) => entry.params[i]);
    samples.set(name, buildSamples(...params, { sampleRate, random }));
  }
  return samples;
}

// Copies each sample array into an AudioBuffer of the given context. With no context (blocked or
// absent) the bank is empty and the game stays silent.
export function createSfxBank({ audio, samples, sampleRate = SAMPLE_RATE }) {
  const bank = new Map();
  if (!audio) return bank;
  for (const [name, data] of samples) {
    const buffer = audio.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    bank.set(name, buffer);
  }
  return bank;
}
