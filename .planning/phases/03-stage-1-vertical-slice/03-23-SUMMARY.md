---
phase: 03-stage-1-vertical-slice
plan: 23
subsystem: ui-hud
tags: [font, press-start-2p, hud, vendored-asset, ofl, vite, playwright]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: the HUD, banner, tally, boss bar, popups and game-over markup and CSS in index.html (03-10, 03-20, 03-21, 03-25)
provides:
  - web/src/assets/fonts/press-start-2p-latin-400-normal.woff2 (vendored, OFL-1.1) and public/fonts/OFL-press-start-2p.txt
  - web/src/ui/fonts.css (@font-face for Press Start 2P and the --hud-font stack with a monospace fallback)
  - every HUD and overlay text style in index.html on var(--hud-font), sizes retuned for the wide glyphs
  - tools/e2e/font.spec.js
affects: [03-26 HUD layout, 03-28 vertical-slice gate, Phase 4 PWA (the font is offline-friendly, self-hosted)]

actuals:
  tokens: 2600
  tasks: 2
  commits: 1
plan_head_before: 7fbd4cd774944dc5d83b3b02beb63320b66f4a96
plan_head_after: d2304f34b3dea4175274e30141afe4362ba3c182

tech-stack:
  added: []
  patterns:
    - "A third-party binary enters the repository only through a pinned npm tarball whose sha512 is checked against the registry before extraction; npm pack only, no install, no lockfile change"
    - "One :root custom property (--hud-font) carries the HUD font stack; every text style references it"

key-files:
  created:
    - web/src/assets/fonts/press-start-2p-latin-400-normal.woff2
    - public/fonts/OFL-press-start-2p.txt
    - web/src/ui/fonts.css
    - tools/e2e/font.spec.js
  modified:
    - index.html

key-decisions:
  - "Source approved by the user: @fontsource/press-start-2p@5.3.0 from the npm registry (OFL-1.1, repo github.com/fontsource/font-files, publisher jwr1 and lotusdevshack, integrity sha512-gxWFxdeD...5YkbyuQ==, published 2026-07-19)"
  - "Only the latin 400 woff2 (12512 bytes) and the package LICENSE are vendored; the other subsets and the .woff files stay out"
  - "font-display: block, so the HUD never swaps from a fallback face mid-play; the loading title uses the font from the first paint"
  - "The start gate button and the loading status line keep system-ui (the plan lists only the loading title); the PAUSED overlay also keeps system-ui, it is not in the plan's list"

patterns-established:
  - "font.spec.js probes dynamic elements (the score popup span) by creating one with the production class, instead of waiting for gameplay to produce one"

requirements-completed: [SCOR-08]

coverage:
  - id: D1
    description: "The HUD, banner, tally, boss timer, popups, MAX flash, game over and loading title render in the self-hosted Press Start 2P with a ui-monospace fallback stack"
    requirement: SCOR-08
    verification:
      - kind: e2e
        ref: "tools/e2e/font.spec.js"
        status: pass
    human_judgment: true
    rationale: "Whether the retuned pixel sizes, spacing and glows look like a 90s arcade cabinet on a real phone is a visual judgment; the spec pins the font loading and application only"
  - id: D2
    description: "The font is self-hosted: Vite emits the woff2 into dist/assets, exactly one font request is made and it goes to the page's own origin; the OFL text ships in dist/fonts"
    requirement: SCOR-08
    verification:
      - kind: e2e
        ref: "tools/e2e/font.spec.js"
        status: pass
      - kind: other
        ref: "make build; ls dist/assets | grep -c woff2 prints 1; dist/fonts/OFL-press-start-2p.txt present"
        status: pass
    human_judgment: false
  - id: D3
    description: "The package was verified by a human before any fetch, and the tarball sha512 matched the registry before extraction; no dependency or lockfile change"
    requirement: SCOR-08
    verification:
      - kind: other
        ref: "git diff --stat HEAD -- package.json package-lock.json prints nothing; recorded openssl sha512 of the tarball equals npm view dist.integrity"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 23: Arcade Pixel Font Summary

**Self-hosted Press Start 2P (latin, 400, OFL-1.1) vendored from an integrity-checked npm tarball and applied to the loading title, HUD, banners, tally, boss timer, popups, MAX flash and game-over overlay through one `--hud-font` stack with a monospace fallback.**

## Performance

- **Duration:** about 30 min, most of it the full `make check` run (11 min of Playwright)
- **Completed:** 2026-10-19T04:43Z
- **Tasks:** 2 (a blocking-human legitimacy checkpoint and a tracer)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Task 1 (checkpoint:human-verify, `gate="blocking-human"`): the user was shown the registry metadata (`npm view`: OFL-1.1, repo github.com/fontsource/font-files, maintainers jwr1 and lotusdevshack, integrity `sha512-gxWFxdeDglPhEYSwEeooomcaFK8kSQYLQwVxfnOJeYRj2sPEHXjpVtFgEaYfqzOjuAJGrIcJOipu2KY5YkbyuQ==`, published 2026-07-19) and replied "approved". Recorded as approved source: `@fontsource/press-start-2p@5.3.0` from the npm registry.
- Task 2: `npm pack --ignore-scripts` into an empty scratch directory; the sha512 of the tarball file, computed with openssl, matched the registry integrity before anything was extracted; only `package/LICENSE`, `package/package.json` (read, not vendored) and the one latin woff2 were extracted into a fresh empty directory; the woff2 (12512 bytes, a valid WOFF2 per `file`) and the licence were copied into the repository.
- `fonts.css` declares the face (`font-display: block`) and `--hud-font: 'Press Start 2P', ui-monospace, Menlo, Consolas, monospace`; `index.html` links it so Vite hashes the woff2 into `dist/assets` (`press-start-2p-latin-400-normal-_wFEWmAB.woff2`, relative `./` url).
- Every HUD and overlay style moved to the font at weight 400 (no faux bold), with smaller sizes and tighter letter-spacing for the 1em-wide glyphs, the existing palette glows kept and a faint cyan glow added to the HUD and game-over text (never orange-yellow). The boss bar offset follows the new HUD row height.
- `font.spec.js` checks the face reports `loaded`, `document.fonts.check` is true, the computed font-family of ten selectors starts with Press Start 2P, and exactly one font request is made, to the page's origin and under `/assets/`.

