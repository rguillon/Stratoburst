// Plays the sounds Python chose. SFX events carry a SfxId in `a`; the manifest `sfx` map turns the
// number into a name, the bank holds that name's pre-rendered buffer, and every voice runs
//   source -> per-sound gain -> master bus -> compressor -> destination
// so nothing plays at an uncontrolled loudness. With no AudioContext the player is a silent no-op.

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

  function handle(type, x, y, a) {
    if (type !== events.SFX) return;
    const name = names.get(a | 0);
    if (name !== undefined) play(name);
  }

  return {
    handle,
    play,
    get played() {
      return played;
    },
  };
}
