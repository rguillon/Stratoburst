// Weapon, level and bomb stock readout (bottom-left, inside the safe area): stands in for the
// Phase 3 HUD. Text goes in through textContent only, from manifest weapon names and integers
// (the bombs as one pip character each), and only when a value changes, so calling update() every
// frame never touches the DOM.

// CSS counterparts of the crystal colours (red, blue, purple). None is in the reserved enemy-bullet orange-yellow.
export const WEAPON_CSS = Object.freeze({
  VULCAN: 'rgb(255, 90, 60)',
  LASER: 'rgb(80, 168, 255)',
  HOMING: 'rgb(170, 110, 255)',
});

const UNKNOWN_NAME = '?';

// One pip per bomb, 0..BOMB_PIPS_MAX (the stock cap, protocol BOMB_MAX_STOCK). The amber colour is
// the bomb pickup's, written as a literal in index.html's stylesheet.
export const BOMB_PIP = '\u25cf';
export const BOMB_PIPS_MAX = 7;

// Whole pips for a header value; anything that is not a finite number shows no pips.
const pipCount = (bombs) =>
  Number.isFinite(bombs) ? Math.min(Math.max(Math.trunc(bombs), 0), BOMB_PIPS_MAX) : 0;

// The MAX flash (D-06) stays up for this long, fading over its last FADE_MS.
export const FLASH_MS = 900;
const FADE_MS = 400;

// `events` is the manifest's event name -> id map and `maxed` the PickupOutcome value of a fifth
// same-colour catch. The flash is static markup toggled with `hidden`; no text is ever written to it.
export function createStatusReadout({ doc = document, weapons, events, maxed, colors = WEAPON_CSS }) {
  const el = doc.getElementById('status-readout');
  if (!el) throw new Error('#status-readout is missing from the page');
  const flashEl = doc.getElementById('max-flash');
  if (!flashEl) throw new Error('#max-flash is missing from the page');
  const weaponEl = el.querySelector('.weapon');
  const levelEl = el.querySelector('.level');
  const bombsEl = el.querySelector('.bombs');
  const nameByValue = new Map(Object.entries(weapons).map(([name, value]) => [value, name]));

  let shownWeapon = Number.NaN;
  let shownLevel = Number.NaN;
  let shownPips = -1;
  // The flash starts counting at the first tick after the catch, so the 900 ms follow the frame
  // clock; a catch while it is up resets the count instead of stacking a second flash.
  let flashing = false;
  let deadline = null;

  return {
    el,
    update(weapon, level, bombs) {
      if (weapon !== shownWeapon) {
        shownWeapon = weapon;
        const name = nameByValue.get(weapon) ?? UNKNOWN_NAME;
        weaponEl.textContent = name;
        weaponEl.style.color = colors[name] ?? '';
      }
      if (level !== shownLevel) {
        shownLevel = level;
        levelEl.textContent = `Lv ${level}`;
      }
      const pips = pipCount(bombs);
      if (pips !== shownPips) {
        shownPips = pips;
        bombsEl.textContent = BOMB_PIP.repeat(pips);
      }
    },
    show() {
      el.hidden = false;
    },
    // One fx event; only a PICKUP whose outcome is MAXED flashes.
    handle(type, _x, _y, _a, b) {
      if (type !== events.PICKUP || b !== maxed) return;
      flashing = true;
      deadline = null;
      flashEl.hidden = false;
    },
    // Called every frame with the frame clock in ms.
    tick(nowMs) {
      if (!flashing) return;
      deadline ??= nowMs + FLASH_MS;
      const remaining = deadline - nowMs;
      if (remaining <= 0) {
        flashing = false;
        flashEl.hidden = true;
        return;
      }
      flashEl.style.opacity = Math.min(1, remaining / FADE_MS).toFixed(2);
    },
  };
}
