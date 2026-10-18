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
