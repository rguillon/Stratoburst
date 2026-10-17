import { loadPyodide } from 'pyodide';

// Exact version pin (D-02, T-01-01). The npm wrapper is pinned to the same version, so the
// default checkAPIVersion throws if the CDN core ever differs.
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

// Decoded (uncompressed) sizes of the three files loadPyodide fetches from the CDN, measured at
// PYODIDE_VERSION with `Accept-Encoding: identity`. Content-Length is useless for progress:
// jsDelivr sends the Brotli size while the stream yields decoded bytes. Update these together
// with PYODIDE_VERSION; a file missing from the table makes the bar indeterminate, never wrong.
export const DECODED_BYTES = {
  'pyodide.asm.wasm': 9598218,
  'python_stdlib.zip': 2545637,
  'pyodide-lock.json': 119077,
};
export const TOTAL_DECODED_BYTES = 12262932;

// The download share of the bar; Python start-up and GPU warm-up fill the rest.
const DOWNLOAD_SHARE = 0.8;

function urlOf(input) {
  return typeof input === 'string' ? input : (input.url ?? String(input));
}

// Wraps target.fetch so the decoded bytes of every response under `prefix` are counted as they
// stream through. Anything else is returned untouched. Returns a function that restores the
// original fetch (the caller does so in a finally block: T-01-23).
export function trackFetch(onBytes, { prefix = PYODIDE_CDN, target = globalThis } = {}) {
  const original = target.fetch;
  target.fetch = async (input, init) => {
    const res = await original.call(target, input, init);
    const url = urlOf(input);
    if (!res.body || !url.startsWith(prefix)) return res;
    const name = url.slice(prefix.length).split(/[?#]/)[0];
    const reader = res.body.getReader();
    const counted = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        onBytes(name, value.byteLength);
        controller.enqueue(value);
      },
      cancel: (reason) => reader.cancel(reason),
    });
    // status, statusText and headers (content-type: application/wasm) are kept so WebAssembly
    // streaming compilation still accepts the response.
    return new Response(counted, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
  return () => {
    target.fetch = original;
  };
}

// Fraction (0..0.8) of the bar the downloaded bytes account for, or null (indeterminate) if a
// file outside the size table was counted.
export function progressFraction(countsByName) {
  let sum = 0;
  for (const [name, bytes] of Object.entries(countsByName)) {
    if (!(name in DECODED_BYTES)) return null;
    sum += bytes;
  }
  return Math.min(sum / TOTAL_DECODED_BYTES, 1) * DOWNLOAD_SHARE;
}

export async function loadRuntime({ onProgress = () => {}, timeoutMs = 60_000, loader = loadPyodide } = {}) {
  const counts = {};
  const restore = trackFetch((name, bytes) => {
    counts[name] = (counts[name] ?? 0) + bytes;
    onProgress(progressFraction(counts));
  });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Python runtime did not load within ${timeoutMs / 1000} s (CDN blocked or slow network)`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([loader({ indexURL: PYODIDE_CDN }), timeout]);
  } finally {
    restore();
    clearTimeout(timer);
  }
}
