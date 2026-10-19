// The boss HP bar (D-25): a thin bar at the top while a boss is up. It is state-driven from the header
// (BOSS_ACTIVE, BOSS_HP, BOSS_TIMER_S), never event-driven, so a missed event cannot leave it stuck.
// The fill follows the hull's health fraction, a tick mark sits at each phase threshold of the boss
// that is up, and a timeout readout shows only in the last seconds of the fight. The tick elements
// are built once from the manifest's `stage.bosses` numbers with createElement, and the only text
// written is a whole number through textContent. Every DOM write happens only when a value changes.

const clamp01 = (value) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0);

// `bosses` is the manifest's `stage.bosses`: a list of `{ slot, name, phase_fracs }`. `update(header,
// slots)` runs every frame with the header and the manifest's slot names.
export function createBossBar({ doc = document, bosses }) {
  const el = doc.getElementById('boss-bar');
  if (!el) throw new Error('#boss-bar is missing from the page');
  const fillEl = el.querySelector('.fill');
  const ticksEl = el.querySelector('.ticks');
  const timerEl = el.querySelector('.timer');

  // One group of tick marks per boss, all hidden until that boss is the active one.
  const ticksBySlot = new Map();
  for (const boss of bosses) {
    const group = [];
    for (const fraction of boss.phase_fracs) {
      const tick = doc.createElement('span');
      tick.className = 'tick';
      tick.style.left = `${Math.round(fraction * 10000) / 100}%`;
      tick.hidden = true;
      ticksEl.append(tick);
      group.push(tick);
    }
    ticksBySlot.set(boss.slot, group);
  }

  // What the DOM shows now; `undefined` until the first write, so the first frame always writes.
  let shownActive;
  let shownFill;
  let shownTimerVisible;
  let shownTimerText;

  function showTicks(slot) {
    for (const [owner, group] of ticksBySlot) {
      for (const tick of group) tick.hidden = owner !== slot;
    }
  }

  return {
    el,
    update(header, slots) {
      const active = Number.isFinite(header[slots.BOSS_ACTIVE]) ? Math.round(header[slots.BOSS_ACTIVE]) : 0;
      if (active !== shownActive) {
        shownActive = active;
        el.hidden = active === 0;
        showTicks(active);
      }
      if (active === 0) return;

      const fill = `scaleX(${clamp01(header[slots.BOSS_HP])})`;
      if (fill !== shownFill) {
        shownFill = fill;
        fillEl.style.transform = fill;
      }

      // The countdown is published as whole seconds from 20 down to 0, and -1 when it is not worth showing.
      const seconds = header[slots.BOSS_TIMER_S];
      const timerVisible = Number.isFinite(seconds) && seconds >= 0;
      if (timerVisible !== shownTimerVisible) {
        shownTimerVisible = timerVisible;
        timerEl.hidden = !timerVisible;
      }
      if (timerVisible) {
        const text = String(Math.ceil(seconds));
        if (text !== shownTimerText) {
          shownTimerText = text;
          timerEl.textContent = text;
        }
      }
    },
  };
}
