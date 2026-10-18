// Python tick cost in real Pyodide on Node: loads the repository's own scorched_core and
// scorched_web sources, runs the stress storm headlessly and fails above the budget.
// Usage: node tools/perf_node.mjs [--stress 500] [--ticks 600] [--budget-ms 3] [--fire 1]
// --fire 1 holds the fire button and sweeps the ship, so twin-shot bolts, the drone swarm and
// the grid broadphase are exercised on top of the stress storm.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WARMUP_TICKS = 120;
const FRAME_MS = 16.667;

function parseArgs(argv) {
  const options = { stress: 500, ticks: 600, budgetMs: 3, fire: 0 };
  const keys = { '--stress': 'stress', '--ticks': 'ticks', '--budget-ms': 'budgetMs', '--fire': 'fire' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = keys[argv[i]];
    const value = Number(argv[i + 1]);
    if (!key || !Number.isFinite(value)) {
      throw new Error(`usage: perf_node.mjs [--stress N] [--ticks N] [--budget-ms N] [--fire 0|1] (got ${argv[i]} ${argv[i + 1]})`);
    }
    options[key] = value;
  }
  return options;
}

function pythonSources(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === '__pycache__') continue;
    if (statSync(path).isDirectory()) found.push(...pythonSources(path));
    else if (name.endsWith('.py')) found.push(path);
  }
  return found;
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

const options = parseArgs(process.argv.slice(2));
const pyodide = await loadPyodide({ stdout: () => {}, stderr: (line) => console.error(line) });

// Sources go in as strings (not Buffers), so the Pitfall 2 typed-array issue cannot arise.
const srcRoot = join(ROOT, 'src');
for (const file of pythonSources(srcRoot)) {
  const target = '/lib/' + relative(srcRoot, file).split('\\').join('/');
  pyodide.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
  pyodide.FS.writeFile(target, readFileSync(file, 'utf8'));
}
pyodide.pyimport('sys').path.insert(0, '/lib');

const entry = pyodide.pyimport('scorched_web.entrypoint');
const game = entry.create_game(pyodide.toPy({ seed: 1, stress: options.stress, god: true }));
const manifestProxy = game.manifest();
const manifest = manifestProxy.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false });
manifestProxy.destroy();

game.attach('header', new Float32Array(manifest.header.len));
for (const [name, { stride, cap }] of Object.entries(manifest.channels)) {
  game.attach(name, new Float32Array(stride * cap));
}
const tick = game.tick;

const buttons = options.fire ? manifest.buttons.FIRE : 0;
// Sweeping left and right 90 ticks at a time lets the bolts cross the drones' path.
const sweep = (i) => (options.fire ? (Math.floor(i / 90) % 2 === 0 ? 1 : -1) : 0);

for (let i = 0; i < WARMUP_TICKS; i++) tick(FRAME_MS, buttons, sweep(i), 0, 0, 0);

const samples = new Float64Array(options.ticks);
for (let i = 0; i < options.ticks; i++) {
  const start = performance.now();
  tick(FRAME_MS, buttons, sweep(WARMUP_TICKS + i), 0, 0, 0);
  samples[i] = performance.now() - start;
}

const sorted = Array.from(samples).sort((a, b) => a - b);
const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
const round = (v) => Math.round(v * 10000) / 10000;
const result = {
  stress: options.stress,
  fire: options.fire,
  ticks: options.ticks,
  avg_ms: round(avg),
  p95_ms: round(percentile(sorted, 0.95)),
  budget_ms: options.budgetMs,
};
console.log(JSON.stringify(result));
process.exit(avg > options.budgetMs ? 1 : 0);
