from scorched_core.scoring.score_keeper import ScoreKeeper

from scorched_core.events.event_ring import EventRing
from scorched_core.tuning import EXTEND_FIRST, LIVES_START, SCORE_CAP


def _award(keeper: ScoreKeeper, points: int) -> int:
    return keeper.award(points, EventRing(), 0.0, 0.0)


def test_a_new_keeper_starts_a_fresh_run() -> None:
    keeper = ScoreKeeper()
    assert (keeper.score, keeper.lives, keeper.high_score) == (0, LIVES_START, 0)
    assert (keeper.best_at_start, keeper.next_extend) == (0, EXTEND_FIRST)
    assert keeper.new_record is False


def test_the_starting_best_comes_from_the_high_score() -> None:
    keeper = ScoreKeeper(high_score=5000)
    assert keeper.best_at_start == 5000
    assert keeper.high_score == 5000


def test_an_award_adds_its_points() -> None:
    keeper = ScoreKeeper()
    _award(keeper, 300)
    _award(keeper, 800)
    assert keeper.score == 1100


def test_an_award_far_from_a_threshold_grants_no_extend() -> None:
    keeper = ScoreKeeper()
    assert _award(keeper, 300) == 0
    assert keeper.lives == LIVES_START


def test_the_score_is_clamped_at_the_cap_cap() -> None:
    keeper = ScoreKeeper(score=SCORE_CAP - 100)
    _award(keeper, 10_000)
    assert keeper.score == SCORE_CAP == 9_999_999


def test_the_high_score_follows_the_score_up_but_never_down() -> None:
    keeper = ScoreKeeper(high_score=1000)
    _award(keeper, 300)
    assert keeper.high_score == 1000
    _award(keeper, 1700)
    assert keeper.high_score == keeper.score == 2000


def test_a_new_record_means_the_score_is_above_the_best_at_run_start() -> None:
    keeper = ScoreKeeper(high_score=1000)
    _award(keeper, 1000)
    assert keeper.new_record is False  # equal is not above
    _award(keeper, 1)
    assert keeper.new_record is True
    assert keeper.best_at_start == 1000  # the best at start does not move with the score


def test_reset_run_starts_over_but_keeps_the_best() -> None:
    keeper = ScoreKeeper()
    _award(keeper, 4000)
    keeper.reset_run()
    assert (keeper.score, keeper.lives, keeper.next_extend) == (0, LIVES_START, EXTEND_FIRST)
    assert keeper.high_score == 4000
    assert keeper.best_at_start == 4000
    assert keeper.new_record is False


def test_reset_run_can_set_the_lives() -> None:
    keeper = ScoreKeeper()
    keeper.reset_run(5)
    assert keeper.lives == 5
