// Plays the sounds Python chose. SFX events carry a SfxId in `a`; the manifest `sfx` map turns the
// number into a name, the bank holds that name's pre-rendered buffer, and every voice runs
//   source -> per-sound gain -> master bus -> compressor -> destination
// so nothing plays at an uncontrolled loudness. With no AudioContext the player is a silent no-op.

const HUM_NAME = 'LASER_HUM';
const HUM_FADE_S = 0.03;
const MUTE_RAMP_S = 0.06;

export function createSfxPlayer({
  audio,
  bank,
  table,
  sfxIds,
  events,
  // Reserved for the voice limiter and the per-sound cooldowns that plan 02-32 adds.
  now = () => performance.now(),
}) {
  const names = new Map();
  for (const [name, id] of Object.entries(sfxIds)) names.set(id, name);
  let played = 0;
  let bus = null;
  let muted = false;
  // The looped hum while the laser fires: { source, gain } while it sounds, else null.
  let hum = null;

  // Built once, on first use: master gain -> compressor -> destination.
  function ensureBus() {
    if (bus) return bus;
    const compressor = audio.createDynamicsCompressor();
    compressor.connect(audio.destination);
    bus = audio.createGain();
    bus.connect(compressor);
    return bus;
  }

  function play(name) {
    if (!audio) return false;
    const buffer = bank.get(name);
    const entry = table[name];
    if (!buffer || !entry) return false;
    try {
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = entry.volume;
      source.connect(gain);
      gain.connect(ensureBus());
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    } catch {
      // A closed or broken context must never reach the frame loop.
      return false;
    }
    played += 1;
    return true;
  }

  // A short gain ramp avoids the click of cutting a signal at full level.
  function ramp(param, to, seconds) {
    const t = audio.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + seconds);
  }

  function stopHum() {
    if (!hum) return;
    const { source, gain } = hum;
    hum = null;
    try {
      ramp(gain.gain, 0, HUM_FADE_S);
      source.stop(audio.currentTime + HUM_FADE_S + 0.01);
    } catch {
      // A closed context has already silenced it.
    }
  }

  function startHum() {
    const buffer = bank.get(HUM_NAME);
    const entry = table[HUM_NAME];
    if (!buffer || !entry) return;
    try {
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = entry.volume;
      source.connect(gain);
      gain.connect(ensureBus());
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      hum = { source, gain };
    } catch {
      hum = null;
    }
  }

  // The laser hum follows the state: starting twice never stacks a second loop.
  function setLaser(on) {
    if (!audio) return;
    if (on && !muted) {
      if (!hum) startHum();
    } else {
      stopHum();
    }
  }

  // Pausing or hiding the game: the master bus ramps to silence and the hum stops.
  function setMuted(on) {
    if (!audio || on === muted) return;
    muted = on;
    if (on) stopHum();
    try {
      ramp(ensureBus().gain, on ? 0 : 1, MUTE_RAMP_S);
    } catch {
      // A closed context has nothing left to silence.
    }
  }

  function handle(type, x, y, a) {
    if (type !== events.SFX) return;
    const name = names.get(a | 0);
    if (name !== undefined) play(name);
  }

  return {
    handle,
    play,
    setLaser,
    setMuted,
    get laser() {
      return hum !== null;
    },
    get muted() {
      return muted;
    },
    get played() {
      return played;
    },
  };
}
