// The start gate. Gameplay begins on a deliberate player gesture, and that same gesture creates
// and resumes an AudioContext (browsers only allow audio to start from a user activation, PLAT-03).
// `click` and `pointerup` are used, never `pointerdown` or `touchstart`: iOS does not count those
// as an activation for audio.

const KEY_CODES = new Set(['Enter', 'Space']);

// Everything audio-related is best effort: a blocked or missing AudioContext must not stop the
// game from starting. The silent one-sample buffer is what actually unlocks iOS Safari.
function unlockAudio(AudioContextCtor) {
  if (!AudioContextCtor) return null;
  let audio = null;
  try {
    audio = new AudioContextCtor();
    Promise.resolve(audio.resume()).catch(() => {});
    const source = audio.createBufferSource();
    source.buffer = audio.createBuffer(1, 1, audio.sampleRate);
    source.connect(audio.destination);
    source.start(0);
  } catch {
    // Keep whatever was created; audio stays optional.
  }
  return audio;
}

export function waitForStartGesture(
  el,
  { AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext, win = window } = {},
) {
  return new Promise((resolve) => {
    function finish(pointerType) {
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointerup', onPointerUp);
      win.removeEventListener('keydown', onKeyDown);
      // Synchronously inside the gesture handler, before any await.
      resolve({ audio: unlockAudio(AudioContextCtor), pointerType });
    }
    const onClick = (event) => finish(event.pointerType || 'mouse');
    const onPointerUp = (event) => finish(event.pointerType || 'mouse');
    const onKeyDown = (event) => {
      if (KEY_CODES.has(event.code)) finish('keyboard');
    };
    el.addEventListener('click', onClick);
    el.addEventListener('pointerup', onPointerUp);
    win.addEventListener('keydown', onKeyDown);
  });
}
