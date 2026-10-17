// Skeleton: the fixed camera constants and signatures only. The behavior arrives in the GREEN commit.
export const CAMERA_TILT_DEG = 25;
export const CAMERA_FOV_DEG = 30;
export const FIT_PAD = 0.04;

export function fitCamera() {
  return { distance: 1, targetZ: 0 };
}

export function applyCameraFit() {}

export function projectCorners() {
  return [];
}

export function altitudeScale() {
  return 0;
}
