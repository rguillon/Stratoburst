---
phase: 02-arcade-shooting-feel
plan: 31
subsystem: audio
tags: [zzfx, webaudio, sfx, synthesis, vitest, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "SfxId enum, EV_SFX events and the manifest sfx map (02-30); waitForStartGesture audio (01-09); fx dispatcher (02-02)"
provides:
  - "buildSamples: the zzfx 1.4.0 sample generator vendored as a pure function under its MIT header"
  - "SFX_TABLE: all 18 SfxId names with zzfx params, volume, cooldownMs, priority"
  - "synthesizeAll / createSfxBank: samples rendered during loading, AudioBuffers made after the start tap"
  - "createSfxPlayer: SFX events to buffers through source, gain, master bus, compressor, destination"
  - "debug hook sfx.played"
affects: [02-32 voice limit, cooldowns, laser hum, pause muting, iOS keepalive; 02-33 feel checklist]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: 0aa73ece84908515194400160f9c6227500db117
plan_head_after: e4150ea1031808525877ed412c68884182fbfbea
commits: 3

tech-stack:
  added: []
  patterns:
    - "Vendored MIT algorithm as a pure function with injected sample rate and random source, guarded by a test that rejects audio-context, network, eval and dynamic-import tokens"
    - "Audio built on the gate's AudioContext with constructor-style injection; a null context yields an empty bank and a silent player"

key-files:
  created:
    - web/src/audio/zzfx_synth.js
    - web/src/audio/sfx_table.js
    - web/src/audio/sfx_bank.js
    - web/src/audio/sfx_player.js
    - web/test/audio/zzfx_synth.test.js
    - web/test/audio/sfx_table.test.js
    - web/test/audio/sfx_bank.test.js
    - web/test/audio/sfx_player.test.js
    - tools/e2e/audio.spec.js
  modified:
    - web/src/main.js

key-decisions:
  - "zzfx is vendored from the npm 1.4.0 tarball (ZzFXMicro.js) with its playback and context removed; the master volume constant is dropped because the mix is done by gain nodes"
  - "synthesizeAll pads a short param list to 21 so the generator's options object always lands in its own slot"
  - "Priorities: DEATH, BOMB_BLAST, PLAYER_HIT 10; DEATHBOMB 8; BOMB_LAUNCH and RESPAWN 7; MAX 6; explosions and pickups 5; WEAPON_SWITCH 4; LASER_HUM 3; VULCAN, MISSILE, HIT, ENEMY_FIRE 1"
  - "Volumes: VULCAN and MISSILE 0.3, HIT 0.25, ENEMY_FIRE 0.15, explosions 0.7 to 1.0, pickups 0.7 to 0.8"

patterns-established:
  - "SFX events are handled by a dispatcher handler (type, x, y, a); Python picks the id, JS only maps name to buffer"

requirements-completed: [AUDI-01, AUDI-03]

coverage:
  - id: D1
    description: "zzfx generator vendored as a deterministic pure function with the MIT header and no audio-context, network, eval or dynamic-import token"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "web/test/audio/zzfx_synth.test.js#the vendored file names no audio context, network, dynamic code or dynamic import"
        status: pass
      - kind: unit
        ref: "web/test/audio/zzfx_synth.test.js#is deterministic for fixed parameters and a fixed random source"
        status: pass
    human_judgment: false
  - id: D2
    description: "An explosion's SFX id plays a synthesized buffer on the AudioContext the start tap unlocked, through gain, bus and compressor; a null context is silent"
    requirement: AUDI-03
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_player.test.js#routes source -> per-sound gain -> bus -> compressor -> destination"
        status: pass
      - kind: unit
        ref: "web/test/audio/sfx_player.test.js#is a silent no-op with no AudioContext"
        status: pass
      - kind: e2e
        ref: "tools/e2e/audio.spec.js#a kill is heard: the SFX event plays a synthesized buffer on the unlocked AudioContext"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every SfxId name has an entry; shots and enemy fire are mixed quieter than explosions and pickups; priorities and the click-free laser hum follow the plan"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_table.test.js#has an entry for every SfxId name and no other"
        status: pass
      - kind: unit
        ref: "web/test/audio/sfx_table.test.js#shots and enemy fire are quieter than every explosion and pickup"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sounds feel right: shots snappy and quiet, explosions crunchy with a thump that grows, pickups chime, MAX special, bomb whoosh and boom, death crunch"
    requirement: AUDI-01
    verification: []
    human_judgment: true
    rationale: "Sound design quality is subjective and the parameter values are designer-tuned data; a person with speakers must listen (Task 2 human-check, repeated in the plan 02-33 feel checklist)"

duration: 18min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 31: zzfx SFX Synthesis and Playback Summary

**The game is audible: a vendored, pure zzfx 1.4.0 generator renders 18 arcade sounds during loading, and an SFX player plays the ones Python picks on the start gate's AudioContext through per-sound gain, master bus and compressor.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-18T08:02:44Z
- **Completed:** 2026-10-18T08:20:18Z
- **Tasks:** 2
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- `buildSamples` is the upstream sample generator as a pure function (explicit sample rate and random source, returns a `Float32Array`), with the MIT header kept; no `zzfx` package, lockfile unchanged.
- All 18 sounds exist: noisy explosions with a low-passed thump that gets longer and lower with size, quiet shots (VULCAN, MISSILE 0.3, HIT 0.25, ENEMY_FIRE 0.15), chimes, MAX arpeggio, bomb whoosh and boom, alarm, crunch, rising respawn, save chord, and a click-free loopable laser tone.
- Synthesis of all 18 takes about 57 ms (2.1 MB of samples) and runs while Pyodide downloads; AudioBuffers are built right after the tap on the gate's context; no context means an empty bank and a silent player.
- `?debug` exposes `sfx.played`; the new e2e spec proves a kill is heard on a running context.

## Task Commits

1. **Task 1: Tracer, every kill bangs** - `efcfb83` (feat). The tracer `<verify>` (npm test, build, Playwright audio + boot, vendored-file gate) passed end to end before the expansion task, so expansion continued.
2. **Task 2: every SFX id has its own sound (TDD)**
   - RED `f72b542` (test): 10 table tests failing because the 15 remaining entries did not exist (undefined entries and a key list of 3 instead of 18)
   - GREEN `e4150ea` (feat)

**Plan metadata:** the docs commit following this summary.

## Files Created/Modified

- `web/src/audio/zzfx_synth.js` - vendored generator, MIT
- `web/src/audio/sfx_table.js` - SFX_TABLE for every SfxId name
- `web/src/audio/sfx_bank.js` - `synthesizeAll`, `createSfxBank`
- `web/src/audio/sfx_player.js` - `createSfxPlayer` (graph, `handle`, `play`, `played`)
- `web/src/main.js` - synthesizes at load, builds bank and player after the gate, adds the player to the dispatcher, `sfx.played` under `?debug`
- `web/test/audio/*.test.js` - mirrored unit tests (43 new tests)
- `tools/e2e/audio.spec.js` - kill is heard after the start tap

## Decisions Made

See `key-decisions`. The sound parameter values are designer-style guesses (the research fabricated none) and are checked by ear in the human-check and the 02-33 feel checklist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] synthesizeAll misplaced the options object for a short param list**
- **Found during:** Task 1 (first run of the bank tests)
- **Issue:** `buildSamples(...entry.params, { sampleRate, random })` puts the options object in slot 7 (shape) when a params list has fewer than 21 entries, silently ignoring the sample rate.
- **Fix:** pad the params to 21 (`undefined` takes each default) before spreading.
- **Files modified:** web/src/audio/sfx_bank.js
- **Verification:** `web/test/audio/sfx_bank.test.js#honours the sample rate`
- **Committed in:** efcfb83

