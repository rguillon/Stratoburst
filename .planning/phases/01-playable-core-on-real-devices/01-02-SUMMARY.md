---
phase: 01-playable-core-on-real-devices
plan: 02
subsystem: infra
tags: [github-actions, github-pages, gh-pages, pr-preview, playwright, make, deploy]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Walking skeleton production build (dist/), Makefile, Playwright smoke spec reading BASE_URL"
provides:
  - "Reusable quality gate workflow (gate.yml) shared by deploy and PR preview"
  - "Push-to-main deploy of dist/ to the gh-pages branch, only after a green gate"
  - "PR previews under pr-preview/pr-N/ (fork-safe, gated, cleaned on close)"
  - "Non-blocking Playwright e2e workflow"
  - "tools/live_url.mjs and tools/wait_for_deploy.mjs (+ make live-url, wait-deploy, e2e-live)"
  - "Live URL https://rguillon.github.io/Stratoburst/ serving the Python-driven ship, verified on the real host"
affects: [01-03, 01-10]

plan_head_before: a0c6adb2b3564f6cd3cc83a2efe824520bd15e19
plan_head_after: 9aa0bdc8d91461056ee23058cd45f444aaff731e

actuals:
  tokens: 4988
  tasks: 3
  commits: 4

tech-stack:
  added:
    - "actions/checkout v7.0.1, actions/setup-node v7.1.0, astral-sh/setup-uv v10.3.0 (SHA-pinned)"
    - "JamesIves/github-pages-deploy-action v4.9.0, rossjrw/pr-preview-action v1.8.1 (SHA-pinned)"
  patterns:
    - "Every third-party action pinned by 40-hex SHA with a version comment; top-level permissions read-only, contents: write only on the deploy and preview jobs"
    - "CI steps call Makefile targets (make install-python, lint, test-python, install-web, test-web, build, perf) so CI and local use identical commands"
    - "Deploy verification polls the public GitHub API plus the live URL; no tokens, no gh CLI"

key-files:
  created:
    - .github/workflows/gate.yml
    - .github/workflows/deploy.yml
    - .github/workflows/preview.yml
    - .github/workflows/e2e.yml
    - tools/live_url.mjs
    - tools/wait_for_deploy.mjs
    - LICENSE
  modified:
    - Makefile
    - README.md
    - .gitignore

key-decisions:
  - "Repository is rguillon/Stratoburst (name differs from the project name Scorched); the live URL is derived from the origin remote and is case-sensitive: https://rguillon.github.io/Stratoburst/"
  - "Remote .gitignore (GitHub Python template) and the local one conflicted on merge; resolved as the union, template first then the project block, after verifying no tracked file is matched"
  - "Pushed with a normal fast-forward push; never forced"

patterns-established:
  - "Pattern: a workflow step is a make target, never a raw command, so the gate is reproducible locally with make lint test build"
  - "Pattern: post-deploy verification is make wait-deploy then make e2e-live"

requirements-completed: [PLAT-01]

coverage:
  - id: D1
    description: "Gated deploy workflow publishes dist/ to gh-pages only after the reusable gate is green; Deploy run for HEAD concluded success"
    requirement: PLAT-01
    verification:
      - kind: other
        ref: "make wait-deploy SHA=9aa0bdc (run https://github.com/rguillon/Stratoburst/actions/runs/39043544453 concluded success)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live URL https://rguillon.github.io/Stratoburst/ returns 200 with the Scorched page and the Python-driven ship moves on the real static host"
    requirement: PLAT-01
    verification:
      - kind: e2e
        ref: "make e2e-live (tools/e2e/smoke.spec.js against BASE_URL = live URL: 1 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Host headers: gzip on the Pages JS bundle; br and access-control-allow-origin * on the jsDelivr Pyodide wasm"
    verification:
      - kind: other
        ref: "curl header probes recorded in this SUMMARY"
        status: pass
    human_judgment: false
  - id: D4
    description: "SHA pins, no target-branch PR trigger, fork guard, least-privilege permissions, clean-exclude and force: false"
    verification:
      - kind: other
        ref: "Task 1 acceptance greps (re-run in this continuation)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PR preview workflow behaviour (preview publish, sticky comment, cleanup on close)"
    verification: []
    human_judgment: true
    rationale: "Needs a real same-repo pull request to exercise; validated live in plan 01-10 (D-04). Wiring and guards are grep-checked only."

duration: 10min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 02: Gated Deploy to GitHub Pages Summary

**Four SHA-pinned workflows (reusable gate, gated gh-pages deploy, fork-safe PR preview, non-blocking e2e) plus two dependency-free deploy-verification scripts; the Python-driven ship is live at https://rguillon.github.io/Stratoburst/ and the Playwright smoke spec passes against it.**

## Performance

- **Duration:** about 10 min in this continuation (Task 1 and the user checkpoint were earlier; the user wait is excluded)
- **Completed:** 2026-10-17T15:08Z
- **Tasks:** 3 (Task 1 auto, Task 2 human-action resolved by the user, Task 3 auto)
- **Files modified:** 10 across the plan range (workflows, tools, Makefile, README, merged LICENSE and .gitignore)

