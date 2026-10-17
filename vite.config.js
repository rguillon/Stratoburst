import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Short commit id shown in the debug overlay and the device report. CI exports GITHUB_SHA;
// locally it comes from git; outside a checkout it falls back to 'dev'.
function buildHash() {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    const out = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] });
    return out.toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

// three is pinned exactly in package.json, so the report can name the real version.
const threeVersion = JSON.parse(readFileSync('package.json', 'utf8')).dependencies.three;

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash()),
    __THREE_VERSION__: JSON.stringify(threeVersion),
  },
  test: { include: ['web/test/**/*.test.js'], environment: 'node' },
});
