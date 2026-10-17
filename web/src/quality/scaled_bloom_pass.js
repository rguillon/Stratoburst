import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// UnrealBloomPass with nMips fixed at 5, so the cheap "reduced bloom" lever is rendering the
// whole bloom chain at a fraction of the pass size. EffectComposer calls setSize with the
// pixel-ratio-scaled size, so the scale composes with the tier's DPR.
export class ScaledBloomPass extends UnrealBloomPass {
  constructor(resolution, strength, radius, threshold, scale = 1) {
    super(resolution, strength, radius, threshold);
    this.scale = scale;
    this.lastWidth = Math.max(1, Math.round(resolution.x));
    this.lastHeight = Math.max(1, Math.round(resolution.y));
  }

  setSize(width, height) {
    this.lastWidth = width;
    this.lastHeight = height;
    super.setSize(
      Math.max(1, Math.round(width * this.scale)),
      Math.max(1, Math.round(height * this.scale)),
    );
  }

  setScale(scale) {
    this.scale = scale;
    this.setSize(this.lastWidth, this.lastHeight);
  }
}
