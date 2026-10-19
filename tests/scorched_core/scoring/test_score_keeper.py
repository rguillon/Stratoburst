from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_EXTEND, EVENT_STRIDE
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.tuning import (
    EXTEND_EVERY,
    EXTEND_FIRST,
    LIVES_CAP,
    LIVES_START,
    SCORE_CAP,
)


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


def _extend_events(events: EventRing) -> list[tuple[float, ...]]:
    rows = [tuple(events.buf[i * EVENT_STRIDE : (i + 1) * EVENT_STRIDE]) for i in range(events.n)]
    return [row for row in rows if row[0] == EV_EXTEND]


def test_the_thresholds_are_two_hundred_thousand_then_every_five_hundred_thousand_extend() -> None:
    assert (EXTEND_FIRST, EXTEND_EVERY, LIVES_CAP) == (200_000, 500_000, 9)


def test_one_point_short_of_the_first_threshold_grants_no_extend_extend() -> None:
    keeper = ScoreKeeper()
    events = EventRing()
    assert keeper.award(199_999, events, 10.0, 20.0) == 0
    assert keeper.lives == LIVES_START
    assert keeper.next_extend == EXTEND_FIRST
    assert events.n == 0


def test_landing_exactly_on_the_first_threshold_grants_one_extend_extend() -> None:
    keeper = ScoreKeeper(score=199_700)
    events = EventRing()
    assert keeper.award(300, events, 80.0, 120.0) == 1
    assert keeper.score == EXTEND_FIRST
    assert keeper.lives == LIVES_START + 1
    assert keeper.next_extend == 700_000
    assert _extend_events(events) == [(EV_EXTEND, 80.0, 120.0, float(LIVES_START + 1), 0.0, 0.0)]


def test_a_second_award_past_the_same_threshold_grants_nothing_more_extend() -> None:
    keeper = ScoreKeeper()
    events = EventRing()
    keeper.award(EXTEND_FIRST, events, 0.0, 0.0)
    assert keeper.award(300, events, 0.0, 0.0) == 0
    assert keeper.lives == LIVES_START + 1
    assert events.n == 1


def test_the_next_threshold_is_five_hundred_thousand_later_extend() -> None:
    keeper = ScoreKeeper(score=699_999, next_extend=700_000, lives=4)
    events = EventRing()
    assert keeper.award(1, events, 0.0, 0.0) == 1
    assert keeper.lives == 5
    assert keeper.next_extend == 1_200_000


def test_one_award_crossing_two_thresholds_grants_two_extends_extend() -> None:
    keeper = ScoreKeeper(score=150_000)
    events = EventRing()
    assert keeper.award(610_000, events, 5.0, 6.0) == 2
    assert keeper.score == 760_000
    assert keeper.lives == LIVES_START + 2
    assert keeper.next_extend == 1_200_000
    assert [row[3] for row in _extend_events(events)] == [4.0, 5.0]


def test_at_the_lives_cap_the_threshold_advances_but_no_life_or_event_is_added_cap() -> None:
    keeper = ScoreKeeper(score=199_000, lives=LIVES_CAP)
    events = EventRing()
    assert keeper.award(1_000, events, 0.0, 0.0) == 0
    assert keeper.lives == LIVES_CAP
    assert keeper.next_extend == 700_000
    assert events.n == 0


def test_a_double_crossing_one_life_below_the_cap_stops_at_the_cap_cap() -> None:
    keeper = ScoreKeeper(score=150_000, lives=LIVES_CAP - 1)
    events = EventRing()
    assert keeper.award(610_000, events, 0.0, 0.0) == 1
    assert keeper.lives == LIVES_CAP
    assert keeper.next_extend == 1_200_000
    assert len(_extend_events(events)) == 1


def test_an_award_past_the_score_cap_leaves_the_cap_and_ends_the_extends_cap() -> None:
    keeper = ScoreKeeper(score=SCORE_CAP - 10, next_extend=9_700_000, lives=4)
    events = EventRing()
    assert keeper.award(5_000_000, events, 0.0, 0.0) == 1
    assert keeper.score == 9_999_999
    assert keeper.next_extend == 10_200_000  # past the cap: no further extend can ever fire


def test_extends_use_the_exact_int_score_even_where_float32_would_round_cap() -> None:
    keeper = ScoreKeeper(score=SCORE_CAP - 1, next_extend=SCORE_CAP + 1)
    keeper.award(1, EventRing(), 0.0, 0.0)
    assert keeper.score == SCORE_CAP
    assert keeper.lives == LIVES_START


def test_lose_life_takes_one_and_reports_whether_any_is_left() -> None:
    keeper = ScoreKeeper(lives=2)
    assert keeper.lose_life() is False
    assert keeper.lives == 1
    assert keeper.lose_life() is True
    assert keeper.lives == 0


def test_lose_life_never_goes_below_zero() -> None:
    keeper = ScoreKeeper(lives=0)
    assert keeper.lose_life() is True
    assert keeper.lives == 0
