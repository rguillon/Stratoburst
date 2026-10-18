// Python tick cost in real Pyodide on Node: loads the repository's own scorched_core and
// scorched_web sources, runs the stress storm headlessly and fails above the budget.
// Usage: node tools/perf_node.mjs [--stress 500] [--ticks 600] [--budget-ms 3] [--fire 1]
//                                 [--weapon vulcan|laser|homing|all] [--level 1..5]
// --fire 1 holds the fire button and sweeps the ship, so the player's shots, the gallery enemies
// and the grid broadphase are exercised on top of the stress storm.
// --weapon picks the starting weapon; `all` runs vulcan, laser and homing in turn, each on a fresh
// game, and prints one JSON line per run with its `weapon`. --level sets the starting level.
// Exit code 1: a run averaged above the budget, or fire was held and the weapon never produced
// anything (a gate that measured nothing must not pass). Exit code 2: bad usage.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WARMUP_TICKS = 120;
const FRAME_MS = 16.667;

const WEAPONS = ['vulcan', 'laser', 'homing'];
// The header slot that proves each weapon is producing something: shots, the beam half-width, missiles.
const OUTPUT_SLOT = { vulcan: 'PBULLET_N', laser: 'BEAM_W', homing: 'MISSILE_N' };

const USAGE =
  'usage: perf_node.mjs [--stress N] [--ticks N] [--budget-ms N] [--fire 0|1] ' +
  '[--weapon vulcan|laser|homing|all] [--level N]';

function parseArgs(argv) {
  const options = { stress: 500, ticks: 600, budgetMs: 3, fire: 0, weapon: null, level: null };
  const numeric = {
    '--stress': 'stress',
    '--ticks': 'ticks',
    '--budget-ms': 'budgetMs',
    '--fire': 'fire',
    '--level': 'level',
  };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const raw = argv[i + 1];
    if (flag === '--weapon') {
      if (raw !== 'all' && !WEAPONS.includes(raw)) throw new Error(`${USAGE} (got ${flag} ${raw})`);
      options.weapon = raw;
      continue;
    }
    const key = numeric[flag];
    const value = Number(raw);
    if (!key || raw === undefined || !Number.isFinite(value)) throw new Error(`${USAGE} (got ${flag} ${raw})`);
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

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
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
const round = (v) => Math.round(v * 10000) / 10000;

// One measured run on a fresh game, so one weapon's state never skews another's numbers.
function measure(weapon) {
  const gameOptions = { seed: 1, stress: options.stress, god: true };
  if (weapon !== null) gameOptions.weapon = weapon;
  if (options.level !== null) gameOptions.level = options.level;
  const game = entry.create_game(pyodide.toPy(gameOptions));
  const manifestProxy = game.manifest();
  const manifest = manifestProxy.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false });
  manifestProxy.destroy();

  const header = new Float32Array(manifest.header.len);
  game.attach('header', header);
  for (const [name, { stride, cap }] of Object.entries(manifest.channels)) {
    game.attach(name, new Float32Array(stride * cap));
  }
  const tick = game.tick;

  const buttons = options.fire ? manifest.buttons.FIRE : 0;
  // Sweeping left and right 90 ticks at a time lets the shots cross the enemies' path.
  const sweep = (i) => (options.fire ? (Math.floor(i / 90) % 2 === 0 ? 1 : -1) : 0);
  const outputSlot = weapon === null ? null : manifest.header.slots[OUTPUT_SLOT[weapon]];
  let peakOutput = 0;

  for (let i = 0; i < WARMUP_TICKS; i++) tick(FRAME_MS, buttons, sweep(i), 0, 0, 0);

  const samples = new Float64Array(options.ticks);
  for (let i = 0; i < options.ticks; i++) {
    const start = performance.now();
    tick(FRAME_MS, buttons, sweep(WARMUP_TICKS + i), 0, 0, 0);
    samples[i] = performance.now() - start;
    if (outputSlot !== null) peakOutput = Math.max(peakOutput, header[outputSlot]);
  }

  const sorted = Array.from(samples).sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const result = { stress: options.stress, fire: options.fire };
  if (weapon !== null) result.weapon = weapon;
  if (options.level !== null) result.level = options.level;
  Object.assign(result, {
    ticks: options.ticks,
    avg_ms: round(avg),
    p95_ms: round(percentile(sorted, 0.95)),
    budget_ms: options.budgetMs,
  });
  // With fire held a weapon must have produced something, or the run measured an idle weapon.
  const idle = Boolean(options.fire) && outputSlot !== null && peakOutput === 0;
  if (outputSlot !== null) result.peak_output = round(peakOutput);
  return { result, failed: avg > options.budgetMs || idle, idle };
}

const runs = options.weapon === 'all' ? WEAPONS : [options.weapon];
let failed = false;
for (const weapon of runs) {
  const run = measure(weapon);
  console.log(JSON.stringify(run.result));
  if (run.idle) console.error(`perf: ${weapon} produced no output with fire held, so nothing was measured`);
  failed ||= run.failed;
}
process.exit(failed ? 1 : 0);
