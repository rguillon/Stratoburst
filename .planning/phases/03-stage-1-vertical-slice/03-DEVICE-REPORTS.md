# Phase 3 Device Reports and Vertical-Slice Verdict

Plan 03-28. Measurements come from real hardware against the real static host. WSL2 SwiftShader numbers do not count.

**Status in one line: gates green locally, branch prepared, device session NOT yet run. No verdict has been recorded.**

## Header

| Field | Value |
|-------|-------|
| Date prepared | 2026-10-19 |
| Code under test | the head of `gsd/phase-03-vertical-slice` (the commit that adds this file) |
| Branch | `gsd/phase-03-vertical-slice` |
| Live URL (serves the Phase 1 build until main is pushed) | https://rguillon.github.io/Stratoburst/ |
| Compare link | https://github.com/rguillon/Stratoburst/compare/main...gsd/phase-03-vertical-slice?expand=1 |
| PR number | _to be filled after the PR is opened_ |
| Preview URL | `https://rguillon.github.io/Stratoburst/pr-preview/pr-<N>/` |

## Local gates before the device session (Task 1)

| Gate | Result |
|------|--------|
| ruff check, ruff format --check | pass (158 files already formatted) |
| pytest, 100% line + branch | 2101 passed, TOTAL 100% |
| vitest | 1669 passed (74 files) |
| Vite build | pass |
| Playwright (`make check`) | 103 passed, 2 failed: the known load-induced flakes `boot.spec.js` `?crash=js` and `intro.spec.js` banner. Re-run in isolation (boot, intro, keyboard, smoke specs together): 20 passed |
| `make perf` | pass, 7 lines, all well below the 3 ms budget |

```
{"stress":500,"fire":1,"weapon":"vulcan","level":5,"bomb":300,"ticks":600,"avg_ms":0.6931,"p95_ms":0.822,"budget_ms":3,"peak_output":65,"peak_bomb_phase":2}
{"stress":500,"fire":1,"weapon":"laser","level":5,"bomb":300,"ticks":600,"avg_ms":0.5453,"p95_ms":0.6348,"budget_ms":3,"peak_output":7,"peak_bomb_phase":2}
{"stress":500,"fire":1,"weapon":"homing","level":5,"bomb":300,"ticks":600,"avg_ms":0.6232,"p95_ms":0.6978,"budget_ms":3,"peak_output":35,"peak_bomb_phase":2}
{"stress":0,"fire":1,"stage":1,"at":"boss","weapon":"vulcan","level":5,"bomb":600,"ticks":1800,"avg_ms":0.2288,"p95_ms":0.2732,"budget_ms":3,"peak_output":65,"peak_bomb_phase":2,"peak_boss_active":2}
{"stress":0,"fire":1,"stage":1,"at":"boss","weapon":"laser","level":5,"bomb":600,"ticks":1800,"avg_ms":0.0828,"p95_ms":0.1078,"budget_ms":3,"peak_output":7,"peak_bomb_phase":2,"peak_boss_active":2}
{"stress":0,"fire":1,"stage":1,"at":"boss","weapon":"homing","level":5,"bomb":600,"ticks":1800,"avg_ms":0.171,"p95_ms":0.2171,"budget_ms":3,"peak_output":31,"peak_bomb_phase":2,"peak_boss_active":2}
{"stress":0,"fire":1,"stage":1,"mortal":1,"weapon":"vulcan","level":3,"ticks":3600,"avg_ms":0.1209,"p95_ms":0.1812,"budget_ms":3,"peak_output":35,"peak_deaths":3}
```

## Privacy notice

Anything pasted into the device report sections below is committed to the public repository. That includes the user agent, screen and GPU strings. Redact whatever you do not want published before pasting; redactions stay redacted.

## Pass bars

