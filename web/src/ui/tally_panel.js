// The stage-clear bonus tally (SCOR-03, D-18): four lines counted up one by one after the boss, shown
// exactly while the header FLOW is TALLY. It is state-driven from the header, never event-driven, so a
// missed event cannot leave it stuck and the panel can be rebuilt from any frame (Pitfall 6): the four
// amounts are in TALLY_BOSS, TALLY_MEDALS, TALLY_NO_MISS and TALLY_BOMBS, and TALLY_N says how many
// lines are revealed. A row appears once its line is revealed and its number counts up from 0 to the
// amount over COUNT_MS of frame time. The labels are static markup in index.html; the only text written
// is a whole number through textContent, and only when the shown integer changes.

export const COUNT_MS = 500;

// The rows in their fixed order: the element id and the header slot holding that line's amount.
const ROWS = [
  { id: 'tally-boss', slot: 'TALLY_BOSS' },
  { id: 'tally-medals', slot: 'TALLY_MEDALS' },
  { id: 'tally-no-miss', slot: 'TALLY_NO_MISS' },
  { id: 'tally-bombs', slot: 'TALLY_BOMBS' },
];

const wholeNumber = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

// `flowStates` is the manifest's flow state name -> id map. `update(header, slots, nowMs)` runs every
// frame with the header, the manifest's slot names and the frame clock in ms.
export function createTallyPanel({ doc = document, flowStates }) {
  const el = doc.getElementById('tally');
  if (!el) throw new Error('#tally is missing from the page');

  const rows = ROWS.map(({ id, slot }) => {
    const row = doc.getElementById(id);
    if (!row) throw new Error(`#${id} is missing from the page`);
    // `startedAt` is the frame clock when the row appeared, `null` while it is hidden.
    return { slot, row, amountEl: row.querySelector('.amount'), startedAt: null, shown: null };
  });

  // The number shown for a row: 0 when it appears, its amount COUNT_MS later.
  function countedValue(row, amount, now) {
    const progress = Math.min(Math.max((now - row.startedAt) / COUNT_MS, 0), 1);
    return Math.round(amount * progress);
  }

  function hideRow(row) {
    if (row.startedAt === null) return;
    row.startedAt = null;
    row.shown = null;
    row.row.hidden = true;
  }

  return {
    el,
    update(header, slots, nowMs) {
      if (header[slots.FLOW] !== flowStates.TALLY) {
        el.hidden = true;
        rows.forEach(hideRow);
        return;
      }
      el.hidden = false;
      const revealed = wholeNumber(header[slots.TALLY_N]);
      rows.forEach((row, index) => {
        if (index >= revealed) {
          hideRow(row);
          return;
        }
        if (row.startedAt === null) {
          row.startedAt = nowMs;
          row.row.hidden = false;
        }
        const value = countedValue(row, wholeNumber(header[slots[row.slot]]), nowMs);
        if (value !== row.shown) {
          row.shown = value;
          row.amountEl.textContent = String(value);
        }
      });
    },
  };
}
