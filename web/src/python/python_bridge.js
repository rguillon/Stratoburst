// Writes the bundled Python sources into the Pyodide FS and wires the typed-array channels.
// Python is reached only through pyimport and the held tick proxy: no source evaluation here.

export const PY_SOURCES = import.meta.glob('/src/**/*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const LIB_ROOT = '/lib';

export function installSources(pyodide, sources = PY_SOURCES) {
  for (const [key, text] of Object.entries(sources)) {
    const path = LIB_ROOT + key.slice('/src'.length);
    pyodide.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
    pyodide.FS.writeFile(path, text);
  }
  pyodide.pyimport('sys').path.insert(0, LIB_ROOT);
}

export async function startGame(pyodide, options) {
  installSources(pyodide);
  const entry = pyodide.pyimport('scorched_web.entrypoint');
  const game = entry.create_game(pyodide.toPy(options));

  const manifestProxy = game.manifest();
  const manifest = manifestProxy.toJs({
    dict_converter: Object.fromEntries,
    create_pyproxies: false,
  });
  manifestProxy.destroy();
  if (manifest.protocol !== 1) {
    throw new Error(`Unsupported protocol version ${manifest.protocol} (expected 1)`);
  }

  const header = new Float32Array(manifest.header.len);
  game.attach('header', header);
  const channels = {};
  for (const [name, { stride, cap }] of Object.entries(manifest.channels)) {
    channels[name] = new Float32Array(stride * cap);
    game.attach(name, channels[name]);
  }

  const tick = game.tick; // held once; called once per animation frame
  return { tick, game, manifest, header, slots: manifest.header.slots, channels };
}
