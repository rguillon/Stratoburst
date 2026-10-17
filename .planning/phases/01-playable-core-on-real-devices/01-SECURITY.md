---
phase: "01"
slug: "playable-core-on-real-devices"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-17"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser lifecycle events → simulation clock | Visibility, focus and page lifecycle events control whether time advances |
| Browser viewport events → renderer allocation | Resize storms (mobile address bar) drive GPU buffer reallocations |
| CI → gh-pages branch | Two workflows write the same branch |
| DOM keyboard/pointer events → JS sampler → Python tick arguments | Values cross into the simulation every frame |
| Developer machine → GitHub | git push credentials |
| Device data → clipboard → user | The report contains device fingerprint-like strings (UA, GPU) |
| Exception text (Python traceback, JS stack) → DOM | Error text may contain markup-like content, including echoed URL data |
| Global fetch → all network requests | The progress wrapper temporarily replaces a global |
| PR preview → public URL | An unmerged build is reachable by anyone with the link |
| Pull-request authors → GitHub Actions | PR code runs in CI; forks must not get write tokens |
| Python exception / JS error text → DOM | Error text can contain markup-looking characters |
| Simulation → memory | Spawners could grow entity counts without bound |
| Third-party actions → CI runner | Action code executes with the job's token |
| URL query (`?crash=`) → fault injection | A shared link can request an intentional crash |
| URL query (`?stress=`) → Python allocation | A shared link controls how many bullets are allocated and simulated |
| URL query (`?tier=`, `?debug`) → presentation settings | A shared link controls tier forcing and overlay visibility |
| URL query string → JS app | Untrusted, attacker-controllable flags (a shared link can carry any parameters) |
| User's devices → pasted report text → public repository | Device and browser strings become public once committed |
| jsDelivr CDN availability → boot | Blocked or slow CDN must not hang the page |
| jsDelivr CDN → player's browser | Pyodide runtime (wasm, stdlib zip, lockfile) fetched at load (D-02) |
| npm / PyPI / nodejs.org → developer machine | Third-party code and binaries installed into the toolchain |

---

## Threat Register

