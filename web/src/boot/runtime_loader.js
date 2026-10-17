import { loadPyodide } from 'pyodide';

// Exact version pin (D-02, T-01-01). The npm wrapper is pinned to the same version, so the
// default checkAPIVersion throws if the CDN core ever differs.
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

// Skeleton (RED): ignores the loader, timeout and progress; GREEN implements them.
export function loadRuntime() {
  void loadPyodide;
  return Promise.resolve('skeleton');
}

// Skeletons (RED): implemented in the GREEN commit.
export const DECODED_BYTES = {};
export const TOTAL_DECODED_BYTES = 0;

export function trackFetch() {
  return () => {};
}

export function progressFraction() {
  return 0;
}
