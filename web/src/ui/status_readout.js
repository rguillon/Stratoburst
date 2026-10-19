// The HUD values: score and high score along the top; lives (ship icons) and bomb stock at the bottom
// left; weapon and level at the bottom right. place() puts the three blocks where hud_layout.js says
// (over the playfield edges, clear of the touch bomb button). Text goes in through textContent only, from
// manifest weapon names and integers (the bombs as one pip character each), and only when a value
// changes, so calling update() every frame never touches the DOM.

// CSS counterparts of the crystal colours (crimson, blue, purple; PALETTE.CRYSTAL_RED normalised).
// None is in the orange-yellow band reserved for enemy bullets (D-39).
export const WEAPON_CSS = Object.freeze({
  VULCAN: 'rgb(255, 28, 64)',
  LASER: 'rgb(80, 168, 255)',
  HOMING: 'rgb(170, 110, 255)',
});

const UNKNOWN_NAME = '?';

// One pip per bomb, 0..BOMB_PIPS_MAX (the stock cap, protocol BOMB_MAX_STOCK). The acid green colour is
// the bomb pickup's, written as a literal in index.html's stylesheet.
export const BOMB_PIP = '\u25cf';
export const BOMB_PIPS_MAX = 7;

// Whole pips for a header value; anything that is not a finite number shows no pips.
const pipCount = (bombs) =>
  Number.isFinite(bombs) ? Math.min(Math.max(Math.trunc(bombs), 0), BOMB_PIPS_MAX) : 0;

// One ship icon per life, 0..LIVES_ICONS_MAX (the lives cap, tuning LIVES_CAP). The HUD shows the ships
// left including the one flying; the cyan colour is the player trim's, set in index.html's stylesheet.
export const LIFE_ICON = '\u25b2';
export const LIVES_ICONS_MAX = 9;

const lifeCount = (lives) =>
  Number.isFinite(lives) ? Math.min(Math.max(Math.trunc(lives), 0), LIVES_ICONS_MAX) : 0;

// Whole number for a header value (the score is an exact integer in the float32 slot, up to seven
// digits); anything that is not a finite number shows 0.
const wholeNumber = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

// The lives icons pulse for this long after an extend (D-21), counted on the frame clock.
export const PULSE_MS = 600;

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
  const scoreEl = el.querySelector('.score');
  const hiscoreEl = el.querySelector('.hiscore');
  const livesEl = el.querySelector('.lives');
  const topEl = el.querySelector('.hud-top');
  const leftEl = el.querySelector('.hud-bl');
  const rightEl = el.querySelector('.hud-br');
  const livesClass = livesEl.className;
  const nameByValue = new Map(Object.entries(weapons).map(([name, value]) => [value, name]));

  let shownWeapon = Number.NaN;
  let shownLevel = Number.NaN;
  let shownPips = -1;
  let shownScore = -1;
  let shownHiscore = -1;
  let shownLives = -1;
  // The last placement written per block, as the transform string (the top band adds its width).
  let placedTop = '';
  let placedLeft = '';
  let placedRight = '';
  // The flash starts counting at the first tick after the catch, so the 900 ms follow the frame
  // clock; a catch while it is up resets the count instead of stacking a second flash.
  let flashing = false;
  let deadline = null;
  // The same for the lives pulse: the class goes on at the extend and off PULSE_MS after the next tick.
  let pulsing = false;
  let pulseDeadline = null;

  return {
    el,
    // `header` is the frame's Float32Array and `slots` the manifest's header slot names.
    update(header, slots) {
      const weapon = header[slots.WEAPON];
      const level = header[slots.LEVEL];
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
      const pips = pipCount(header[slots.BOMBS]);
      if (pips !== shownPips) {
        shownPips = pips;
        bombsEl.textContent = BOMB_PIP.repeat(pips);
      }
      const lives = lifeCount(header[slots.LIVES]);
      if (lives !== shownLives) {
        shownLives = lives;
        livesEl.textContent = LIFE_ICON.repeat(lives);
      }
      const score = wholeNumber(header[slots.SCORE]);
      if (score !== shownScore) {
        shownScore = score;
        scoreEl.textContent = String(score);
      }
      const hiscore = wholeNumber(header[slots.HIGH_SCORE]);
      if (hiscore !== shownHiscore) {
        shownHiscore = hiscore;
        hiscoreEl.textContent = String(hiscore);
      }
    },
    show() {
      el.hidden = false;
    },
    // `layout` is layoutHud's result; numbers only go into the styles, and only when they changed.
    place({ top, bottomLeft, bottomRight }) {
      const topKey = `translate(${top.left}px, ${top.top}px) ${top.width}`;
      if (topKey !== placedTop) {
        placedTop = topKey;
        topEl.style.transform = `translate(${top.left}px, ${top.top}px)`;
        topEl.style.width = `${top.width}px`;
      }
      const leftKey = `translate(${bottomLeft.left}px, ${bottomLeft.top}px)`;
      if (leftKey !== placedLeft) {
        placedLeft = leftKey;
        leftEl.style.transform = leftKey;
      }
      // The block is right-aligned: its right edge is the anchor.
      const rightKey = `translate(${bottomRight.right}px, ${bottomRight.top}px) translateX(-100%)`;
      if (rightKey !== placedRight) {
        placedRight = rightKey;
        rightEl.style.transform = rightKey;
      }
    },
    // One fx event; a PICKUP whose outcome is MAXED flashes and an EXTEND pulses the lives.
    handle(type, _x, _y, _a, b) {
      if (type === events.EXTEND) {
        // Dropping the class first lets the CSS animation start over when an extend lands mid-pulse.
        if (pulsing) {
          livesEl.className = livesClass;
          void livesEl.offsetWidth;
        }
        pulsing = true;
        pulseDeadline = null;
        livesEl.className = `${livesClass} pulse`;
        return;
      }
      if (type !== events.PICKUP || b !== maxed) return;
      flashing = true;
      deadline = null;
      flashEl.hidden = false;
    },
    // Called every frame with the frame clock in ms.
    tick(nowMs) {
      if (pulsing) {
        pulseDeadline ??= nowMs + PULSE_MS;
        if (nowMs >= pulseDeadline) {
          pulsing = false;
          livesEl.className = livesClass;
        }
      }
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
