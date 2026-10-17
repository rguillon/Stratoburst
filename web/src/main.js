import { installErrorPanel } from './boot/error_panel.js';
import { parseUrlFlags } from './boot/url_flags.js';
import { loadRuntime } from './boot/runtime_loader.js';
import { startGame } from './python/python_bridge.js';
import { createFrameLoop } from './loop/frame_loop.js';
import { createKeyboardInput } from './input/keyboard_input.js';
import { createRendererRig } from './render/renderer_rig.js';
import { createShipModel } from './render/ship_model.js';
import { createBulletInstances } from './render/bullet_instances.js';
import * as THREE from 'three';

const PLAYFIELD_W = 240;
const PLAYFIELD_H = 320;

const panel = installErrorPanel();

async function main() {
  const flags = parseUrlFlags(globalThis.location.search);
  const canvas = document.getElementById('view');
  const rig = createRendererRig(canvas, { playfieldW: PLAYFIELD_W, playfieldH: PLAYFIELD_H });
  const ship = createShipModel();
  rig.scene.add(ship);
  rig.render();

  const pyodide = await loadRuntime();
  const bridge = await startGame(pyodide, { seed: 1, stress: flags.stress });
  const { tick, header, slots, manifest } = bridge;
  const ebullets = createBulletInstances({
    data: bridge.channels.ebullets,
    capacity: manifest.channels.ebullets.cap,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(ebullets.mesh);
  const keyboard = createKeyboardInput();
  const world = new THREE.Vector3();

  const loop = createFrameLoop({
    onFrame(dt) {
      const input = keyboard.sample();
      tick(dt, input.buttons, input.moveX, input.moveY, 0, 0);
      rig.toWorld(header[slots.SHIP_X], header[slots.SHIP_Y], world);
      ship.position.copy(world);
      ebullets.update(header[slots.EBULLET_N]);
      rig.render();
    },
    onError(error) {
      panel.show(error, 'frame');
    },
  });
  panel.onFatal(() => loop.stop());
  loop.start();

  if (flags.debug) {
    globalThis.__scorched = { ready: true, header, slots, flags };
  }
}

main().catch((error) => panel.show(error, 'load'));
