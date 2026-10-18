import { describe, expect, it } from 'vitest';
import { createSfxBank, synthesizeAll } from '../../src/audio/sfx_bank.js';

function fakeAudio() {
  const created = [];
  return {
    created,
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      const buffer = { channels, length, rate, data, getChannelData: () => data };
      created.push(buffer);
      return buffer;
    },
  };
}

const TABLE = {
  A: { params: [1, 0, 220, 0.01, 0.01, 0.01] },
  B: { params: [1, 0, 440, 0.02, 0.01, 0.01] },
};

describe('synthesizeAll', () => {
  it('renders one sample array per table entry, in table order', () => {
    const samples = synthesizeAll(TABLE, { random: () => 0.5 });

    expect([...samples.keys()]).toEqual(['A', 'B']);
    expect(samples.get('A')).toBeInstanceOf(Float32Array);
    expect(samples.get('A').length).toBe(Math.floor(0.03 * 44100));
  });

  it('honours the sample rate', () => {
    const samples = synthesizeAll(TABLE, { sampleRate: 8000, random: () => 0.5 });

    expect(samples.get('A').length).toBe(Math.floor(0.03 * 8000));
  });

  it('renders with the default random source and rate', () => {
    expect(synthesizeAll(TABLE).get('B').length).toBe(Math.floor(0.04 * 44100));
  });
});

describe('createSfxBank', () => {
  it('creates one buffer per sample array and copies the data into it', () => {
    const audio = fakeAudio();
    const samples = new Map([
      ['A', Float32Array.from([0.1, 0.2, 0.3])],
      ['B', Float32Array.from([0.5])],
    ]);

    const bank = createSfxBank({ audio, samples });

    expect([...bank.keys()]).toEqual(['A', 'B']);
    expect(audio.created).toHaveLength(2);
    expect(bank.get('A').channels).toBe(1);
    expect(bank.get('A').rate).toBe(44100);
    expect([...bank.get('A').data]).toEqual([
      Math.fround(0.1),
      Math.fround(0.2),
      Math.fround(0.3),
    ]);
  });

  it('uses the sample rate the samples were rendered at', () => {
    const audio = fakeAudio();

    const bank = createSfxBank({
      audio,
      samples: new Map([['A', new Float32Array(4)]]),
      sampleRate: 22050,
    });

    expect(bank.get('A').rate).toBe(22050);
  });

  it('is empty, and throws nothing, when there is no AudioContext', () => {
    const bank = createSfxBank({ audio: null, samples: new Map([['A', new Float32Array(4)]]) });

    expect(bank.size).toBe(0);
  });
});
