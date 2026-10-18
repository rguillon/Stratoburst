import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBeamMesh } from '../../src/fx/beam_mesh.js';
import { PALETTE } from '../../src/fx/palette.js';

const W = 240;
const H = 320;

function build(extra = {}) {
  return createBeamMesh({ playfieldW: W, playfieldH: H, ...extra });
}

const part = (beam, name) => beam.group.getObjectByName(name);

// The z extent of a flat unit quad scaled by `scale.z` and centred on `position.z`.
function span(mesh) {
  return [mesh.position.z - mesh.scale.z / 2, mesh.position.z + mesh.scale.z / 2];
}

describe('createBeamMesh', () => {
  it('is a hidden group of a glow, a core and a muzzle flare', () => {
    const beam = build();
    expect(beam.group.isGroup).toBe(true);
    expect(beam.group.visible).toBe(false);
    expect(beam.group.children.map((child) => child.name).sort()).toEqual([
      'beam-core',
      'beam-flare',
      'beam-glow',
    ]);
  });

  it('draws additive HDR blue without depth, below the playfield mask', () => {
    const beam = build();
    for (const mesh of beam.group.children) {
      expect(mesh.material.blending).toBe(THREE.AdditiveBlending);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthTest).toBe(false);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.renderOrder).toBe(4);
    }
    expect(part(beam, 'beam-core').material.uniforms.uColor.value.toArray()).toEqual(PALETTE.LASER_CORE.rgb);
    expect(part(beam, 'beam-glow').material.uniforms.uColor.value.toArray()).toEqual(PALETTE.LASER_GLOW.rgb);
  });

  it('shows a core and a 3.2x wider glow from the nose to 8 units beyond the top edge', () => {
    const beam = build();
    beam.update(4, 100, 250, 0);
    expect(beam.group.visible).toBe(true);
    const core = part(beam, 'beam-core');
    const glow = part(beam, 'beam-glow');
    expect(core.scale.x).toBe(8);
    expect(glow.scale.x).toBeCloseTo(3.2 * 4 * 2);
    for (const mesh of [core, glow]) {
      const [far, near] = span(mesh);
      expect(far).toBeCloseTo(-8 - H / 2); // 8 units beyond the top edge, in world z
      expect(near).toBeCloseTo(250 - 10 - H / 2); // the nose, 10 units ahead of the ship
      expect(mesh.position.x).toBe(100 - W / 2);
    }
  });

  it('follows the ship and grows with the half-width', () => {
    const beam = build();
    beam.update(2, 60, 280, 0);
    const thin = part(beam, 'beam-core').scale.x;
    expect(part(beam, 'beam-core').position.x).toBe(60 - W / 2);
    beam.update(7, 180, 200, 0);
    expect(part(beam, 'beam-core').scale.x).toBeGreaterThan(thin);
    expect(part(beam, 'beam-core').position.x).toBe(180 - W / 2);
    expect(span(part(beam, 'beam-core'))[1]).toBeCloseTo(200 - 10 - H / 2);
  });

  it('puts a flare at the nose that grows with the beam', () => {
    const beam = build();
    beam.update(2, 100, 250, 0);
    const small = part(beam, 'beam-flare').scale.x;
    expect(part(beam, 'beam-flare').position.z).toBeCloseTo(250 - 10 - H / 2);
    beam.update(7, 100, 250, 0);
    expect(part(beam, 'beam-flare').scale.x).toBeGreaterThan(small);
  });

  it('hides the group when the half-width is 0 and shows it again after', () => {
    const beam = build();
    beam.update(4, 100, 250, 0);
    beam.update(0, 100, 250, 0);
    expect(beam.group.visible).toBe(false);
    beam.update(4, 100, 250, 0);
    expect(beam.group.visible).toBe(true);
  });

  it('drives the flicker from the clock in all three shaders', () => {
    const beam = build();
    beam.update(4, 100, 250, 1.25);
    for (const mesh of beam.group.children) {
      expect(mesh.material.uniforms.uTime.value).toBe(1.25);
    }
  });

  it('keeps a positive length when the ship is at the very top of the playfield', () => {
    const beam = build();
    beam.update(4, 100, 2, 0);
    expect(part(beam, 'beam-core').scale.z).toBeGreaterThan(0);
  });

  it('takes the muzzle distance as an option', () => {
    const beam = build({ muzzleAhead: 4 });
    beam.update(4, 100, 250, 0);
    expect(span(part(beam, 'beam-core'))[1]).toBeCloseTo(250 - 4 - H / 2);
  });

  it('allocates no new objects in update', () => {
    const beam = build();
    beam.update(4, 100, 250, 0);
    const before = beam.group.children.map((child) => [child.position, child.scale]).flat();
    beam.update(5.5, 120, 240, 0.5);
    const after = beam.group.children.map((child) => [child.position, child.scale]).flat();
    expect(after).toEqual(before);
    after.forEach((vector, i) => expect(vector).toBe(before[i]));
  });
});
