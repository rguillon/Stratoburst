// Plays the sounds Python chose. SFX events carry a SfxId in `a`; the manifest `sfx` map turns the
// number into a name, the bank holds that name's pre-rendered buffer, and every voice runs
//   source -> per-sound gain -> master bus -> compressor -> destination
// so nothing plays at an uncontrolled loudness. At most 20 voices sound at once (the least important,
// then oldest, is stolen; a request that nothing outranks is dropped) and each sound has a cooldown,
// so heavy fire never piles up into noise. With no AudioContext the player is a silent no-op.

const MAX_VOICES = 20;
const HUM_NAME = 'LASER_HUM';
const HUM_FADE_S = 0.03;
const MUTE_RAMP_S = 0.06;

export function createSfxPlayer({
  audio,
  bank,
  table,
  sfxIds,
  events,
  // Milliseconds; the per-sound cooldowns and the voice ages read it (tests inject a fake clock).
  now = () => performance.now(),
}) {
  const names = new Map();
  for (const [name, id] of Object.entries(sfxIds)) names.set(id, name);
  let played = 0;
  let bus = null;
  // The voice limiter: a fixed set of slots, reused for the whole session (the laser hum has its own).
  const voices = Array.from({ length: MAX_VOICES }, () => ({
    source: null,
    gain: null,
    priority: 0,
    start: 0,
  }));
  // When each sound last started, for the per-sound cooldowns.
  const lastPlayed = new Map();
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

  // Frees a slot, silencing its source if it is still playing (a steal) or already ended.
  function release(voice) {
    const { source, gain } = voice;
    voice.source = null;
    voice.gain = null;
    if (!source) return;
    try {
      source.stop();
    } catch {
      // Already stopped or the context is closed: nothing left to silence.
    }
    source.disconnect();
    gain.disconnect();
  }

  // A free slot, else the lowest-priority (then oldest) voice if the request outranks it or ties
  // with it, else null: when every voice is more important the new request is dropped.
  function claimSlot(priority) {
    let victim = null;
    for (const voice of voices) {
      if (!voice.source) return voice;
      if (
        victim === null ||
        voice.priority < victim.priority ||
        (voice.priority === victim.priority && voice.start < victim.start)
      ) {
        victim = voice;
      }
    }
    if (victim.priority > priority) return null;
    release(victim);
    return victim;
  }

  function play(name) {
    if (!audio) return false;
    const buffer = bank.get(name);
    const entry = table[name];
    if (!buffer || !entry) return false;
    const time = now();
    const last = lastPlayed.get(name);
    if (last !== undefined && time - last < entry.cooldownMs) return false;
    const voice = claimSlot(entry.priority);
    if (!voice) return false;
    try {
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = entry.volume;
      source.connect(gain);
      gain.connect(ensureBus());
      // A stolen voice's late `ended` must not free the slot its replacement now holds.
      source.onended = () => {
        if (voice.source === source) release(voice);
        else {
          source.disconnect();
          gain.disconnect();
        }
      };
      source.start();
      voice.source = source;
      voice.gain = gain;
      voice.priority = entry.priority;
      voice.start = time;
    } catch {
      // A closed or broken context must never reach the frame loop.
      return false;
    }
    lastPlayed.set(name, time);
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
