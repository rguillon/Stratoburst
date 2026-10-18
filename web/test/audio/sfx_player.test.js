import { describe, expect, it } from 'vitest';
import { createSfxPlayer } from '../../src/audio/sfx_player.js';

const EVENTS = { SFX: 12, EXPLOSION: 1 };
const SFX_IDS = { EXPLODE_SMALL: 0, EXPLODE_LARGE: 2, VULCAN: 3, HIT: 4, BOMB_BLAST: 5 };
const TABLE = {
  EXPLODE_SMALL: { volume: 0.7, cooldownMs: 0, priority: 5 },
  EXPLODE_LARGE: { volume: 1, cooldownMs: 0, priority: 5 },
  VULCAN: { volume: 0.3, cooldownMs: 60, priority: 1 },
  HIT: { volume: 0.25, cooldownMs: 40, priority: 1 },
  BOMB_BLAST: { volume: 1, cooldownMs: 0, priority: 10 },
  LASER_HUM: { volume: 0.25, cooldownMs: 0, priority: 3 },
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
        stop(t) {
          this.stopped.push(t);
        },
        start() {
          if (startThrows) throw new Error('closed');
          this.started += 1;
        },
      }),
  };
}

function make({
  audio = fakeAudio(),
  bankNames = ['EXPLODE_SMALL', 'EXPLODE_LARGE', 'VULCAN', 'HIT', 'BOMB_BLAST', 'LASER_HUM'],
} = {}) {
  const bank = new Map(bankNames.map((name) => [name, { buffer: name }]));
  const clock = { t: 0 };
  const player = createSfxPlayer({
    audio,
    bank,
    table: TABLE,
    sfxIds: SFX_IDS,
    events: EVENTS,
    now: () => clock.t,
  });
  return { audio, bank, clock, player };
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

describe('voice limiter', () => {
  const oneShots = (audio) =>
    audio.nodes.filter((n) => n.kind === 'source' && !n.loop);

  // Twenty explosions, each with its own start time so "oldest" is well defined.
  function fillVoices(player, clock) {
    for (let i = 0; i < 20; i += 1) {
      clock.t = i;
      expect(player.play('EXPLODE_SMALL')).toBe(true);
    }
  }

  it('plays at most 20 voices: an equal-priority request steals the oldest voice', () => {
    const { audio, clock, player } = make();
    fillVoices(player, clock);
    const voices = oneShots(audio);

    clock.t = 100;
    expect(player.play('EXPLODE_LARGE')).toBe(true);

    expect(voices[0].stopped).toHaveLength(1);
    expect(voices.slice(1).every((v) => v.stopped.length === 0)).toBe(true);
    expect(oneShots(audio)).toHaveLength(21);
    expect(player.played).toBe(21);
  });

  it('steal picks the lowest-priority voice first, even when it is newer', () => {
    const { audio, clock, player } = make();
    clock.t = 0;
    for (let i = 0; i < 19; i += 1) player.play('BOMB_BLAST');
    clock.t = 5;
    player.play('VULCAN');
    const voices = oneShots(audio);
    const shot = voices[19];

    clock.t = 100;
    expect(player.play('EXPLODE_SMALL')).toBe(true);

    expect(shot.stopped).toHaveLength(1);
    expect(voices.slice(0, 19).every((v) => v.stopped.length === 0)).toBe(true);
  });

  it('steal drops a lower-priority request when every voice outranks it', () => {
    const { audio, clock, player } = make();
    for (let i = 0; i < 20; i += 1) player.play('EXPLODE_SMALL');
    const before = oneShots(audio).length;

    clock.t = 100;
    expect(player.play('HIT')).toBe(false);

    expect(oneShots(audio)).toHaveLength(before);
    expect(player.played).toBe(20);
  });

  it('a stolen voice ending later does not free the slot of its replacement', () => {
    const { audio, clock, player } = make();
    fillVoices(player, clock);
    const voices = oneShots(audio);
    clock.t = 100;
    player.play('EXPLODE_LARGE');
    const replacement = oneShots(audio)[20];

    voices[0].onended();

    // All 20 slots are still taken: a low-priority request is still dropped.
    clock.t = 200;
    expect(player.play('HIT')).toBe(false);
    expect(replacement.disconnected).toBe(false);
  });

  it('releases a voice on ended, so its slot is free again', () => {
    const { audio, clock, player } = make();
    for (let i = 0; i < 20; i += 1) player.play('EXPLODE_SMALL');
    clock.t = 100;
    expect(player.play('HIT')).toBe(false);

    oneShots(audio)[3].onended();

    clock.t = 200;
    expect(player.play('HIT')).toBe(true);
  });

  it('survives a voice that refuses to stop when it is stolen', () => {
    const { audio, clock, player } = make();
    fillVoices(player, clock);
    oneShots(audio)[0].stop = () => {
      throw new Error('already stopped');
    };

    clock.t = 100;
    expect(player.play('EXPLODE_LARGE')).toBe(true);
  });

  it('does not count the laser hum against the voice limit', () => {
    const { clock, player } = make();
    player.setLaser(true);

    fillVoices(player, clock);

    expect(player.played).toBe(20);
  });

  it('a failed start leaves its slot free', () => {
    const { audio, player } = make({ audio: fakeAudio({ startThrows: true }) });
    for (let i = 0; i < 25; i += 1) player.play('EXPLODE_SMALL');

    expect(player.played).toBe(0);
    expect(audio.nodes.filter((n) => n.kind === 'source')).toHaveLength(25);
  });
});

describe('cooldown', () => {
  it('a second play of the same id inside its cooldown is dropped', () => {
    const { clock, player } = make();
    clock.t = 1000;
    expect(player.play('VULCAN')).toBe(true);

    clock.t = 1059;
    expect(player.play('VULCAN')).toBe(false);
    expect(player.played).toBe(1);
  });

  it('after the cooldown the sound plays again', () => {
    const { clock, player } = make();
    clock.t = 1000;
    player.play('VULCAN');

    clock.t = 1060;
    expect(player.play('VULCAN')).toBe(true);
    expect(player.played).toBe(2);
  });

  it('cooldowns are per id: another sound plays inside it', () => {
    const { clock, player } = make();
    clock.t = 1000;
    player.play('VULCAN');

    clock.t = 1001;
    expect(player.play('HIT')).toBe(true);
  });

  it('a burst of identical events plays once', () => {
    const { clock, player } = make();
    clock.t = 5000;

    for (let i = 0; i < 10; i += 1) player.handle(EVENTS.SFX, 0, 0, 3);

    expect(player.played).toBe(1);
  });

  it('a dropped request does not restart the cooldown', () => {
    const { clock, player } = make();
    clock.t = 1000;
    player.play('VULCAN');
    clock.t = 1050;
    player.play('VULCAN');

    clock.t = 1060;
    expect(player.play('VULCAN')).toBe(true);
  });

  it('a sound with a zero cooldown plays on every request', () => {
    const { clock, player } = make();
    clock.t = 1000;

    expect(player.play('EXPLODE_SMALL')).toBe(true);
    expect(player.play('EXPLODE_SMALL')).toBe(true);
  });
});

describe('table volume', () => {
  it('scales each voice gain by the table volume', () => {
    const { audio, clock, player } = make();
    clock.t = 1000;
    player.play('VULCAN');
    player.play('EXPLODE_LARGE');

    const gains = audio.nodes
      .filter((n) => n.kind === 'source')
      .map((n) => n.connections[0].gain.value);
    expect(gains).toEqual([0.3, 1]);
  });
});
