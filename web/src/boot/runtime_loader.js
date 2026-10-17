import { loadPyodide } from 'pyodide';

// Exact version pin (D-02, T-01-01). The npm wrapper is pinned to the same version, so the
// default checkAPIVersion throws if the CDN core ever differs.
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

export function loadRuntime() {
  return loadPyodide({ indexURL: PYODIDE_CDN });
}
