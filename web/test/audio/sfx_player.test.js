import { describe, expect, it } from 'vitest';
import { createSfxPlayer } from '../../src/audio/sfx_player.js';

const EVENTS = { SFX: 12, EXPLOSION: 1 };
const SFX_IDS = { EXPLODE_SMALL: 0, EXPLODE_LARGE: 2 };
const TABLE = {
  EXPLODE_SMALL: { volume: 0.7 },
  EXPLODE_LARGE: { volume: 1 },
  LASER_HUM: { volume: 0.25 },
};

// An AudioParam that records its automation calls.
function fakeParam(value) {
  const calls = [];
  return {
    value,
    calls,
    cancelScheduledValues: (t) => calls.push(['cancel', t]),
    setValueAtTime: (v, t) => calls.push(['set', v, t]),
    linearRampToValueAtTime: (v, t) => calls.push(['ramp', v, t]),
  };
}

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
    currentTime: 2,
    createGain: () => node('gain', { gain: fakeParam(1) }),
    createDynamicsCompressor: () => node('compressor'),
    createBufferSource: () =>
      node('source', {
        buffer: null,
        loop: false,
        started: 0,
        stopped: [],
        start() {
          if (startThrows) throw new Error('closed');
          this.started += 1;
        },
        stop(t) {
          this.stopped.push(t);
        },
      }),
  };
}

function make({
  audio = fakeAudio(),
  bankNames = ['EXPLODE_SMALL', 'EXPLODE_LARGE', 'LASER_HUM'],
} = {}) {
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

describe('laser hum', () => {
  const sources = (audio) => audio.nodes.filter((n) => n.kind === 'source');

  it('setLaser(true) starts one looped LASER_HUM source at the table volume', () => {
    const { audio, bank, player } = make();

    player.setLaser(true);

    expect(sources(audio)).toHaveLength(1);
    const [hum] = sources(audio);
    expect(hum.buffer).toBe(bank.get('LASER_HUM'));
    expect(hum.loop).toBe(true);
    expect(hum.started).toBe(1);
    expect(hum.connections[0].gain.value).toBe(0.25);
    expect(player.laser).toBe(true);
  });

  it('repeated setLaser(true) calls never stack a second loop', () => {
    const { audio, player } = make();

    for (let i = 0; i < 5; i += 1) player.setLaser(true);

    expect(sources(audio)).toHaveLength(1);
  });

  it('setLaser(false) fades the hum out with a short gain ramp and stops it', () => {
    const { audio, player } = make();
    player.setLaser(true);
    const [hum] = sources(audio);

    player.setLaser(false);

    expect(player.laser).toBe(false);
    expect(hum.connections[0].gain.calls.at(-1)).toEqual(['ramp', 0, 2.03]);
    expect(hum.stopped).toHaveLength(1);
    expect(hum.stopped[0]).toBeCloseTo(2.04);
  });

  it('a stopped hum can start again, as a new source', () => {
    const { audio, player } = make();
    player.setLaser(true);
    player.setLaser(false);

    player.setLaser(true);

    expect(sources(audio)).toHaveLength(2);
    expect(player.laser).toBe(true);
  });

  it('setLaser(false) with no hum is a no-op', () => {
    const { audio, player } = make();

    player.setLaser(false);

    expect(sources(audio)).toHaveLength(0);
    expect(player.laser).toBe(false);
  });

  it('releases the looped nodes when the source ends', () => {
    const { audio, player } = make();
    player.setLaser(true);
    const [hum] = sources(audio);

    hum.onended();

    expect(hum.disconnected).toBe(true);
    expect(hum.connections[0].disconnected).toBe(true);
  });

  it('does not hum when the bank has no LASER_HUM buffer', () => {
    const { audio, player } = make({ bankNames: ['EXPLODE_SMALL'] });

    player.setLaser(true);

    expect(sources(audio)).toHaveLength(0);
    expect(player.laser).toBe(false);
  });

  it('survives a context that refuses to start the hum', () => {
    const { player } = make({ audio: fakeAudio({ startThrows: true }) });

    expect(() => player.setLaser(true)).not.toThrow();
    expect(player.laser).toBe(false);
  });

  it('survives a context that refuses to stop the hum', () => {
    const { audio, player } = make();
    player.setLaser(true);
    sources(audio)[0].stop = () => {
      throw new Error('closed');
    };

    expect(() => player.setLaser(false)).not.toThrow();
    expect(player.laser).toBe(false);
  });
});

describe('muted', () => {
  const buses = (audio) => audio.nodes.filter((n) => n.kind === 'compressor');

  it('setMuted(true) ramps the master bus to 0 over about 60 ms', () => {
    const { audio, player } = make();

    player.setMuted(true);

    const compressor = buses(audio)[0];
    const bus = audio.nodes.find((n) => n.kind === 'gain' && n.connections[0] === compressor);
    expect(bus.gain.calls).toEqual([
      ['cancel', 2],
      ['set', 1, 2],
      ['ramp', 0, 2.06],
    ]);
    expect(player.muted).toBe(true);
  });

  it('setMuted(false) ramps the bus back to 1', () => {
    const { audio, player } = make();
    player.setMuted(true);

    player.setMuted(false);

    const compressor = buses(audio)[0];
    const bus = audio.nodes.find((n) => n.kind === 'gain' && n.connections[0] === compressor);
    expect(bus.gain.calls.at(-1)).toEqual(['ramp', 1, 2.06]);
    expect(player.muted).toBe(false);
  });

  it('setting the same state again does nothing', () => {
    const { audio, player } = make();

    player.setMuted(false);

    expect(audio.nodes).toHaveLength(0);
    player.setMuted(true);
    const count = audio.nodes.length;
    player.setMuted(true);
    expect(audio.nodes).toHaveLength(count);
  });

  it('muting stops the laser hum, and the hum cannot start while muted', () => {
    const { audio, player } = make();
    player.setLaser(true);

    player.setMuted(true);

    expect(player.laser).toBe(false);
    player.setLaser(true);
    expect(player.laser).toBe(false);
    expect(audio.nodes.filter((n) => n.kind === 'source')).toHaveLength(1);
  });

  it('the hum comes back after unmuting once the laser is asked for again', () => {
    const { player } = make();
    player.setMuted(true);

    player.setMuted(false);
    player.setLaser(true);

    expect(player.laser).toBe(true);
  });

  it('survives a context that cannot automate the bus', () => {
    const audio = fakeAudio();
    const { player } = make({ audio });
    player.handle(EVENTS.SFX, 0, 0, 0);
    const compressor = audio.nodes.find((n) => n.kind === 'compressor');
    const bus = audio.nodes.find((n) => n.kind === 'gain' && n.connections[0] === compressor);
    bus.gain.cancelScheduledValues = () => {
      throw new Error('closed');
    };

    expect(() => player.setMuted(true)).not.toThrow();
    expect(player.muted).toBe(true);
  });

  it('laser and mute are silent no-ops with no AudioContext', () => {
    const player = createSfxPlayer({
      audio: null,
      bank: new Map(),
      table: TABLE,
      sfxIds: SFX_IDS,
      events: EVENTS,
    });

    expect(() => {
      player.setLaser(true);
      player.setMuted(true);
    }).not.toThrow();
    expect(player.laser).toBe(false);
    expect(player.muted).toBe(false);
  });
});
