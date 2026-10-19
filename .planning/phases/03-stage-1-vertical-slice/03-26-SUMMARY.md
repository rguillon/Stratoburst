---
phase: 03-stage-1-vertical-slice
plan: 26
subsystem: ui-hud
tags: [hud, layout, touch, bomb-button, extend, banner, vitest, playwright]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: the pixel-font HUD and its sizes (03-23), the status readout (03-07), the banner overlay (03-10, 03-20, 03-21), the bomb button layout and projected playfield corners (Phase 2 input plans)
provides:
  - web/src/ui/hud_layout.js (pure layoutHud: top band, bottom-left and bottom-right anchors from the projected corners, safe insets and the bomb button rectangle)
  - status_readout.place(layout) and a new .hud-br block (weapon and level), the lives pulse
  - banner_overlay EXTEND banner (#extend, handle + tick)
  - tools/e2e/hud.spec.js
affects: [03-27 perf gate, 03-28 vertical-slice gate (end-of-phase iPhone check of the HUD)]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: a3c564edcc65c39d5201d3202e57115d1cee7eb4
plan_head_after: 2da5f0a26d43e5187346957dcaf4be31fce51359

tech-stack:
  added: []
  patterns:
    - "Pure layout module returning plain rectangles; the DOM owner caches the written transform string and writes only on change"
    - "Event-driven timed elements start counting at the first frame tick after the event, so they follow the frame clock (like the MAX flash)"

key-files:
  created:
    - web/src/ui/hud_layout.js
    - web/test/ui/hud_layout.test.js
    - tools/e2e/hud.spec.js
  modified:
    - web/src/ui/status_readout.js
    - web/test/ui/status_readout.test.js
    - web/src/ui/banner_overlay.js
    - web/test/ui/banner_overlay.test.js
    - index.html
    - web/src/main.js

key-decisions:
  - "The three HUD blocks are placed with transforms from layoutHud's anchors; the bottom-right block is right-aligned (anchor = its right edge, translateX(-100%)), so its unknown text width never matters"
  - "The overlap test against the bomb button uses a fixed 120 px block width (a six-letter weapon name at the largest font) and the block height param (default 48); the e2e checks the real bounding boxes"
  - "Lives and bombs, and weapon and level, are stacked as two short lines each so the 9-icon and 7-pip rows fit a 390 px viewport"
  - "The boss bar follows the top band through a --hud-top custom property written by main.js after each layout, so it stays under the score now that the band no longer sits at the viewport top"

patterns-established:
  - "main.js lays out the bomb button first, then the HUD from the same projection and the button's fresh rectangle (null when hidden); toggling touch mode re-lays out only when visibility actually changed (every keydown calls setTouchMode)"
  - "A debug hook fx.inject(type, a, b) feeds one event through the production fx dispatcher for e2e specs"

requirements-completed: [SCOR-08, SCOR-04]

coverage:
  - id: D1
    description: "Score and high score sit along the top edge of the playfield, lives and bombs at its bottom-left, weapon and level at its bottom-right, laid out from the projected corners inside the safe insets and re-laid out on resize"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "web/test/ui/hud_layout.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/hud.spec.js (desktop corners and resize)"
        status: pass
    human_judgment: true
    rationale: "Whether the framing reads like an arcade cabinet on a real phone is a visual judgment; the human-check in the plan covers the iPhone in portrait"
  - id: D2
    description: "On a phone the weapon and level block never collides with the touch bomb button: it moves above the button when they overlap and returns to the corner in keyboard mode"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "web/test/ui/hud_layout.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/hud.spec.js (390 x 844 touch, and 390 x 520 with no margin)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An extend shows an EXTEND banner for about 1.2 s and pulses the lives for about 0.6 s, on the frame clock, restarted rather than stacked"
    requirement: SCOR-04
    verification:
      - kind: unit
        ref: "web/test/ui/banner_overlay.test.js, web/test/ui/status_readout.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/hud.spec.js (extend)"
        status: pass
    human_judgment: false
  - id: D4
    description: "At the maximum values the HUD holds: 9999999 score, 9 life icons (lives above 9 show 9), 7 bomb pips, Lv 5; 0 bombs shows no pips; a fractional score rounds to the nearest integer"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "web/test/ui/status_readout.test.js (the HUD at its limits)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/hud.spec.js (every block inside the viewport at 390 px)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 26: HUD Layout Summary

**The HUD now frames the playfield like an arcade cabinet (score along the top, lives and bombs bottom-left, weapon and level bottom-right) from the projected corners and safe insets, hops above the touch bomb button when they collide, and an extend flashes EXTEND and pulses the lives.**

## Performance

- **Duration:** about 45 min, 12 min of it the full `make check` run
- **Completed:** 2026-10-19
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- Task 1 (tracer): `layoutHud` is a pure function returning `{ top, bottomLeft, bottomRight }` in CSS pixels. The top band follows the far (narrower) edge, the bottom blocks the near edge, all clamped to the viewport minus the safe insets. When `bombRect` overlaps the bottom-right block's area the block moves above it with an 8 px gap (never above the safe top); a null or non-overlapping rectangle leaves it in the corner. `status_readout.place(layout)` writes the three blocks as transforms only when the value changed. `index.html` gets the `.hud-br` block, flex-column blocks and the placement CSS. `main.js` computes the projection once, places the bomb button, then lays out the HUD with the button's rectangle, on the same coalesced resize path, and again when touch mode toggles visibility.
- Task 2: `banner_overlay` gets `#extend` (static markup, `handle(EXTEND)` shows it, `tick(nowMs)` hides it 1200 ms after the next tick, a second extend restarts the timer). `status_readout.handle(EXTEND)` adds a `pulse` class to `.lives` for 600 ms (a single CSS scale pulse, off under reduced motion; a second extend mid-pulse drops and re-adds the class so the animation restarts). `main.js` registers the banner with the fx dispatcher and ticks it each frame. The caps and rounding were already right and are now pinned by tests.
- `hud.spec.js` (4 specs): 390 x 844 touch (blocks inside the viewport, no intersection with `bombButton.rect`), 390 x 520 touch with no margin (button overlays the corner, block above it, drops back after a keydown), 1280 x 800 desktop (blocks within 40 px of the projected corners, then a resize to 800 x 1000), and an injected EXTEND event.

## Task Commits

1. **Task 1 RED:** `5301ac7` (test) failing tests for `layoutHud` and `place`
2. **Task 1 GREEN (tracer):** `24aa468` (feat) HUD over the playfield edges, clear of the bomb button
3. **Task 2 RED:** `4e6a207` (test) failing tests for EXTEND banner, pulse and limits
4. **Task 2 GREEN:** `2da5f0a` (feat) an extend flashes EXTEND and pulses the lives

No refactor commit was needed.

The tracer gate ran in auto/end-of-phase mode with an automated-only verify: `make test-web`, `make build` and the hud, touch, bomb, weapons and font specs were re-run end to end (28/28) before Task 2 (tracer verified end to end).

## Verification

- `make lint` clean. `make test`: 2101 pytest passed at 100.00% line and branch coverage (Python untouched); vitest 74 files, 1669 tests passed (was 1642, +27).
- `make build` ok. Targeted e2e: hud, touch, bomb, weapons, font (28/28), hud + score (5/5).
- `make check` e2e: 101 of 105 passed. The four failures (`boot.spec.js` ?crash=js, `intro.spec.js` banner, `keyboard.spec.js` AZERTY KeyW, `smoke.spec.js` arrow keys) are load-induced timing races, unrelated to the HUD; all four files re-run together passed 20/20. Logged in deferred-items.md, not fixed, per the constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Boss bar anchored to the viewport top, no longer under the score band**
- **Found during:** Task 1
- **Issue:** the boss HP bar's `top` was computed from the safe inset plus the old HUD row height; with the score band now at the playfield's far edge it would no longer sit under the score.
- **Fix:** `place`'s caller (`main.js`) writes `--hud-top` on the root element after each layout; the boss bar's `top` is `var(--hud-top, <old default>)` plus the band height.
- **Files modified:** index.html, web/src/main.js
- **Commit:** 24aa468

**2. [Rule 3 - Blocking] Debug hook to inject an event for the extend e2e**
- **Found during:** Task 2
- **Issue:** no URL flag grants an extend (200,000 points), and adding a Python flag is out of scope; the e2e needs a deterministic EXTEND.
- **Fix:** a debug-only hook `__scorched.fx.inject(type, a, b)` that feeds one event through the production fx dispatcher.
- **Files modified:** web/src/main.js, tools/e2e/hud.spec.js
- **Commit:** 2da5f0a

No boss data or hit rules were touched.

## Known Stubs

None.

## Threat Flags

None. Text still goes in through `textContent` from integers and static markup (T-03-34); layout writes numeric styles only; no packages added, lockfiles unchanged (T-03-SC).

## Issues Encountered

- The full e2e run produced two new load flakes (keyboard AZERTY, smoke arrow keys) next to the known two; recorded in deferred-items.md.

## Human check outstanding

At the end-of-phase review on the iPhone in portrait: score and high score along the top, lives and bombs bottom-left, weapon and level bottom-right above the bomb button, all readable in the pixel font.

## Self-Check: PASSED

- FOUND: web/src/ui/hud_layout.js, web/test/ui/hud_layout.test.js, tools/e2e/hud.spec.js
- FOUND commits: 5301ac7, 24aa468, 4e6a207, 2da5f0a
- `grep "layoutHud(" web/src/main.js`, `class="hud-br"` and `id="extend"` in index.html, `EXTEND` in banner_overlay.js all match
