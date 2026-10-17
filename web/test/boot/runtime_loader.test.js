import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DECODED_BYTES,
  PYODIDE_CDN,
  TOTAL_DECODED_BYTES,
  loadRuntime,
  progressFraction,
  trackFetch,
} from '../../src/boot/runtime_loader.js';

const WASM = PYODIDE_CDN + 'pyodide.asm.wasm';

function streamOf(sizes) {
  return new ReadableStream({
    start(controller) {
      for (const n of sizes) controller.enqueue(new Uint8Array(n));
      controller.close();
    },
  });
}

function wasmResponse(sizes) {
  return new Response(streamOf(sizes), {
    status: 200,
    statusText: 'All Good',
    headers: { 'content-type': 'application/wasm' },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('size table', () => {
  it('lists the three CDN files and the total is their sum', () => {
    expect(DECODED_BYTES).toEqual({
      'pyodide.asm.wasm': 9598218,
      'python_stdlib.zip': 2545637,
      'pyodide-lock.json': 119077,
    });
    expect(TOTAL_DECODED_BYTES).toBe(12262932);
  });
});

describe('trackFetch', () => {
  it('reports every decoded chunk of a CDN file by name', async () => {
    const target = { fetch: async () => wasmResponse([1000, 2000]) };
    const seen = [];
    trackFetch((name, bytes) => seen.push([name, bytes]), { target });

    const res = await target.fetch(WASM);
    const body = await res.arrayBuffer();

    expect(body.byteLength).toBe(3000);
    expect(seen).toEqual([
      ['pyodide.asm.wasm', 1000],
      ['pyodide.asm.wasm', 2000],
    ]);
  });

  it('keeps status, statusText and the wasm content type so streaming compile still works', async () => {
    const target = { fetch: async () => wasmResponse([10]) };
    trackFetch(() => {}, { target });

    const res = await target.fetch(WASM);

    expect(res.status).toBe(200);
    expect(res.statusText).toBe('All Good');
    expect(res.headers.get('content-type')).toBe('application/wasm');
  });

  it('accepts a Request or URL object as the input', async () => {
    const target = { fetch: async () => wasmResponse([5]) };
    const seen = [];
    trackFetch((name, bytes) => seen.push([name, bytes]), { target });

    await (await target.fetch(new URL(WASM))).arrayBuffer();
    await (await target.fetch(new Request(WASM))).arrayBuffer();

    expect(seen).toEqual([
      ['pyodide.asm.wasm', 5],
      ['pyodide.asm.wasm', 5],
    ]);
  });

  it('returns the original Response untouched for a URL outside the CDN and reports nothing', async () => {
    const original = wasmResponse([10]);
    const target = { fetch: async () => original };
    const seen = [];
    trackFetch((name, bytes) => seen.push([name, bytes]), { target });

    const res = await target.fetch('https://example.com/pyodide.asm.wasm');
    await res.arrayBuffer();

    expect(res).toBe(original);
    expect(seen).toEqual([]);
  });

  it('does not treat a lookalike host as the CDN prefix', async () => {
    const original = wasmResponse([10]);
    const target = { fetch: async () => original };
    trackFetch(() => {}, { target });

    const res = await target.fetch(PYODIDE_CDN.replace('cdn.jsdelivr.net', 'cdn.jsdelivr.net.evil.test') + 'x');

    expect(res).toBe(original);
  });

  it('returns a body-less CDN response untouched', async () => {
    const original = new Response(null, { status: 204 });
    const target = { fetch: async () => original };
    trackFetch(() => {}, { target });

    expect(await target.fetch(WASM)).toBe(original);
  });

  it('forwards the init argument to the original fetch', async () => {
    const fetchSpy = vi.fn(async () => wasmResponse([1]));
    const target = { fetch: fetchSpy };
    trackFetch(() => {}, { target });

    await target.fetch(WASM, { cache: 'force-cache' });

    expect(fetchSpy).toHaveBeenCalledWith(WASM, { cache: 'force-cache' });
  });

  it('forwards a cancelled stream to the original reader', async () => {
    const cancelled = vi.fn();
    const source = new ReadableStream({ pull() {}, cancel: cancelled });
    const target = { fetch: async () => new Response(source, { status: 200 }) };
    trackFetch(() => {}, { target });

    const res = await target.fetch(WASM);
    await res.body.cancel('stop');

    expect(cancelled).toHaveBeenCalledWith('stop');
  });

  it('restore() puts the original fetch back', () => {
    const original = async () => wasmResponse([1]);
    const target = { fetch: original };

    const restore = trackFetch(() => {}, { target });
    expect(target.fetch).not.toBe(original);
    restore();

    expect(target.fetch).toBe(original);
  });
});

describe('progressFraction', () => {
  it('is 0.8 once every file is fully downloaded', () => {
    expect(
      progressFraction({
        'pyodide.asm.wasm': 9598218,
        'python_stdlib.zip': 2545637,
        'pyodide-lock.json': 119077,
      }),
    ).toBeCloseTo(0.8, 10);
  });

  it('scales linearly with the bytes counted', () => {
    expect(progressFraction({ 'pyodide.asm.wasm': 6131466 })).toBeCloseTo(0.4, 10);
  });

  it('is 0 before anything is counted', () => {
    expect(progressFraction({})).toBe(0);
  });

  it('never exceeds 0.8, even if more bytes arrive than the table promises', () => {
    expect(progressFraction({ 'pyodide.asm.wasm': 99_999_999 })).toBeCloseTo(0.8, 10);
  });

  it('is null (indeterminate) when a counted file is not in the size table', () => {
    expect(progressFraction({ 'pyodide.asm.wasm': 100, 'pyodide.asm.js': 5 })).toBeNull();
  });
});

describe('loadRuntime', () => {
  it('rejects with a CDN hint when the loader never resolves within timeoutMs', async () => {
    const never = () => new Promise(() => {});

    await expect(loadRuntime({ loader: never, timeoutMs: 50 })).rejects.toThrow(/did not load within/);
  });

  it('names the timeout in seconds and the likely cause', async () => {
    const never = () => new Promise(() => {});

    await expect(loadRuntime({ loader: never, timeoutMs: 1500 })).rejects.toThrow(
      /did not load within 1\.5 s \(CDN blocked or slow network\)/,
    );
  });

  it('resolves with the loader result and passes the pinned indexURL', async () => {
    const loader = vi.fn(async () => 'runtime');

    await expect(loadRuntime({ loader, timeoutMs: 1000 })).resolves.toBe('runtime');
    expect(loader).toHaveBeenCalledWith({ indexURL: PYODIDE_CDN });
  });

  it('puts the original global fetch back after success, failure and timeout', async () => {
    const original = vi.fn(async () => wasmResponse([1]));
    vi.stubGlobal('fetch', original);

    await loadRuntime({ loader: async () => 'ok', timeoutMs: 1000 });
    expect(globalThis.fetch).toBe(original);

    await expect(
      loadRuntime({
        loader: async () => {
          throw new Error('boom');
        },
        timeoutMs: 1000,
      }),
    ).rejects.toThrow('boom');
    expect(globalThis.fetch).toBe(original);

    await expect(loadRuntime({ loader: () => new Promise(() => {}), timeoutMs: 20 })).rejects.toThrow();
    expect(globalThis.fetch).toBe(original);
  });

  it('clears the timeout timer when the loader finishes first', async () => {
    vi.useFakeTimers();

    await loadRuntime({ loader: async () => 'ok', timeoutMs: 60_000 });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports download progress through the fetch wrapper while loading', async () => {
    vi.stubGlobal('fetch', async () => wasmResponse([1226293, 1226293]));
    const fractions = [];
    const loader = async () => {
      await (await globalThis.fetch(WASM)).arrayBuffer();
      return 'ok';
    };

    await loadRuntime({ loader, onProgress: (f) => fractions.push(f), timeoutMs: 1000 });

    expect(fractions).toHaveLength(2);
    expect(fractions[0]).toBeCloseTo((1226293 / 12262932) * 0.8, 6);
    expect(fractions[1]).toBeCloseTo((2452586 / 12262932) * 0.8, 6);
  });

  it('reports null (indeterminate) when the loader fetches an unlisted CDN file', async () => {
    vi.stubGlobal('fetch', async () => new Response(streamOf([10]), { status: 200 }));
    const fractions = [];
    const loader = async () => {
      await (await globalThis.fetch(PYODIDE_CDN + 'some-new-file.bin')).arrayBuffer();
      return 'ok';
    };

    await loadRuntime({ loader, onProgress: (f) => fractions.push(f), timeoutMs: 1000 });

    expect(fractions).toEqual([null]);
  });

  it('propagates a loader failure unchanged', async () => {
    const failure = new Error('network down');

    await expect(
      loadRuntime({
        loader: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
  });
});
