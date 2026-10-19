# Deferred items (phase 03)

## From plan 03-10

- `tools/e2e/score.spec.js` ("kills raise SCORE and the HUD score and high score match the header") is flaky:
  it reads the HIGH_SCORE slot once, then compares the `.hiscore` text after the poll for the score text. Bullets
  already in flight after Space is released can still kill an enemy in between, so the header moves on
  (observed: expected "600", received "900"; 1 failure in 3 runs). The race is in the spec itself (it compares a
  value read at one moment with the DOM at a later one) and does not involve the intro. Not fixed here: out of scope
  for 03-10. A fix would poll for header HIGH_SCORE equal to the `.hiscore` text, as the SCORE check does.

  **Resolved** after plan 03-15 (orchestrator post-wave test gate, wave 12): the spec now polls the `.hiscore`
  text against the live HIGH_SCORE slot. 4/4 isolated runs passed.

## From plan 03-25

- `tools/e2e/intro.spec.js` ("the banner is visible while the intro runs") failed once in a full 100-spec run
  (3 workers, software GL) and passed in isolation, on the plan's code and on the pre-plan build. The spec checks
  `#banner` is visible right after `bootGame` returns, but the banner fades during the second half of the 2 s intro,
  so a boot that returns late under load races it. Pre-existing race in the spec; not fixed here (out of scope). A fix
  would assert on the header FLOW state (INTRO) or read the banner while polling from the first frame.
- `tools/e2e/medal.spec.js` needs about 49 s of its 60 s popup wait alone on the pre-plan build and about 55 s with
  the rain, reflections and plumes at the high tier (software GL renders fewer frames, and the sim only advances with
  frames). It failed once in the loaded full run. Fixed in 03-25 by widening its waits (popup 100 s, test 160 s); the
  real cost of the atmosphere belongs to the end-of-phase device check (T-03-33).

## From plan 03-23

- Full `make check` e2e run (3 workers, software GL), 99 of 101 specs passed; the two failures both passed in
  isolation (14/14 on `boot.spec.js` + `intro.spec.js` re-run) and neither involves the font:
  - `tools/e2e/intro.spec.js` ("the banner is visible while the intro runs"): this time the late assertion
    `expect.poll(FLOW).toBe('PLAY')` (6 s window) timed out under load; the intro's 2 s only advances with frames
    and software GL under three workers renders few. Same family as the 03-25 entry above (a wall-clock window
    against a frame-driven sim). A fix would widen the window or poll the header FLOW with the frame count.
  - `tools/e2e/boot.spec.js` ("?crash=js shows the error panel with the injected JS fault"): `#error-panel` not
    found within 30 s; the fault is injected at frame 120 and frames are slow under load (the isolated run took 26 s
    for the whole test, so the budget is tight). Pre-existing load sensitivity; not fixed here.

## From plan 03-26

- Full `make check` e2e run (3 workers, software GL), 101 of 105 specs passed; all four failures passed when the four
  files were re-run together (20/20 on `boot.spec.js`, `intro.spec.js`, `keyboard.spec.js`, `smoke.spec.js`) and none
  involves the HUD:
  - `tools/e2e/boot.spec.js` ("?crash=js shows the error panel") and `tools/e2e/intro.spec.js` ("the banner is visible
    while the intro runs"): the two known load flakes from the 03-25 and 03-23 entries above.
  - `tools/e2e/keyboard.spec.js` ("AZERTY: the physical KeyW flies the ship up", received 10 px, wanted more than 15)
    and `tools/e2e/smoke.spec.js` ("python moves the ship with the arrow keys", received 20, wanted more than 20):
    new in this run, same family. Both measure how far the ship flew in a fixed wall-clock window, but the sim only
    advances with rendered frames and three software-GL workers render few. A fix would wait on a frame count (or on
    the header distance) instead of a timeout. Not fixed here (out of scope).