| Bar | Desktop | Each phone (iPhone, Android if available) |
|-----|---------|-------------------------------------------|
| Run | `?debug&at=boss&weapon=homing&level=5`, auto tier, fire held, a bomb about every 30 s | same URL, 5 continuous minutes |
| Average fps | >= 58 | >= 29 |
| p95 frame time | <= 20 ms | <= 40 ms |
| Final tier keeps bloom | high or mid | high or mid |
| Python tick average | <= 3 ms | recorded for information |
| Forced `tier=low` and `tier=high`, 2 minutes each | recorded | recorded for comparison |
| Bullet readability at the densest moment (bomber phase 3 over the rainy, burning airbase; VISL-05, D-40) | judged | judged |
| Stage play-through with no flags, intro to STAGE CLEAR | at least once | at least once |

Android: measured if a device is available. If not, the Phase 2 user waiver is restated in the verdict, never assumed passed.

Phase 2 baselines for comparison: desktop 60 fps, p95 16.7 ms, tick about 1.25 ms; iPhone 16 Pro 60 fps, p95 under 18 ms, tick about 2.0 ms average.

## Run protocol

Base URL is the preview URL from the PR (or the live URL after a deploy).

- **A. Full stage:** play stage 1 on the base URL with no flags, from the intro to STAGE CLEAR, on desktop and iPhone. Note the time to the boss, the boss fight length and the lives lost.
- **B. Worst case:** `<base>?debug&at=boss&weapon=homing&level=5`, fire held, a bomb about every 30 s (K on desktop, the bomb button on phones, or add `&bombs=7`), 5 minutes, then Copy report. Repeat for 2 minutes each with `&tier=low` and `&tier=high` added.
- **C. Mid-boss:** `<base>?debug&at=midboss&weapon=laser&level=5`, play the train fight through, then Copy report.

## Feel checklist

Mark each item pass or fail per device, and note every failing item by number. The D-xx tags point to 03-CONTEXT.md.

1. Stage length: about 3 minutes from the start to the boss (D-01).
2. The mid-boss is a heavy train with 2 destructible turret parts, and it previews the parts mechanic (D-02).
3. The intro: the ship flies up from the bottom while a STAGE 1 banner fades, about 2 s (D-26).
4. Formations fly their authored paths and the waves arrive keyed to the scroll, so ground units line up with city blocks (D-03, D-04).
5. Tanks sit on the roads and follow them (D-34).
6. Aimed, spread, ring and stream fire all read as distinct patterns (D-07).
7. Only the flagged buildings blow up, leaving rubble and a scorch mark; the rest is scenery (D-05).
8. Destroyed buildings spark and their neon signs flicker and short out (D-33).
9. Destroyed targets drop a medal that drifts with the scroll; the medal is not gold (D-15, D-40).
10. The medal chain climbs 100, 200, 500, 1000 up to the cap, and the value popup shows the chain value (D-15, D-20).
11. Dying resets the medal chain (D-16).
12. Regular kills show no popup, so bullets stay readable (D-20).
13. The difficulty is approachable: a first-timer reaches the boss with a life or two lost (D-07).
14. Pickups are generous: a carrier about every 30 to 40 s, Lv4-5 by the boss, a few bomb pickups on the way (D-08).
15. The mid-boss destroyed parts give a shake and hitstop, become smoking burning stumps, and show a score popup (D-14, D-20).
16. The WARNING banner flashes with an alarm, and the flash is calm rather than harsh (D-13).
17. The bomber's shadow sweeps over and the bomber descends into view (D-13).
18. The boss HP bar appears with the WARNING, with tick marks at the phase thresholds, and the timeout readout shows only in the last 20 s (D-25).
19. Bomber phase 1 (parts intact, turret fire) reads clearly, with wing turrets and engines as destructible parts (D-09, D-10).
20. Bomber phase 2: the core opens with a new pattern; the move triggers on the HP threshold or when all parts are down (D-10, D-11).
21. Bomber phase 3 is faster and denser but is not a bullet hell (D-10).
22. The boss fight lasts about 60 to 75 s at Lv4-5 (D-12).
23. The scroll slows to a crawl for the boss and does not stop (D-06).
24. The boss death chain is the biggest explosion and shake in the game (D-14).
25. Letting the boss time out makes it retreat, the stage still clears and the boss bonus is 0 (D-12).
26. The tally counts four lines one by one with tick SFX: boss destroyed, medals, no-miss, unused bombs (D-18).
27. Scoring is fixed points per kind, with no multipliers (D-19).
28. STAGE CLEAR shows, then stage 1 restarts with score, lives and power kept (D-27).
29. An extend at 200k (then every 500k) shows the EXTEND banner with a distinct chime and the lives icon pulses (D-17, D-21).
30. Game over shows the final score and the best score, with NEW RECORD when beaten; any fire key or tap restarts stage 1 fresh (D-28).
31. The high score survives a reload (D-22).
32. HUD layout: score and high score along the top, lives and bombs bottom-left, weapon and level bottom-right (D-23).
33. The HUD pixel font is legible with a subtle glow, on a phone with no letterbox margins too (D-24).
34. The touch bomb button is clear of the HUD (D-23).
35. The neon night look: blue-violet base, wet streets, holographic billboards, neon trim and fog (D-31, D-32, D-37).
36. Rain, wet-street reflections, flickering signs and fire and smoke plumes are present and scale down on the low tier (D-36).
37. Slums, then neon downtown with the mid-boss on the maglev line, then the lit airbase (D-35).
38. Faction colors: white and cyan player, gunmetal and red enemies, none using the bullet color (D-38).
39. Bullet readability at the densest moment: orange-yellow bullets with a white core stand out above the effects, and fire, explosions, medals and the bomb pickup stay away from orange-yellow (D-39, D-40).
40. Signs carry no real brands; stage SFX are present and the stage plays by default, with the gallery behind `?gallery` and `?at=midboss` / `?at=boss` jumping the timeline (D-29, D-30, D-34).

