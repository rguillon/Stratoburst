// Weapon and level readout (bottom-left, inside the safe area): stands in for the Phase 3 HUD.
// Text goes in through textContent only, from manifest weapon names and integers, and only when a
// value changes, so calling update() every frame never touches the DOM.

// CSS counterparts of the crystal colours (red, blue, purple). None is in the reserved enemy pink.
export const WEAPON_CSS = Object.freeze({
  VULCAN: 'rgb(255, 90, 60)',
  LASER: 'rgb(80, 168, 255)',
  HOMING: 'rgb(170, 110, 255)',
});

const UNKNOWN_NAME = '?';

export function createStatusReadout({ doc = document, weapons, colors = WEAPON_CSS }) {
  const el = doc.getElementById('status-readout');
  if (!el) throw new Error('#status-readout is missing from the page');
  const weaponEl = el.querySelector('.weapon');
  const levelEl = el.querySelector('.level');
  const nameByValue = new Map(Object.entries(weapons).map(([name, value]) => [value, name]));

  let shownWeapon = Number.NaN;
  let shownLevel = Number.NaN;

  return {
    el,
    update(weapon, level) {
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
    },
    show() {
      el.hidden = false;
    },
  };
}
