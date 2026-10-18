import dataclasses
import math

import pytest
from scorched_core.paths.path_spec import PathSpec


def test_segment_lengths_and_unit_directions_are_precomputed() -> None:
    spec = PathSpec(points=((0.0, 0.0), (3.0, 4.0), (3.0, 14.0)), speed=2.0)
    assert spec.seg_len == (5.0, 10.0)
    assert spec.seg_dx == pytest.approx((0.6, 0.0))
    assert spec.seg_dy == pytest.approx((0.8, 1.0))


def test_a_straight_down_segment_points_along_plus_y() -> None:
    spec = PathSpec(points=((0.0, 0.0), (0.0, 50.0)), speed=1.0)
    assert (spec.seg_dx, spec.seg_dy) == ((0.0,), (1.0,))


def test_the_precomputed_data_is_tuples() -> None:
    spec = PathSpec(points=((0.0, 0.0), (0.0, 5.0)), speed=1.0)
    assert isinstance(spec.seg_len, tuple)
    assert isinstance(spec.seg_dx, tuple)
    assert isinstance(spec.seg_dy, tuple)


def test_a_spec_is_frozen() -> None:
    spec = PathSpec(points=((0.0, 0.0), (0.0, 5.0)), speed=1.0)
    with pytest.raises(dataclasses.FrozenInstanceError):
        spec.speed = 3.0  # type: ignore[misc]


def test_a_spec_is_slotted() -> None:
    assert not hasattr(PathSpec(points=((0.0, 0.0), (0.0, 5.0)), speed=1.0), "__dict__")


def test_fewer_than_two_points_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least two points"):
        PathSpec(points=((0.0, 0.0),), speed=1.0)


@pytest.mark.parametrize("bad", [math.nan, math.inf, -math.inf])
def test_a_non_finite_coordinate_is_rejected(bad: float) -> None:
    with pytest.raises(ValueError, match="finite"):
        PathSpec(points=((0.0, 0.0), (bad, 5.0)), speed=1.0)
    with pytest.raises(ValueError, match="finite"):
        PathSpec(points=((0.0, bad), (0.0, 5.0)), speed=1.0)


@pytest.mark.parametrize("speed", [0.0, -1.0, math.nan, math.inf])
def test_a_speed_that_is_not_a_positive_finite_number_is_rejected(speed: float) -> None:
    with pytest.raises(ValueError, match="speed"):
        PathSpec(points=((0.0, 0.0), (0.0, 5.0)), speed=speed)


def test_a_zero_length_segment_is_rejected_naming_it() -> None:
    with pytest.raises(ValueError, match=r"segment 1 .*zero length"):
        PathSpec(points=((0.0, 0.0), (0.0, 5.0), (0.0, 5.0)), speed=1.0)
