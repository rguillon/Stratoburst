// Wait until the Deploy workflow run for a commit has succeeded and the live site serves the page.
// Reads only public GitHub API endpoints (the repository is public), so no token is needed.
//   node tools/wait_for_deploy.mjs [--sha <commit>] [--workflow Deploy] [--timeout-min 20]
//                                  [--expect-title Scorched]
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { liveUrlFromRemote, originUrl } from './live_url.mjs';

const POLL_MS = 30_000;

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    workflow: { type: 'string', default: 'Deploy' },
    'timeout-min': { type: 'string', default: '20' },
    'expect-title': { type: 'string', default: 'Scorched' },
  },
});

const sha = values.sha ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const timeoutMs = Number(values['timeout-min']) * 60_000;
const expectedTitle = `<title>${values['expect-title']}</title>`;
const remote = originUrl();
const liveUrl = liveUrlFromRemote(remote);
const [, owner, repo] = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(remote);
const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?branch=main&per_page=10`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = Date.now() + timeoutMs;
let lastState = 'no state observed yet';

async function findRun() {
  const response = await fetch(runsUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'scorched-wait-for-deploy' },
  });
  if (!response.ok) {
    lastState = `GitHub API answered HTTP ${response.status}`;
    return undefined;
  }
  const { workflow_runs: runs } = await response.json();
  const run = runs.find((r) => r.name === values.workflow && r.head_sha === sha);
  lastState = run
    ? `run ${run.html_url} status=${run.status} conclusion=${run.conclusion}`
    : `no "${values.workflow}" run for ${sha.slice(0, 7)} yet`;
  return run;
}

async function pageIsLive() {
  const response = await fetch(`${liveUrl}?cb=${Date.now()}`, { cache: 'no-store' });
  const body = response.ok ? await response.text() : '';
  lastState = `${liveUrl} answered HTTP ${response.status}${
    response.ok && !body.includes(expectedTitle) ? ` without ${expectedTitle}` : ''
  }`;
  return response.ok && body.includes(expectedTitle);
}

let runUrl;
while (Date.now() < deadline) {
  try {
    if (!runUrl) {
      const run = await findRun();
      if (run?.status === 'completed') {
        if (run.conclusion !== 'success') {
          console.error(`Deploy run concluded "${run.conclusion}": ${run.html_url}`);
          process.exit(1);
        }
        runUrl = run.html_url;
      }
    }
    if (runUrl && (await pageIsLive())) {
      console.log(`OK ${sha.slice(0, 7)} deployed (run conclusion: success, ${runUrl}); live at ${liveUrl}`);
      process.exit(0);
    }
  } catch (error) {
    lastState = `request failed: ${error.message}`;
  }
  console.log(`waiting: ${lastState}`);
  await sleep(POLL_MS);
}

console.error(`Timed out after ${values['timeout-min']} min. Last state: ${lastState}`);
process.exit(1);