All 36 register rows were authored at plan time (27 unique IDs; T-01-SC repeats in all 10 plans and was verified once). Each row is verified with file:line evidence by gsd-security-auditor on 2026-10-17.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | runtime_loader.js Pyodide from jsDelivr | medium | mitigate |  Exact version path `v314.0.7` (immutable once published) plus exact npm pin `pyodide@314.0.7` with default `checkAPIVersion`, so a mismatched core throws at load. SRI cannot co... | closed |
| T-01-02 | Tampering (XSS) | url_flags.js, error_panel.js | medium | mitigate |  URLSearchParams with allow-lists (stress clamped integer, tier/crash enumerations, all other parameters ignored). Error and stack text inserted with textContent only; the accep... | closed |
| T-01-03 | Information disclosure | `globalThis.__scorched` debug hook | low | accept |  Exists only with `?debug`, exposes only game-state floats and parsed flags, no secrets exist in the app.  | closed (accepted) |
| T-01-04 | Denial of service | RenderSink / assign length drift | low | mitigate |  RenderSink.attach validates `target.length == len(buffer)` and channel names at boot (pytest-covered), so drift fails loudly at load instead of on a later frame.  | closed |
| T-01-05 | Tampering | Node.js tarball download | high | mitigate |  SHA-256 verified against the official SHASUMS256.txt before extraction; abort on mismatch; human-approved in Task 1.  | closed |
| T-01-06 | Elevation of privilege | preview.yml | high | mitigate |  Plain `pull_request` trigger only (acceptance grep finds no target-variant trigger). Fork guard `head.repo.full_name == github.repository` on both jobs. Read-only top-level per... | closed |
| T-01-07 | Tampering | third-party actions in all workflows | high | mitigate |  Full 40-hex commit SHA pins with version comments (acceptance grep rejects `@vN` tags). Review diffs when bumping.  | closed |
| T-01-08 | Information disclosure | repository contents | low | mitigate |  No secrets needed (GITHUB_TOKEN only). `.gitignore` already excludes `.env*` (plan 01-01).  | closed |
| T-01-09 | Tampering / DoS | concurrent writes to gh-pages | low | mitigate |  Distinct concurrency groups (`deploy-main`, `preview-<ref>`), `force: false` (rebase), `attempt-limit: 5`, `clean-exclude: pr-preview/`. A transient failure is re-runnable.  | closed |
| T-01-10 | Spoofing | origin URL supplied at the checkpoint | low | accept |  The user supplies their own repository URL. `git ls-remote` confirms the expected branches before push. Credentials stay in the user's SSH agent or credential helper, never in ... | closed (accepted) |
| T-01-11 | Denial of service | `?stress=N` → Game / BulletPool | medium | mitigate |  Defense in depth: url_flags clamps to 1..5000 (plan 01-01), and Game independently clamps `stress` to 0..EBULLET_MAX_CAP (pytest case 99999 → 5000). The ebullet buffer is cappe... | closed |
| T-01-12 | Tampering | tools/perf_node.mjs in CI | low | accept |  Loads only repository sources and the lockfile-pinned npm `pyodide` package. No network or secrets.  | closed (accepted) |
| T-01-13 | Information disclosure | report.js / Copy report | low | accept |  The report is assembled only on an explicit click and goes only to the clipboard or a local textarea. There is no network path (acceptance grep: no beacon, XHR or WebSocket, an... | closed (accepted) |
| T-01-14 | Denial of service | `?tier=` and the auto controller | low | mitigate |  The tier value is allow-listed in parseUrlFlags (invalid means auto). The controller rate-limits to one change per 3 s and locks after a non-improving step, so it cannot thrash... | closed |
| T-01-15 | Denial of service | renderer_rig.js resize and refit | low | mitigate |  Coalesce to one resize per animation frame, and reallocate or refit only when the integer CSS size or DPR changes (plan 01-04 rule kept). Terrain chunk regeneration happens onl... | closed |
| T-01-16 | Tampering / DoS | input_sampler.js → Game.tick drag/move arguments | medium | mitigate |  Non-finite values are zeroed in JS (touch_mapper, sampler) and ignored again in Python (`PlayerShip.add_drag` and `step` use math.isfinite). Pending is capped at TOUCH_LAG_CAP,... | closed |
| T-01-17 | Denial of service | touch_input.js pointer capture | low | mitigate |  setPointerCapture is wrapped in try/catch, only one steering pointer is tracked, and the pointer is released on up, cancel or lostpointercapture, so a stuck pointer cannot free... | closed |
| T-01-18 | Denial of service | DroneSwarm, TwinShot, BulletPool, UniformGrid | low | mitigate |  Hard caps everywhere: DRONE_MAX_ALIVE 10 within DRONE_CAP 32 storage, PBULLET_CAP 128 (volleys dropped when full), grid capacity DRONE_CAP. Preallocated arrays only; the alloca... | closed |
| T-01-19 | Tampering | Game.tick dt input after a long absence | low | mitigate |  The 100 ms MAX_DT_MS clamp with MAX_STEPS 3 and backlog drop; resume zeroes the accumulator and estimator and resets the JS frame clock (pytest: a 5000 ms dt while paused runs ... | closed |
| T-01-20 | Repudiation / integrity of play | pause_controller.js | low | mitigate |  The simulation runs 0 steps while hidden or blurred and requires explicit input to resume (prohibition recorded). Input state is cleared on every pause trigger.  | closed |
| T-01-21 | Tampering (XSS) | error_panel.js | medium | mitigate |  textContent only for message, stack and notices (acceptance grep finds no HTML-string APIs in web/src). Report copy happens only inside a click handler.  | closed |
| T-01-22 | Denial of service | loadRuntime / CDN | medium | mitigate |  The 60 s timeout rejects into the error panel, with a Reload button and a message naming the CDN or network as the likely cause. There is no infinite spinner.  | closed |
| T-01-23 | Tampering | trackFetch global fetch wrapper | low | mitigate |  Active only for the duration of loadPyodide (restored in finally). Counts only URLs under the exact PYODIDE_CDN prefix, and returns other responses untouched (vitest-covered).  | closed |
| T-01-24 | Denial of service | `?crash=py|js` | low |  accept  | closed |
| T-01-25 | Information disclosure | 01-DEVICE-REPORTS.md (public repo) | low | mitigate |  The checkpoint tells the user the reports will be committed publicly and to redact anything sensitive. Reports hold only UA, screen and GPU strings and timings, with no persona... | closed |
| T-01-26 | Information disclosure | PR preview of an unmerged build | low | accept |  Same-repo branch only (fork PRs are excluded by the preview workflow guard). The build contains no secrets, and the preview is removed when the PR closes.  | closed (accepted) |
| T-01-SC | Tampering | npm/pip installs | high | mitigate |  Package-legitimacy gate: blocking-human checkpoint (Task 1) before any install, exact pins, committed `package-lock.json` and `uv.lock` (CI uses `npm ci` / `uv sync --locked` f... | closed |

*Full mitigation plans are in each plan's `<threat_model>`. The auditor's per-threat file:line evidence is summarized in the audit trail below.*

**Warning (non-blocking, T-01-SC):** the claim "no dependency has install scripts" holds for the 5 direct packages only. The transitive `fsevents@2.3.3` (optional, macOS-only, pulled in by vite; `package-lock.json` `hasInstallScript: true`) has one. It never installs on Linux CI or the Linux dev host, so no install script runs anywhere installs happen today. `npm ci` (Makefile `install-web`) does not pass `--ignore-scripts`, so a macOS checkout would run it. Follow-up options: add `--ignore-scripts` to `npm ci`, or accept the risk as macOS-only and integrity-pinned.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-03 | The `__scorched` debug hook exists only with `?debug` and exposes game state only. | plan 01-01 threat model | 2026-10-17 |
| AR-02 | T-01-10 | The origin URL is supplied by the user. SSH credentials stay in the user's agent and never enter the repo. | plan 01-02 threat model | 2026-10-17 |
| AR-03 | T-01-12 | The perf harness loads only repo sources and the lockfile-pinned `pyodide` from node_modules. It makes no network calls. | plan 01-03 threat model | 2026-10-17 |
| AR-04 | T-01-13 | The device report leaves the device only through the clipboard or a local textarea, and only on an explicit click. | plan 01-04 threat model | 2026-10-17 |
| AR-05 | T-01-24 | A `?crash=` link affects only the visitor who opens it, and its value is allow-listed on both the JS and Python sides. | plan 01-09 threat model | 2026-10-17 |
| AR-06 | T-01-26 | PR previews are same-repo only, use no secrets, and are removed on close (verified: pr-1 returns 404). | plan 01-10 threat model | 2026-10-17 |
| AR-07 | T-01-01 (residual) | SRI cannot cover Pyodide's internal CDN fetches. Mitigated by the immutable versioned CDN path and the exact npm pin with `checkAPIVersion`. Accepted for a friends-only game; self-hosting is deferred to Phase 4. | plan 01-01 threat model | 2026-10-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-17 | 27 unique (36 rows) | 27 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

Audit notes: 156 cited pytest cases were re-run and passed. The JS evidence was checked by file:line only, since vitest writes a cache into the repo. The auditor independently re-verified the Node tarball SHA-256 (T-01-05) and that every action SHA matches its upstream tag (T-01-07). T-01-25 and the T-01-SC human gate rest on recorded procedure. No implementation files were modified.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-17
