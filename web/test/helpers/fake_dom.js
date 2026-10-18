// Minimal DOM stand-in for node-environment tests: just enough for the overlay and report UI.

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.textContent = '';
    this.value = '';
    this.id = '';
    this.className = '';
    this.hidden = false;
    this.readOnly = false;
    this.parent = null;
    this.focused = false;
    this.selected = false;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  // Class selectors only (".weapon"): all the readout needs.
  querySelector(selector) {
    const cls = selector.slice(1);
    const walk = (node) => {
      for (const child of node.children) {
        if (child.className.split(' ').includes(cls)) return child;
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  click() {
    for (const handler of this.listeners.click ?? []) handler({ type: 'click' });
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }
}

export function createFakeDocument({ clipboard } = {}) {
  const body = new FakeElement('body');
  const doc = {
    body,
    defaultView: { navigator: { clipboard } },
    createElement: (tag) => new FakeElement(tag),
    getElementById(id) {
      const walk = (node) => {
        if (node.id === id) return node;
        for (const child of node.children) {
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(body);
    },
  };
  return doc;
}
