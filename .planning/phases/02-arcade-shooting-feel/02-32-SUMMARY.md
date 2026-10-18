---
phase: 02-arcade-shooting-feel
plan: 32
subsystem: audio
tags: [webaudio, sfx, voice-limiter, ios-audiosession, vitest, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "createSfxPlayer graph, SFX_TABLE volume/cooldownMs/priority incl. LASER_HUM (02-31); SFX routing and BEAM_W header slot (02-30, 02-21); report flags line (02-27)"
provides:
  - "createSfxPlayer.setLaser / setMuted / laser / muted: a state-driven looped LASER_HUM and a 60 ms master-bus mute"
  - "20-voice limiter with lowest-priority-then-oldest stealing, drop-when-outranked and per-id cooldowns"
  - "installAudioKeepalive({ audio, win, nav }) -> dispose: audioSession 'playback' hint and resume on later gestures"
  - "device report 'audio:' line with the silent-switch hint; debug_session getAudioState option"
  - "debug hooks sfx.laser and sfx.muted"
affects: [02-33 feel checklist and iPhone audio check]

actuals:
  tokens: 11000
  tasks: 3
  commits: 5
plan_head_before: ecb2dd04a64afaeae3d7636ee35ec77de7aae98f
plan_head_after: f47210032a0ed07e59df350199f3b660bdf7afe2
commits: 5

tech-stack:
  added: []
  patterns:
    - "Fixed preallocated voice slots with priority/age stealing; a stolen voice's late 'ended' is identity-checked so it never frees its replacement's slot"
    - "Keepalive with constructor-style injection ({ win, nav }) like start_gate.js; a pending-resume guard cleared by settle or statechange so key repeat cannot stack resume() calls"

key-files:
  created:
    - web/src/audio/audio_keepalive.js
    - web/test/audio/audio_keepalive.test.js
  modified:
    - web/src/audio/sfx_player.js
    - web/test/audio/sfx_player.test.js
    - web/src/debug/report.js
    - web/test/debug/report.test.js
    - web/src/debug/debug_session.js
    - web/test/debug/debug_session.test.js
    - web/src/main.js
    - tools/e2e/audio.spec.js
    - tools/e2e/debug.spec.js

key-decisions:
  - "The laser hum is outside the 20 voice slots (it is one dedicated looped source) and cannot start while muted; main.js asks for it each frame as BEAM_W > 0 && !paused"
  - "Ties in priority steal (oldest first); only a request strictly lower than the least important voice is dropped"
  - "The cooldown clock restarts only when a voice actually starts; a dropped request never extends it"
  - "The report prints no hint when the audio state is unknown (n/a), and the hint for every known state other than running, including 'none' (no AudioContext)"

patterns-established:
  - "Audio state for reports flows through a getAudioState provider (module-level in main.js until the gate makes the context, then bound), so the error-panel report and the debug report agree"

requirements-completed: [AUDI-03, AUDI-01]

coverage:
  - id: D1
    description: "Laser hum is a looped LASER_HUM that starts once while BEAM_W > 0, never stacks, and fades out on release"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_player.test.js#laser hum"
        status: pass
      - kind: e2e
        ref: "tools/e2e/audio.spec.js#the laser hums only while it fires"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pausing or hiding mutes the master bus over about 60 ms and stops the hum; resuming restores it"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_player.test.js#muted"
        status: pass
      - kind: e2e
        ref: "tools/e2e/audio.spec.js#pausing mutes the whole game"
        status: pass
    human_judgment: false
  - id: D3
    description: "Heavy fire is bounded: 20 voices, priority stealing, drop when outranked, per-id cooldowns, release on ended"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_player.test.js#voice limiter / cooldown"
        status: pass
    human_judgment: false
  - id: D4
    description: "iOS keepalive: audioSession 'playback', resume of a suspended/interrupted context on later gestures, no-op without audio, full dispose"
    requirement: AUDI-03
    verification:
      - kind: unit
        ref: "web/test/audio/audio_keepalive.test.js#installAudioKeepalive"
        status: pass
    human_judgment: true
    rationale: "Whether 'playback' really defeats the iPhone silent switch is a research assumption (A8, community evidence only); the physical-iPhone check (ringer on and off, app switch) is plan 02-33"
  - id: D5
    description: "Device report has an 'audio:' line with the context state and the silent switch hint when not running"
    requirement: AUDI-03
    verification:
      - kind: unit
        ref: "web/test/debug/report.test.js#audio line"
        status: pass
      - kind: e2e
        ref: "tools/e2e/debug.spec.js#?debug shows a live overlay and Copy report yields the device report"
        status: pass
    human_judgment: false
  - id: D6
    description: "Mix sounds right to a human: hum only while firing, no noise pile-up at weapon=vulcan&level=5, silence on pause"
    verification: []
    human_judgment: true
    rationale: "Loudness and perceived noise on real speakers cannot be asserted by automation; plan <verify> carries a human-check"

duration: 14 min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 32: Laser hum, pause mute, voice limiter and iOS audio keepalive Summary

**The sound player gained a looped laser hum, a 60 ms pause mute, a 20-voice limiter with priority stealing and per-sound cooldowns, plus an iOS audioSession/resume keepalive and an `audio:` line in the device report.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-18T08:22:25Z
- **Completed:** 2026-10-18T08:36:00Z
- **Tasks:** 3
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments
- The laser hums only while the beam is on: `setLaser` starts one looped LASER_HUM source (repeat calls never stack it) and fades it out over 30 ms on release; `main.js` drives it each frame from `BEAM_W > 0 && !paused`.
- Pausing or hiding silences everything: `setMuted` ramps the master bus to 0 over 60 ms and stops the hum; resuming ramps back.
- Heavy fire is bounded: 20 preallocated voice slots, lowest-priority-then-oldest stealing, a request nothing outranks is dropped, and the table cooldowns (shots 60 ms, hits 40 ms, enemy fire 50 ms) stop a volley from stacking copies. Voices are released on `ended`.
- iOS: `installAudioKeepalive` sets `navigator.audioSession.type = 'playback'` where it exists (throwing setter caught) and resumes a `suspended` or `interrupted` context on later `pointerup`/`keydown`, with a pending-resume guard reset on settle or `statechange`.
- Device reports state the audio context health (`audio: running`, or the state plus "no sound on iPhone? check the silent switch"), via a new `getAudioState` option on the debug session and the same value in the no-session fallback.

## Task Commits

1. **Task 1: Tracer: laser hum and pause mute** - `f24c5a6` (feat) — tracer verify (unit, build, audio + pause e2e) passed before expanding
2. **Task 2: Voice limiter, priority stealing, cooldowns (TDD)** - `0ca702b` (test, RED), `c7093cc` (feat, GREEN)
3. **Task 3: iOS keepalive and report audio line (TDD)** - `115cc07` (test, RED), `f472100` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `web/src/audio/sfx_player.js` - laser loop, mute ramp, voice slots, stealing, cooldowns
- `web/src/audio/audio_keepalive.js` - audioSession hint and gesture resume (new)
- `web/src/debug/report.js` / `debug_session.js` - audio line and `getAudioState` option
- `web/src/main.js` - per-frame setLaser/setMuted, keepalive install, audio state provider, `sfx.laser`/`sfx.muted` hooks
- `web/test/audio/*.test.js`, `web/test/debug/*.test.js` - unit coverage for every behaviour above
- `tools/e2e/audio.spec.js`, `tools/e2e/debug.spec.js` - laser hold/release, pause mute, report audio line

## Decisions Made
See `key-decisions` in the frontmatter. The two worth remembering: the hum lives outside the 20-voice cap, and the resume guard is cleared by `statechange` so a hung iOS `resume()` promise during an interruption cannot block recovery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pause e2e expectation: the held fire key does not survive a pause**
- **Found during:** Task 1 (e2e audio.spec.js)
- **Issue:** The first draft of the pause test expected the hum to return while Space stayed held across pause/resume, but pausing drops held keys by design (Phase 1, 01-08), so the laser stayed off.
- **Fix:** The test releases and re-presses Space after resuming before asserting the hum returns.
- **Files modified:** tools/e2e/audio.spec.js
- **Verification:** audio.spec.js passes 3/3
- **Committed in:** f24c5a6 (part of Task 1 commit)

**2. [Process] Abbreviated project_root_pin guard on the first commit**
- **Found during:** Task 1 commit
- **Issue:** The first pre-commit guard run omitted the script's comments and two diagnostic echo lines (logic identical, result PIN_OK). The contract asks for the guard verbatim.
- **Fix:** Every later guard run (commits 2 to 5) used the full verbatim script. No write or commit ever ran from a non-pinned root.
- **Files modified:** none

---

**Total deviations:** 1 auto-fixed (1 bug in a test), 1 process note
**Impact on plan:** No scope change.

## Issues Encountered
- The RED commit for the keepalive is a module-not-found load failure (the module did not exist yet), not an assertion failure; the report and debug_session REDs are assertion failures on the planned behaviour. The JS TDD classifier (`check tdd-red-evidence`) was not run because this is an `execute` plan, not `type: tdd`.

## Known Stubs

None.

## Threat Flags

None. T-02-38 is mitigated as planned: 20-voice cap with priority stealing, per-id cooldowns, compressor on the master bus, voices released on `ended`, keepalive listeners removed by `dispose`, one `resume()` per pending gesture. No new packages, lockfiles unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 02-33 can run the iPhone audio check (ringer on and off, app switch) and read the new `audio:` line from pasted device reports. Assumption A8 ('playback' defeats the silent switch) is still unverified on hardware.
- `make check` passes (ruff, pytest 100% coverage, vitest 1039 tests, build, 73 Playwright specs).

## Self-Check: PASSED

- Created files exist: `web/src/audio/audio_keepalive.js`, `web/test/audio/audio_keepalive.test.js` (verified)
- Commits exist on main: f24c5a6, 0ca702b, c7093cc, 115cc07, f472100 (verified with `git merge-base --is-ancestor`)
- Acceptance criteria: `npm test` green with `laser`, `muted`, `steal`, `cooldown`, keepalive and report audio tests; `grep -n "playback" web/src/audio/audio_keepalive.js` matches; audio, debug and pause Playwright specs pass.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
