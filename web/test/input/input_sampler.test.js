import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_FOV_DEG, applyCameraFit, fitCamera } from '../../src/render/camera_fit.js';
import { createInputSampler } from '../../src/input/input_sampler.js';

const BITS = { FIRE: 1, BOMB: 2, PAUSE: 4 };
const W = 390;
const H = 844;

function mapperArgs() {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, W / H, 10, 4000);
  applyCameraFit(camera, fitCamera({ aspect: W / H }));
  camera.updateMatrixWorld(true);
  return { camera, viewportW: W, viewportH: H, shipWorld: new THREE.Vector3(0, 0, 112) };
}

function fakeKeyboard(sample = { buttons: 0, moveX: 0, moveY: 0 }) {
  const calls = [];
  return { calls, sample: (bits) => (calls.push(bits), { ...sample }) };
}

function fakeTouch(sample = { dxPx: 0, dyPx: 0, active: false }) {
  let next = sample;
  return {
    set: (value) => (next = value),
    sample() {
      const out = next;
      next = { dxPx: 0, dyPx: 0, active: out.active };
      return out;
    },
  };
}

function fakeBombButton(pressed = false) {
  let samples = 0;
  return {
    press: (on) => (pressed = on),
    get samples() {
      return samples;
    },
    sample: () => (samples++, pressed),
  };
}

function make({
  keyboard = fakeKeyboard(),
  touch = fakeTouch(),
  bombButton,
  getMapperArgs = mapperArgs,
} = {}) {
  return {
    keyboard,
    touch,
    sampler: createInputSampler({ keyboard, touch, bombButton, buttonBits: BITS, getMapperArgs }),
  };
}

describe('createInputSampler', () => {
  it('passes the keyboard buttons and axes through in keyboard mode', () => {
    const { sampler } = make({ keyboard: fakeKeyboard({ buttons: 3, moveX: -1, moveY: 1 }) });
    expect(sampler.sample()).toEqual({ buttons: 3, moveX: -1, moveY: 1, dragX: 0, dragY: 0 });
  });

  it('hands the manifest button bits to the keyboard', () => {
    const { sampler, keyboard } = make();
    sampler.sample();
    expect(keyboard.calls).toEqual([BITS]);
  });

  it('starts in keyboard mode with no auto-fire', () => {
    const { sampler } = make();
    expect(sampler.touchMode).toBe(false);
    expect(sampler.sample().buttons).toBe(0);
  });

  it('auto-fires in touch mode with no keys pressed', () => {
    const { sampler } = make();
    sampler.setTouchMode(true);
    expect(sampler.touchMode).toBe(true);
    expect(sampler.sample().buttons).toBe(BITS.FIRE);
  });

  it('ORs auto-fire onto other held buttons', () => {
    const { sampler } = make({ keyboard: fakeKeyboard({ buttons: BITS.BOMB, moveX: 0, moveY: 0 }) });
    sampler.setTouchMode(true);
    expect(sampler.sample().buttons).toBe(BITS.BOMB | BITS.FIRE);
  });

  it('leaves touch mode on a keydown (setTouchMode(false)) and stops auto-fire', () => {
    const { sampler } = make();
    sampler.setTouchMode(true);
    sampler.setTouchMode(false);
    expect(sampler.touchMode).toBe(false);
    expect(sampler.sample().buttons).toBe(0);
  });

  it('ORs the BOMB bit when the bomb button samples true, and samples it every time', () => {
    const bombButton = fakeBombButton(true);
    const { sampler } = make({ bombButton });
    expect(sampler.sample().buttons).toBe(BITS.BOMB);
    bombButton.press(false);
    expect(sampler.sample().buttons).toBe(0);
    expect(bombButton.samples).toBe(2);
  });

  it('keeps FIRE and the keyboard bits next to the button BOMB bit in touch mode', () => {
    const { sampler } = make({
      keyboard: fakeKeyboard({ buttons: BITS.PAUSE, moveX: 0, moveY: 0 }),
      bombButton: fakeBombButton(true),
    });
    sampler.setTouchMode(true);
    expect(sampler.sample().buttons).toBe(BITS.PAUSE | BITS.FIRE | BITS.BOMB);
  });

  it('behaves as before on a keyboard-only page with no bomb button', () => {
    const { sampler } = make({ keyboard: fakeKeyboard({ buttons: BITS.FIRE, moveX: 0, moveY: 0 }) });
    expect(sampler.sample().buttons).toBe(BITS.FIRE);
  });

  it('converts the finger delta once per sample and zeroes it afterwards', () => {
    const { sampler, touch } = make();
    touch.set({ dxPx: 40, dyPx: 0, active: true });
    const first = sampler.sample();
    expect(first.dragX).toBeGreaterThan(0);
    expect(Math.abs(first.dragY)).toBeLessThan(0.01);
    expect(sampler.sample()).toMatchObject({ dragX: 0, dragY: 0 });
  });

  it('does not ask for mapper arguments when there is no finger movement', () => {
    let asked = 0;
    const { sampler } = make({ getMapperArgs: () => (asked++, mapperArgs()) });
    sampler.sample();
    expect(asked).toBe(0);
  });

  it('zeroes non-finite keyboard axes and drag values', () => {
    const keyboard = fakeKeyboard({ buttons: 0, moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY });
    const { sampler, touch } = make({ keyboard });
    touch.set({ dxPx: Number.NaN, dyPx: 3, active: true });
    expect(sampler.sample()).toEqual({ buttons: 0, moveX: 0, moveY: 0, dragX: 0, dragY: 0 });
  });

  it('zeroes a non-finite converted drag', () => {
    const { sampler, touch } = make({
      getMapperArgs: () => ({ ...mapperArgs(), shipWorld: new THREE.Vector3(Number.NaN, 0, 0) }),
    });
    touch.set({ dxPx: 10, dyPx: 10, active: true });
    expect(sampler.sample()).toMatchObject({ dragX: 0, dragY: 0 });
  });
});
