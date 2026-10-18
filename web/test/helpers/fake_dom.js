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
    this.attributes = {};
    this.captured = [];
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

  removeEventListener(type, handler) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((h) => h !== handler);
  }

  listenerCount(type) {
    return (this.listeners[type] ?? []).length;
  }

  setAttribute(name, value = '') {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  setPointerCapture(pointerId) {
    this.captured.push(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captured = this.captured.filter((id) => id !== pointerId);
  }

  // Attribute selectors only ("[data-no-steer]"), matched on this element and then its parents.
  closest(selector) {
    const name = selector.slice(1, -1);
    for (let node = this; node; node = node.parent) {
      if (name in node.attributes) return node;
    }
    return null;
  }

  // Delivers an event to this element's listeners and then bubbles it up through the parents until
  // a listener calls stopPropagation. Returns the event so a test can read preventDefault.
  dispatch(type, init = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      ...init,
    };
    for (let node = this; node && !event.propagationStopped; node = node.parent) {
      for (const handler of node.listeners[type] ?? []) handler(event);
    }
    return event;
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
