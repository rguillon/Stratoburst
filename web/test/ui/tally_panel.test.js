import { describe, expect, it } from 'vitest';
import { COUNT_MS, createTallyPanel } from '../../src/ui/tally_panel.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const FLOW_STATES = { INTRO: 0, PLAY: 1, CLEAR: 5, TALLY: 6, STAGE_CLEAR: 7 };
const SLOTS = { FLOW: 0, TALLY_BOSS: 1, TALLY_MEDALS: 2, TALLY_NO_MISS: 3, TALLY_BOMBS: 4, TALLY_N: 5 };
const ROW_IDS = ['tally-boss', 'tally-medals', 'tally-no-miss', 'tally-bombs'];

// One frame's header and the slot map, as main.js passes them: update(...frame({ n: 2 }), ts).
function frame(values = {}) {
  const v = { flow: FLOW_STATES.TALLY, amounts: [100000, 7000, 50000, 20000], n: 0, ...values };
  const header = new Float32Array(6);
  header[SLOTS.FLOW] = v.flow;
  header[SLOTS.TALLY_BOSS] = v.amounts[0];
  header[SLOTS.TALLY_MEDALS] = v.amounts[1];
  header[SLOTS.TALLY_NO_MISS] = v.amounts[2];
  header[SLOTS.TALLY_BOMBS] = v.amounts[3];
  header[SLOTS.TALLY_N] = v.n;
  return [header, SLOTS];
}

// A document holding the same markup as index.html: #tally with four rows, each with a static label
// and an amount span. Writes to the amount text and to the labels are counted.
function build({ withMarkup = true } = {}) {
  const doc = createFakeDocument();
  const el = doc.createElement('div');
  el.id = 'tally';
  el.hidden = true;
  const rows = [];
  const writes = { amount: [0, 0, 0, 0], label: 0 };
  ROW_IDS.forEach((id, index) => {
    const row = doc.createElement('div');
    row.id = id;
    row.className = 'row';
    row.hidden = true;
    const label = doc.createElement('span');
    label.className = 'label';
    let labelText = id;
    Object.defineProperty(label, 'textContent', {
      get: () => labelText,
      set(value) {
        labelText = value;
        writes.label += 1;
      },
    });
    const amount = doc.createElement('span');
    amount.className = 'amount';
    let text = '';
    Object.defineProperty(amount, 'textContent', {
      get: () => text,
      set(value) {
        text = value;
        writes.amount[index] += 1;
      },
    });
    row.append(label, amount);
    el.append(row);
    rows.push({ row, amount, label });
  });
  if (withMarkup) doc.body.append(el);
  return { doc, el, rows, writes, make: () => createTallyPanel({ doc, flowStates: FLOW_STATES }) };
}

