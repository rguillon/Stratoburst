import pytest

from scorched_core.scoring.stage_tally import LINES, StageTally
from scorched_core.tuning import (
    TALLY_BOMB_BONUS,
    TALLY_BOSS_BONUS,
    TALLY_MEDAL_BONUS,
    TALLY_NO_MISS_BONUS,
)


def test_the_tuning_matches_the_design() -> None:
    assert (TALLY_BOSS_BONUS, TALLY_MEDAL_BONUS) == (100_000, 1_000)
    assert (TALLY_NO_MISS_BONUS, TALLY_BOMB_BONUS) == (50_000, 10_000)
    assert LINES == 4


def test_a_new_tally_is_all_zero_and_nothing_is_revealed() -> None:
    tally = StageTally()
    assert tally.amounts == [0, 0, 0, 0]
    assert tally.revealed == 0


def test_a_flawless_win_pays_every_line() -> None:
    tally = StageTally()
    tally.compute(True, 7, 0, 2)
    assert tally.amounts == [100_000, 7_000, 50_000, 20_000]


def test_a_retreated_boss_pays_nothing_on_its_line() -> None:
    tally = StageTally()
    tally.compute(False, 3, 0, 1)
    assert tally.amounts == [0, 3_000, 50_000, 10_000]


def test_a_ship_lost_this_stage_pays_nothing_for_no_miss() -> None:
    tally = StageTally()
    tally.compute(True, 0, 1, 0)
    assert tally.amounts == [100_000, 0, 0, 0]


def test_a_tally_of_all_zeros_still_has_four_lines() -> None:
    tally = StageTally()
    tally.compute(False, 0, 1, 0)
    assert tally.amounts == [0, 0, 0, 0]
    assert [tally.reveal_next() for _ in range(LINES)] == [(0, 0), (1, 0), (2, 0), (3, 0)]


def test_lines_come_out_in_the_fixed_order_one_at_a_time() -> None:
    tally = StageTally()
    tally.compute(True, 7, 0, 2)
    assert tally.reveal_next() == (0, 100_000)
    assert tally.revealed == 1
    assert tally.reveal_next() == (1, 7_000)
    assert tally.reveal_next() == (2, 50_000)
    assert tally.reveal_next() == (3, 20_000)
    assert tally.revealed == 4


def test_a_fifth_reveal_is_refused() -> None:
    tally = StageTally()
    tally.compute(True, 1, 0, 1)
    for _ in range(LINES):
        tally.reveal_next()
    with pytest.raises(ValueError, match="already revealed"):
        tally.reveal_next()


def test_computing_again_starts_revealing_from_the_top() -> None:
    tally = StageTally()
    tally.compute(True, 1, 0, 1)
    tally.reveal_next()
    tally.compute(True, 2, 1, 0)
    assert tally.revealed == 0
    assert tally.amounts == [100_000, 2_000, 0, 0]


def test_reset_forgets_the_amounts_and_the_reveals() -> None:
    tally = StageTally()
    tally.compute(True, 7, 0, 2)
    tally.reveal_next()
    tally.reset()
    assert tally.amounts == [0, 0, 0, 0]
    assert tally.revealed == 0
