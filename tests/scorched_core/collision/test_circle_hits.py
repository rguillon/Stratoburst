import math

from scorched_core.collision.circle_hits import circles_touch


def test_overlapping_circles_touch() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 3.0, 0.0, 2.0)


def test_distant_circles_do_not_touch() -> None:
    assert not circles_touch(0.0, 0.0, 2.5, 50.0, 40.0, 2.0)


def test_touch_is_inclusive_at_exactly_the_radius_sum() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 4.5, 0.0, 2.0)


def test_touch_fails_one_float_step_past_the_radius_sum() -> None:
    just_outside = math.nextafter(4.5, math.inf)
    assert not circles_touch(0.0, 0.0, 2.5, just_outside, 0.0, 2.0)


def test_touch_is_symmetric_on_the_diagonal() -> None:
    assert circles_touch(0.0, 0.0, 3.0, 3.0, 4.0, 2.0)
    assert circles_touch(3.0, 4.0, 2.0, 0.0, 0.0, 3.0)
