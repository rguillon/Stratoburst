// Derive the GitHub Pages URL (https://<owner>.github.io/<repo>/) from a git remote URL.
// Importing this module has no side effects; the CLI branch runs only when executed directly.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REMOTE_PATTERNS = [
  /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/,
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/,
];

/**
 * @param {string} remoteUrl SSH or HTTPS GitHub clone URL
 * @returns {string} the project Pages URL with a trailing slash
 */
export function liveUrlFromRemote(remoteUrl) {
  const text = String(remoteUrl).trim();
  for (const pattern of REMOTE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const [, owner, repo] = match;
      if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
        throw new Error(
          `Repository "${repo}" is a user site; this project must live in a normal repository`,
        );
      }
      return `https://${owner.toLowerCase()}.github.io/${repo}/`;
    }
  }
  throw new Error(`Not a recognised GitHub remote URL: "${text}"`);
}

/** Read the origin remote URL of the current checkout. */
export function originUrl() {
  return execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${liveUrlFromRemote(originUrl())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