describe('createTallyPanel', () => {
  it('throws when #tally is missing from the page', () => {
    const { make } = build({ withMarkup: false });
    expect(make).toThrow('#tally is missing from the page');
  });

  it('exposes the element it drives and starts hidden', () => {
    const { el, make } = build();
    expect(make().el).toBe(el);
    expect(el.hidden).toBe(true);
  });

  it('counts for half a second', () => {
    expect(COUNT_MS).toBe(500);
  });

  it('is visible only while FLOW is TALLY', () => {
    const { el, make } = build();
    const panel = make();
    for (const flow of [FLOW_STATES.INTRO, FLOW_STATES.PLAY, FLOW_STATES.CLEAR, FLOW_STATES.STAGE_CLEAR]) {
      panel.update(...frame({ flow, n: 4 }), 0);
      expect(el.hidden).toBe(true);
    }
    panel.update(...frame({ flow: FLOW_STATES.TALLY }), 0);
    expect(el.hidden).toBe(false);
    panel.update(...frame({ flow: FLOW_STATES.STAGE_CLEAR, n: 4 }), 100);
    expect(el.hidden).toBe(true);
  });

  it('shows the panel with no row until the first line is revealed', () => {
    const { el, rows, make } = build();
    make().update(...frame({ n: 0 }), 0);
    expect(el.hidden).toBe(false);
    expect(rows.every(({ row }) => row.hidden)).toBe(true);
  });

  it('shows row i once TALLY_N is above i', () => {
    const { rows, make } = build();
    const panel = make();
    for (let n = 0; n <= 4; n += 1) {
      panel.update(...frame({ n }), 0);
      expect(rows.map(({ row }) => row.hidden)).toEqual([0, 1, 2, 3].map((i) => !(n > i)));
    }
  });

  it('counts a row up from 0 to its amount over half a second of frame time', () => {
    const { rows, make } = build();
    const panel = make();
    panel.update(...frame({ n: 1 }), 1000);
    expect(rows[0].amount.textContent).toBe('0');
    panel.update(...frame({ n: 1 }), 1250);
    expect(rows[0].amount.textContent).toBe('50000');
    panel.update(...frame({ n: 1 }), 1500);
    expect(rows[0].amount.textContent).toBe('100000');
    panel.update(...frame({ n: 1 }), 9000);
    expect(rows[0].amount.textContent).toBe('100000');
  });

  it('starts every row counting from the frame it appears on', () => {
    const { rows, make } = build();
    const panel = make();
    panel.update(...frame({ n: 1 }), 0);
    panel.update(...frame({ n: 2 }), 1000);
    expect(rows[0].amount.textContent).toBe('100000');
    expect(rows[1].amount.textContent).toBe('0');
    panel.update(...frame({ n: 2 }), 1250);
    expect(rows[1].amount.textContent).toBe('3500');
  });

  it('writes a number only when the shown integer changes', () => {
    const { writes, make } = build();
    const panel = make();
    panel.update(...frame({ n: 1 }), 0);
    panel.update(...frame({ n: 1 }), 0);
    expect(writes.amount[0]).toBe(1);
    panel.update(...frame({ n: 1 }), 1000);
    panel.update(...frame({ n: 1 }), 1016);
    panel.update(...frame({ n: 1 }), 1032);
    expect(writes.amount[0]).toBe(2);
    expect(writes.amount.slice(1)).toEqual([0, 0, 0]);
  });

  it('shows a zero amount as 0 and never writes the label', () => {
    const { rows, writes, make } = build();
    const panel = make();
    panel.update(...frame({ amounts: [0, 0, 0, 0], n: 4 }), 0);
    panel.update(...frame({ amounts: [0, 0, 0, 0], n: 4 }), 600);
    expect(rows.map(({ amount }) => amount.textContent)).toEqual(['0', '0', '0', '0']);
    expect(writes.label).toBe(0);
  });

  it('counts again from 0 on the next tally', () => {
    const { rows, make } = build();
    const panel = make();
    panel.update(...frame({ n: 1 }), 0);
    panel.update(...frame({ n: 1 }), 600);
    expect(rows[0].amount.textContent).toBe('100000');
    panel.update(...frame({ flow: FLOW_STATES.PLAY, n: 0 }), 700);
    panel.update(...frame({ n: 1 }), 5000);
    expect(rows[0].amount.textContent).toBe('0');
    panel.update(...frame({ n: 1 }), 5250);
    expect(rows[0].amount.textContent).toBe('50000');
  });

  it('rebuilds from any frame: a panel opened with all four revealed counts all four', () => {
    const { rows, make } = build();
    const panel = make();
    panel.update(...frame({ n: 4 }), 4000);
    expect(rows.map(({ row }) => row.hidden)).toEqual([false, false, false, false]);
    panel.update(...frame({ n: 4 }), 4500);
    expect(rows.map(({ amount }) => amount.textContent)).toEqual(['100000', '7000', '50000', '20000']);
  });

  it('shows 0 for a value that is not a finite number', () => {
    const { rows, make } = build();
    const panel = make();
    const [header, slots] = frame({ n: 1 });
    header[slots.TALLY_BOSS] = Number.NaN;
    panel.update(header, slots, 0);
    panel.update(header, slots, 600);
    expect(rows[0].amount.textContent).toBe('0');
    const [header2, slots2] = frame({ n: Number.NaN });
    panel.update(header2, slots2, 700);
    expect(rows.every(({ row }) => row.hidden)).toBe(true);
  });
});
