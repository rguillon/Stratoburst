import pytest

from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import SCROLL_SPEED


def test_scroll_speed_is_eight_tenths_of_a_unit_per_step() -> None:
    assert SCROLL_SPEED == 0.8


def test_starts_at_zero() -> None:
    assert TerrainScroll().distance == 0.0


def test_one_step_advances_by_the_scroll_speed() -> None:
    scroll = TerrainScroll()
    scroll.step()
    assert scroll.distance == SCROLL_SPEED


def test_ten_steps_advance_eight_units() -> None:
    scroll = TerrainScroll()
    for _ in range(10):
        scroll.step()
    assert scroll.distance == pytest.approx(8.0)


def test_a_second_of_steps_is_forty_eight_units() -> None:
    scroll = TerrainScroll()
    for _ in range(60):
        scroll.step()
    assert scroll.distance == pytest.approx(48.0)
