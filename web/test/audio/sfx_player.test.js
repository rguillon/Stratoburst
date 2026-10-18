import { describe, expect, it } from 'vitest';
import { createSfxPlayer } from '../../src/audio/sfx_player.js';

const EVENTS = { SFX: 12, EXPLOSION: 1 };
const SFX_IDS = { EXPLODE_SMALL: 0, EXPLODE_LARGE: 2 };
const TABLE = {
  EXPLODE_SMALL: { volume: 0.7 },
  EXPLODE_LARGE: { volume: 1 },
};

// Records every node and connection so the graph can be asserted without a browser.
function fakeAudio({ startThrows = false } = {}) {
  const nodes = [];
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      connections: [],
      disconnected: false,
      connect(target) {
        n.connections.push(target);
      },
      disconnect() {
        n.disconnected = true;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const destination = { kind: 'destination' };
  return {
    nodes,
    destination,
    createGain: () => node('gain', { gain: { value: 1 } }),
    createDynamicsCompressor: () => node('compressor'),
    createBufferSource: () =>
      node('source', {
        buffer: null,
        started: 0,
        start() {
          if (startThrows) throw new Error('closed');
          this.started += 1;
        },
      }),
  };
}

function make({ audio = fakeAudio(), bankNames = ['EXPLODE_SMALL', 'EXPLODE_LARGE'] } = {}) {
  const bank = new Map(bankNames.map((name) => [name, { buffer: name }]));
  const player = createSfxPlayer({ audio, bank, table: TABLE, sfxIds: SFX_IDS, events: EVENTS });
  return { audio, bank, player };
}

describe('createSfxPlayer', () => {
  it('plays the buffer named by the SFX event id and counts the voice', () => {
    const { audio, bank, player } = make();

    player.handle(EVENTS.SFX, 10, 20, 2);

    const source = audio.nodes.find((n) => n.kind === 'source');
    expect(source.buffer).toBe(bank.get('EXPLODE_LARGE'));
    expect(source.started).toBe(1);
    expect(player.played).toBe(1);
  });

  it('routes source -> per-sound gain -> bus -> compressor -> destination', () => {
    const { audio, player } = make();

    player.handle(EVENTS.SFX, 0, 0, 0);

    const source = audio.nodes.find((n) => n.kind === 'source');
    const [voiceGain] = source.connections;
    expect(voiceGain.kind).toBe('gain');
    expect(voiceGain.gain.value).toBe(0.7);
    const [bus] = voiceGain.connections;
    expect(bus.kind).toBe('gain');
    const [compressor] = bus.connections;
    expect(compressor.kind).toBe('compressor');
    expect(compressor.connections).toEqual([audio.destination]);
  });

  it('builds the bus and compressor once and shares them between voices', () => {
    const { audio, player } = make();

    player.handle(EVENTS.SFX, 0, 0, 0);
    player.handle(EVENTS.SFX, 0, 0, 2);

    expect(audio.nodes.filter((n) => n.kind === 'compressor')).toHaveLength(1);
    const sources = audio.nodes.filter((n) => n.kind === 'source');
    expect(sources).toHaveLength(2);
    expect(sources[0].connections[0].connections[0]).toBe(sources[1].connections[0].connections[0]);
    expect(player.played).toBe(2);
  });

  it('frees a voice when it ends', () => {
    const { audio, player } = make();
    player.handle(EVENTS.SFX, 0, 0, 0);
    const source = audio.nodes.find((n) => n.kind === 'source');

    source.onended();

    expect(source.disconnected).toBe(true);
    expect(source.connections[0].disconnected).toBe(true);
  });

  it('ignores events that are not SFX events', () => {
    const { audio, player } = make();

    player.handle(EVENTS.EXPLOSION, 0, 0, 0);

    expect(audio.nodes).toHaveLength(0);
    expect(player.played).toBe(0);
  });

  it('ignores an id the manifest does not name', () => {
    const { player } = make();

    player.handle(EVENTS.SFX, 0, 0, 99);

    expect(player.played).toBe(0);
  });

  it('ignores an id whose buffer is not in the bank', () => {
    const { player } = make({ bankNames: ['EXPLODE_LARGE'] });

    player.handle(EVENTS.SFX, 0, 0, 0);

    expect(player.played).toBe(0);
  });

  it('ignores a named sound that has no table entry', () => {
    const audio = fakeAudio();
    const player = createSfxPlayer({
      audio,
      bank: new Map([['EXTRA', {}]]),
      table: TABLE,
      sfxIds: { EXTRA: 7 },
      events: EVENTS,
    });

    player.handle(EVENTS.SFX, 0, 0, 7);

    expect(player.played).toBe(0);
  });

  it('is a silent no-op with no AudioContext', () => {
    const player = createSfxPlayer({
      audio: null,
      bank: new Map(),
      table: TABLE,
      sfxIds: SFX_IDS,
      events: EVENTS,
    });

    expect(() => player.handle(EVENTS.SFX, 0, 0, 0)).not.toThrow();
    expect(player.play('EXPLODE_SMALL')).toBe(false);
    expect(player.played).toBe(0);
  });

  it('survives a context that refuses to start a voice', () => {
    const { player } = make({ audio: fakeAudio({ startThrows: true }) });

    expect(() => player.handle(EVENTS.SFX, 0, 0, 0)).not.toThrow();
    expect(player.played).toBe(0);
  });

  it('plays by name directly', () => {
    const { player } = make();

    expect(player.play('EXPLODE_SMALL')).toBe(true);
    expect(player.played).toBe(1);
  });
});
