import { describe, expect, it } from 'vitest';
import { createLoadingScreen } from '../../src/boot/loading_screen.js';

class FakeNode {
  constructor() {
    this.attrs = new Map();
    this.classes = new Set();
    this.style = {};
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
      contains: (c) => this.classes.has(c),
    };
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  getAttribute(name) {
    return this.attrs.get(name) ?? null;
  }
}

function fakeDoc() {
  const nodes = {
    loading: new FakeNode(),
    progress: new FakeNode(),
    'progress-fill': new FakeNode(),
    'loading-status': new FakeNode(),
    'start-gate': new FakeNode(),
  };
  nodes['start-gate'].hidden = true;
  nodes.progress.setAttribute('aria-valuenow', '0');
  return { nodes, doc: { getElementById: (id) => nodes[id] ?? null } };
}

describe('createLoadingScreen', () => {
  it('setProgress sets the fill width in percent and a rounded aria-valuenow', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(0.4);

    expect(nodes['progress-fill'].style.width).toBe('40%');
    expect(nodes.progress.getAttribute('aria-valuenow')).toBe('40');
    screen.setProgress(0.4567);
    expect(nodes.progress.getAttribute('aria-valuenow')).toBe('46');
  });

  it('clamps the fraction to 0..1', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(1.7);
    expect(nodes.progress.getAttribute('aria-valuenow')).toBe('100');
    expect(nodes['progress-fill'].style.width).toBe('100%');
  });

  it('never moves the bar backwards', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(0.8);
    screen.setProgress(0.3);

    expect(nodes.progress.getAttribute('aria-valuenow')).toBe('80');
  });

  it('null switches to the indeterminate state and drops aria-valuenow', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(null);

    expect(nodes.progress.classList.contains('indeterminate')).toBe(true);
    expect(nodes.progress.getAttribute('aria-valuenow')).toBeNull();
  });

  it('a real value after indeterminate restores the determinate bar', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(null);
    screen.setProgress(0.9);

    expect(nodes.progress.classList.contains('indeterminate')).toBe(false);
    expect(nodes.progress.getAttribute('aria-valuenow')).toBe('90');
  });

  it('a non-finite fraction is treated as indeterminate', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setProgress(Number.NaN);

    expect(nodes.progress.classList.contains('indeterminate')).toBe(true);
  });

  it('setStatus writes through textContent', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.setStatus('<b>Starting Python…</b>');

    expect(nodes['loading-status'].textContent).toBe('<b>Starting Python…</b>');
  });

  it('showGate reveals the button and marks the overlay gate-ready', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.showGate();

    expect(nodes['start-gate'].hidden).toBe(false);
    expect(nodes.loading.dataset.gateReady).toBe('true');
    expect(screen.gateEl).toBe(nodes['start-gate']);
  });

  it('hide hides the whole overlay', () => {
    const { doc, nodes } = fakeDoc();
    const screen = createLoadingScreen(doc);

    screen.hide();

    expect(nodes.loading.hidden).toBe(true);
  });
});