## Task Commits

1. **Task 1: package legitimacy checkpoint** - no commit (human approval only)
2. **Task 2 (tracer): vendored font loaded and applied** - `d2304f3` (feat)

**Plan metadata:** the docs commit carrying this SUMMARY, STATE.md and ROADMAP.md.

The tracer gate ran in auto/end-of-phase mode with an automated-only verify: `make test-web`, `make build` (woff2 count 1) and `font`, `score`, `boot` specs were re-run end to end before the full gate (tracer verified end to end).

## Verification

- `make test-web`: 73 files, 1642 vitest tests passed. `make lint` clean, `make test` 2101 pytest passed at 100.00% line and branch coverage. `make build` emits the woff2 (count 1).
- Targeted run `font.spec.js` + `score.spec.js` + `boot.spec.js`: green (font.spec.js after the probe fix below, re-run alone).
- `make check` e2e: 99 of 101 passed. The two failures (`intro.spec.js` banner/PLAY poll and `boot.spec.js` `?crash=js`) are load-induced timing races unrelated to the font; both pass in isolation (14/14 on a re-run of both files). Logged in deferred-items.md, not fixed, per the constraint.

## Files Created/Modified

- `web/src/assets/fonts/press-start-2p-latin-400-normal.woff2` - vendored font, 12512 bytes
- `public/fonts/OFL-press-start-2p.txt` - SIL OFL 1.1 text with the Press Start 2P copyright line (copied from the package LICENSE)
- `web/src/ui/fonts.css` - @font-face and `--hud-font`
- `index.html` - stylesheet link and the font on the loading title, HUD, MAX flash, popups, boss timer, banner, tally, game over
- `tools/e2e/font.spec.js` - the font is loaded, applied and self-hosted

## Decisions Made

See key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first font.spec.js version probed the `#popups` container**
- **Found during:** Task 2 verify
- **Issue:** the container has no font rule (only the `.popup` spans do), so the spec read the default "Times New Roman" for `#popups`. The product is right; the probe was wrong.
- **Fix:** the spec appends a hidden probe span with the production `.popup` class, reads its font-family, and removes it.
- **Files modified:** tools/e2e/font.spec.js
- **Committed in:** d2304f3

**2. [Rule 1 - Bug] A foreign-origin check would have tripped on the Pyodide CDN**
- **Found during:** Task 2 (writing the spec)
- **Issue:** a "no request leaves the origin" check would also catch the Pyodide runtime files fetched from the CDN, which is by design and not part of this plan.
- **Fix:** the spec filters on `resourceType() === 'font'` and asserts the single font request is same-origin.
- **Files modified:** tools/e2e/font.spec.js
- **Committed in:** d2304f3

---

**Total deviations:** 2 auto-fixed (2 Rule 1, both in the new spec before its first commit)
**Impact on plan:** none on scope. The user-approved source and the integrity check were applied as the orchestrator instructed.

## Issues Encountered

- Two load-sensitive e2e flakes in the full run (see Verification and deferred-items.md).
- The HUD uses the glyphs U+25B2 (life) and U+25CF (bomb pip). Press Start 2P's latin subset does not contain them, so they render from the monospace fallback in the stack. They look fine in a screenshot at desktop and phone sizes; a pixel-style life and bomb icon would be a later polish item.
- The commit protocol's protected-branch assertion would trip on `main`; the orchestrator runs this phase sequentially on `main` (no origin remote, `allow_default_branch_commits: true` in config), so the commit was made there with the project-root pin passing first.

## Known Stubs

None.

## Threat Flags

None. T-03-31 is mitigated (self-hosted, one same-origin font request, asserted by the spec). T-03-SC is mitigated as planned: blocking human checkpoint answered "approved" before any fetch, exact version pinned, sha512 of the tarball compared with the registry before extraction, one woff2 and the licence copied, no install, no lifecycle scripts, `package.json` and `package-lock.json` unchanged.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-26 (HUD layout from the projected playfield) can rely on `--hud-font` and on the narrower HUD sizes.
- Open and left alone, as instructed: boss data and hit rules (the open user design decision).
- The visual feel of the retuned sizes on a real phone belongs to the end-of-phase device check.

## Self-Check: PASSED

- Created files present: the woff2, the OFL text, fonts.css and font.spec.js (checked with `[ -f ]` below).
- Commit `d2304f3` is an ancestor of HEAD.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-19*