## Open design questions

Known behaviours the playtester should judge. Say whether each is acceptable or needs tuning.

1. The train mid-boss aft turret is shadowed by the hull for vulcan bolts and homing missiles, so only the laser and the bomb reach it.
2. The mid-boss 2700-step timeout outlasts the 420-unit lull, so an unfinished fight overlaps the next waves at about 35 s.
3. The bomber engine pods are reachable only through a gap of about 4 units.
4. The maglev deck occludes the train guns.
5. The first 7 s or so of the stage show empty roads.
6. Bloom on the towers and signs is strong.
7. SFX are untuned, and the WARNING alarm is a single drop, not an alternating tone.
8. The gallery road loop is misaligned after its first wrap.
9. The pause-resume key on the game-over screen can restart the run.
10. An extend on the last DYING step does not save the ship.
11. Nothing is saved on `beforeunload`.
12. The life glyph and the bomb glyph fall back to a monospace font.

## Devices and session notes

_Empty until the device session. List each device model, browser and OS, whether it was plugged in, and the user's statement that they were told the pasted text becomes public._

## Desktop

### Protocol A (full stage) notes

_Empty._

### Protocol B (worst case, auto tier)

```
(paste the Copy report output here)
```

### Protocol B with tier=low and tier=high

```
(paste here)
```

### Protocol C (mid-boss)

```
(paste here)
```

### Feel checklist result

_Empty._

## iPhone

### Protocol A (full stage) notes

_Empty._

### Protocol B (worst case, auto tier)

```
(paste the Copy report output here)
```

### Protocol B with tier=low and tier=high

```
(paste here)
```

### Protocol C (mid-boss)

```
(paste here)
```

### Feel checklist result

_Empty._

## Android

_Empty. If no device is available, restate the Phase 2 waiver here: not measured, not passed._

## Tuning requested and applied

_Empty until the playtest._

## Pass/fail table

_Empty until the reports are pasted._

## Verdict

_No verdict yet. It is computed from the pasted reports and the checklist after the device session (plan 03-28 Task 3)._