## Deployment Facts (reused by plan 01-10)

| Item | Value |
|------|-------|
| Owner | `rguillon` |
| Repo | `Stratoburst` (public) |
| Origin remote | `git@github.com:rguillon/Stratoburst.git` (SSH) |
| Live URL | https://rguillon.github.io/Stratoburst/ (path is case-sensitive; derive with `make live-url`) |
| PR preview URL pattern | https://rguillon.github.io/Stratoburst/pr-preview/pr-N/ |
| Deploy run, first push (`4ea52ff`) | https://github.com/rguillon/Stratoburst/actions/runs/39043400116 : success |
| Deploy run, HEAD (`9aa0bdc`) | https://github.com/rguillon/Stratoburst/actions/runs/39043544453 : success |
| Page `<title>` | `Scorched` (the repo name differs from the project name) |

## Header Check Results (Task 3 step 4, raw curl as written)

- `curl -sI https://rguillon.github.io/Stratoburst/` : `HTTP/2 200`, `content-type: text/html; charset=utf-8`, `cache-control: max-age=600`, `access-control-allow-origin: *`.
- `curl -s` of the live index contains `<title>Scorched</title>`.
- Main JS asset `./assets/index-C5-M6qgH.js` with `Accept-Encoding: gzip`: `HTTP/2 200`, `content-type: application/javascript; charset=utf-8`, `content-encoding: gzip`, `cache-control: max-age=600` (A8 confirmed).
- `curl -sI -H 'Accept-Encoding: br' https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.asm.wasm`: `HTTP/2 200`, `content-encoding: br`, `access-control-allow-origin: *`.
- Pages `cache-control: max-age=600` means a returning visitor can see a stale build for up to 10 minutes after a deploy (RESEARCH Pitfall 12); the hashed asset names make this safe, only `index.html` can lag.

## Live Smoke

`make e2e-live` (`BASE_URL=https://rguillon.github.io/Stratoburst/ npx playwright test tools/e2e/smoke.spec.js`): `1 passed` (ship moves under ArrowRight, Pyodide from jsDelivr, on the real GitHub Pages host). Run twice, before and after the README commit, both green.

## Local Gate Before Push

`make lint test build`: ruff check and format clean; pytest 77 passed, coverage 100.00% (158 statements, 20 branches); vitest 22 passed; vite build OK (chunk-size and `node:*` externalization warnings are the known, harmless ones from plan 01-01).

## Task Commits

1. **Task 1: Gated deploy, PR-preview and e2e workflows plus deploy-verification scripts** - `40ccaf0` (feat, earlier executor)
2. **Task 2: User creates the public repo, Actions permissions and Pages** - no commit (checkpoint, resolved by the user)
3. **Task 3: Connect the remote, push main, verify live**
   - `4ea52ff` (chore) - merge of `origin/main` (README, LICENSE, GitHub `.gitignore` template)
   - `9aa0bdc` (docs) - README: live URL, gate-then-deploy flow, Makefile deployment targets

**Plan metadata:** committed separately (docs: complete plan).

The measured `commits: 4` (`git rev-list --count a0c6adb..HEAD`) is the three commits above plus the user's remote `Initial commit` (`4984396`) brought in by the merge.

## User Replies (checkpoint Task 2)

Task 2 (`checkpoint:human-action`, `gate="blocking"`) was resolved by the user. Reply, verbatim:

> git@github.com:rguillon/Stratoburst.git

The orchestrator verified it before this continuation: `git ls-remote` listed `refs/heads/main` and `refs/heads/gh-pages` (both at `4984396`) and SSH auth worked from this machine. The Task 3 precondition was re-checked read-only at the start of this continuation with the same result.

Earlier decision carried into this plan (plan 01-01 Task 1 approval, verbatim): "I also want you to use astral uv and a Makefile for the targets". It is the reason for the Makefile deviation below.

## Files Created/Modified

- `.github/workflows/gate.yml` - `workflow_call` gate; jobs `python` (uv) and `web` (Node); steps call make targets
- `.github/workflows/deploy.yml` - gate, then JamesIves deploy of `dist/` to `gh-pages` (`clean-exclude: pr-preview/`, `force: false`, `attempt-limit: 5`)
- `.github/workflows/preview.yml` - plain `pull_request`, same-repo guard, gate then rossjrw preview under `pr-preview/`
- `.github/workflows/e2e.yml` - non-blocking Playwright smoke in CI
- `tools/live_url.mjs` - `liveUrlFromRemote()` plus CLI printing the Pages URL
- `tools/wait_for_deploy.mjs` - polls the GitHub API for the Deploy run of a SHA, then polls the live page for the title
- `Makefile` - added `browsers-ci`, `perf`, `e2e-live`, `live-url`, `wait-deploy`
- `README.md` - live URL and deployment commands; `LICENSE`, `.gitignore` - merged from the remote

## Decisions Made