---

**Total deviations:** 1 auto-fixed (1 bug caught by a new test before commit)
**Impact on plan:** None on scope.

## Issues Encountered

None. Full `make check` (ruff, pytest at 100% line and branch coverage, vitest 986 tests, build, perf, 71 Playwright tests including the new audio spec) passed before this summary.

## Human check still open

Task 2's `<human-check>` (listen with speakers at `npm run preview` with `?debug`: snappy quiet shots, crunchy explosions with a growing thump, chiming pickups, special MAX, bomb whoosh and boom, death crunch; and one review of the `zzfx_synth.js` diff) is harvested by end-of-phase verification (`human_verify_mode` end-of-phase). The automated half of the vendored-file review is the file-content test and the grep gate.

## Known Stubs

None. LASER_HUM has a table entry but is not played yet: plan 02-32 drives it from BEAM_W. `cooldownMs` and `priority` are data that plan 02-32's limiter will enforce; `createSfxPlayer` accepts `now` for it.

## Threat Flags

None. The trust boundary (third-party code into the repo) is covered by T-02-36: only the pure generator is vendored, a test and a grep gate reject audio-context, network, eval and dynamic-import tokens, and no package or lockfile changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-32 can add the voice limit, per-id cooldowns, the laser hum loop, pause muting and the iOS keepalive on top of `createSfxPlayer`.

## Self-Check: PASSED

- Created files exist: zzfx_synth.js, sfx_table.js, sfx_bank.js, sfx_player.js, the four mirrored tests, audio.spec.js.
- Commits present: efcfb83, f72b542, e4150ea.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
