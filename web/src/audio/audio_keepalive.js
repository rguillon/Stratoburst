// Keeps the AudioContext usable on iOS Safari after the start tap (AUDI-03, D-30).
//  - navigator.audioSession (where it exists) is set to 'playback', so the ringer switch does not
//    mute Web Audio. The 'transient' types would duck or end other audio, so they are avoided.
//  - A call, an app switch or Siri leaves the context 'suspended' or 'interrupted' (iOS-only state);
//    only a user gesture can resume it, so every later pointerup or keydown does that.
// With no AudioContext this installs nothing. `win` and `nav` are injected so tests pass fakes.

const DOWN_STATES = new Set(['suspended', 'interrupted']);
const GESTURES = ['pointerup', 'keydown'];

function setPlaybackSession(nav) {
  const session = nav?.audioSession;
  if (!session) return;
  try {
    session.type = 'playback';
  } catch {
    // A browser that refuses the type simply keeps its default behaviour.
  }
}

export function installAudioKeepalive({ audio, win = window, nav = globalThis.navigator }) {
  if (!audio) return () => {};
  setPlaybackSession(nav);

  // A resume is pending until it settles or the state changes: a held key repeats keydown many
  // times a second, and each of those must not stack another resume() call.
  let resuming = false;

  function onGesture() {
    if (resuming || !DOWN_STATES.has(audio.state)) return;
    resuming = true;
    try {
      Promise.resolve(audio.resume())
        .catch(() => {})
        .finally(() => {
          resuming = false;
        });
    } catch {
      resuming = false;
    }
  }

  // On iOS the promise of a resume() during an interruption may stay pending until it ends; a state
  // change means whatever was pending is over, so the next gesture may try again.
  function onStateChange() {
    resuming = false;
  }

  for (const type of GESTURES) win.addEventListener(type, onGesture);
  audio.addEventListener('statechange', onStateChange);

  return function dispose() {
    for (const type of GESTURES) win.removeEventListener(type, onGesture);
    audio.removeEventListener('statechange', onStateChange);
  };
}