- Live URL is derived from the origin remote, not hardcoded, so a repo rename only needs `make live-url`. The repo name `Stratoburst` keeps its capital S in the URL because Pages paths are case-sensitive.
- The `.gitignore` merge keeps the GitHub Python template and appends the project block. Verified with `git ls-files -ci --exclude-standard` (empty) that no tracked file is matched; the template's `lib/`, `build/`, `*.spec` rules do not hit any repo path (`tools/e2e/smoke.spec.js` ends in `.js`).
- Left the README's project name as the user wrote it (`Stratoburst`) and added only the factual deployment section.

## Deviations from Plan

### User-requested

**1. [User requirement] CI steps call Makefile targets instead of raw commands**
- **Found during:** Task 1 (implemented by the previous executor)
- **Change:** `gate.yml` runs `make install-python`, `make lint`, `make test-python`, `make install-web`, `make test-web`, `make build`, `make perf` rather than the literal `uv sync --locked`, `uv run ruff ...`, `uv run pytest ...` lines. Source of the requirement: `.claude/CLAUDE.md` "Tooling - uv + Makefile" and the user's plan 01-01 reply above.
- **Acceptance impact:** the literal greps `grep -n "cov-fail-under=100" .github/workflows/gate.yml` and `grep -n "uv sync --locked" .github/workflows/gate.yml` return nothing. They are satisfied through the Makefile: `PYTEST_GATE := uv run pytest --cov --cov-branch --cov-fail-under=100` (Makefile line 6) and `install-python: uv sync --locked` (Makefile lines 23-24), which `gate.yml` invokes. The other Task 1 greps match directly (SHA pins, no `pull_request_target`, `clean-exclude`, `force: false`, fork guard, `continue-on-error: true`, read-only top-level plus job-level write permissions).
- **Files:** `.github/workflows/gate.yml`, `Makefile`
- **Committed in:** `40ccaf0`

### Auto-fixed Issues

**2. [Rule 3 - Blocking] `.gitignore` add/add merge conflict**
- **Found during:** Task 3 step 1 (`git merge --allow-unrelated-histories origin/main`)
- **Issue:** the plan expected no conflict because it assumed only a README would arrive. The user created the repo with GitHub's Python `.gitignore` template (and a LICENSE) as well, which conflicted with the local `.gitignore`.
- **Fix:** union of both files (template first, then the original project block including `.env*`, `dist/`, `.venv/`, `test-results/`, `.planning/research/.cache/`). Verified no tracked file is ignored and no needed file became ignored.
- **Files modified:** `.gitignore`
- **Verification:** `git ls-files -ci --exclude-standard` empty; `make lint test build` green; Deploy green.
- **Committed in:** `4ea52ff`

**3. [Rule 2 - Missing critical] Re-verification after the README commit**
- **Found during:** Task 3 acceptance
- **Issue:** the README commit moved HEAD past the first verified deploy, and the acceptance criterion is "Deploy run for `git rev-parse HEAD` concluded success".
- **Fix:** pushed the README commit and re-ran `make wait-deploy` and `make e2e-live` for the new HEAD (both green, runs recorded above).
- **Committed in:** `9aa0bdc`

---

**Total deviations:** 1 user-requested, 2 auto-fixed (1 blocking, 1 verification hygiene).
**Impact on plan:** none on scope; the Makefile routing is mandated by the user and the merge resolution was necessary to push.

## Authentication Gates

None. SSH push worked without prompting.

## Issues Encountered

- First Deploy run took roughly 3 minutes (queued, then in progress) and succeeded on the first attempt, so no fix-forward or gh-pages race re-run was needed.
- `make wait-deploy` correctly reported "no Deploy run yet" for a few polls right after the second push (API lag), then picked the run up.

## Known Stubs

None added by this plan. (Placeholder ship model and flat ground from plan 01-01 remain tracked in `.planning/WINDOWS.md`.)

## Threat Flags

None. No surface beyond the plan's threat model (T-01-06 plain `pull_request` and fork guard, T-01-07 SHA pins, T-01-09 concurrency/rebase/`clean-exclude`, T-01-10 `git ls-remote` before push, SSH credentials stay in the user's agent).

## User Setup Required

Completed by the user (D-05): public repo `rguillon/Stratoburst`, Actions workflow permissions read and write, `gh-pages` branch, Pages source "Deploy from a branch" gh-pages root. Confirmed working: Pages serves the deployed game.

## Next Phase Readiness

- Plan 01-03 can add the `perf` npm script; `gate.yml` already runs `make perf` (`npm run perf --if-present`).
- Plan 01-10 reuses the owner, repo and URLs above and must validate the PR preview path (D-04): open a same-repo PR, check `pr-preview/pr-N/` serves the build with the relative Vite base, and that closing the PR removes it.
- Open concern: the page `<title>` is `Scorched` while the repo is `Stratoburst`; naming is the user's call, and `wait_for_deploy.mjs --expect-title` must follow any rename.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: `.github/workflows/{gate,deploy,preview,e2e}.yml`, `tools/live_url.mjs`, `tools/wait_for_deploy.mjs` exist; commits `40ccaf0`, `4ea52ff`, `9aa0bdc` are ancestors of HEAD; `git ls-remote --heads origin` lists `main` (`9aa0bdc`) and `gh-pages`; live page contains `<title>Scorched</title>`; smoke spec 1 passed against the live URL.
