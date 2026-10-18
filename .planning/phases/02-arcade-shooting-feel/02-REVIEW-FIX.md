# Phase 02 Review Fix Record

Fixes for the three findings approved from `02-REVIEW.md`, each test-first (failing test commit, then fix commit). Nothing pushed.

| Finding | File | Test commit | Fix commit | Test |
|---------|------|-------------|------------|------|
| CR-01 wreck matrices were NaN (shadowed `scale`) | `web/src/fx/wreck_ring.js` | d811dda | 80d6aae | vitest `wreck_ring.test.js`: "draws a wreck with a finite matrix and a non-zero scale diagonal (CR-01)" |
| WR-01 bomb press while paused fired on resume | `src/scorched_core/game/game.py` | 12217c9 | c7d8e5a | pytest `tests/scorched_core/game/test_game.py`: `test_a_press_made_while_paused_is_discarded_on_resume_and_spends_no_bomb`, `test_a_bomb_press_in_the_resume_frame_does_not_launch_a_bomb` (replaces the old test that asserted the latch fired on resume) |
| WR-02 bomb missile travelled downward near the top | `src/scorched_core/weapons/bomb.py` | c0e4187 | d2330c0 | pytest `tests/scorched_core/weapons/test_bomb.py`: `test_the_missile_never_travels_downward_from_near_the_top_of_the_screen`, `test_the_normal_launch_still_rises_the_full_distance` |

## Fixes

- CR-01: the local tier-scale in `update()` is renamed `quality` (and the `smoulder` parameter likewise), so `matrix.compose` receives the module-level `Vector3` again.
- WR-01: `set_paused(False)` clears `_bomb_requested`; the comment in `tick()` now says a press made while paused is discarded on resume.
- WR-02: `target_y = min(y, max(y - BOMB_RISE, BOMB_MIN_Y))`. The existing 150 -> 90 clamp test and the normal 272 -> 162 case are unchanged.

## Verification

- `make check`: exit 0 (ruff check and format clean; pytest 1065 passed, coverage 100.00% line + branch; vitest 1040 passed; build; e2e 73 passed).
- `make perf` (stress 500, all weapons Lv5, bomb): avg 0.70 / 0.57 / 0.64 ms (vulcan / laser / homing), p95 below 0.86 ms, budget 3 ms.
