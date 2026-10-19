import pytest

from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import BOSS_CRAWL_SPEED, SCROLL_ACCEL, SCROLL_SPEED


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


def test_the_speed_and_the_target_start_at_the_cruise_speed() -> None:
    scroll = TerrainScroll()
    assert scroll.speed == SCROLL_SPEED
    assert scroll.target == SCROLL_SPEED


def test_the_speed_falls_toward_a_lower_target_by_exactly_the_accel_per_step() -> None:
    scroll = TerrainScroll()
    scroll.set_target(BOSS_CRAWL_SPEED)
    for step in range(1, 11):
        scroll.step()
        assert scroll.speed == pytest.approx(SCROLL_SPEED - step * SCROLL_ACCEL)


def test_the_speed_lands_on_the_target_without_overshoot_and_stays_there() -> None:
    scroll = TerrainScroll()
    scroll.set_target(BOSS_CRAWL_SPEED)
    for _ in range(200):
        scroll.step()
        assert scroll.speed >= BOSS_CRAWL_SPEED
    assert scroll.speed == BOSS_CRAWL_SPEED


def test_the_distance_grows_by_the_post_ramp_speed_each_step() -> None:
    scroll = TerrainScroll()
    scroll.set_target(0.5)
    scroll.step()
    assert scroll.distance == pytest.approx(SCROLL_SPEED - SCROLL_ACCEL)
    scroll.step()
    assert scroll.distance == pytest.approx(2 * SCROLL_SPEED - 3 * SCROLL_ACCEL)


def test_the_speed_recovers_to_the_cruise_speed_by_the_same_ramp() -> None:
    scroll = TerrainScroll(speed=BOSS_CRAWL_SPEED, target=BOSS_CRAWL_SPEED)
    scroll.set_target(SCROLL_SPEED)
    scroll.step()
    assert scroll.speed == pytest.approx(BOSS_CRAWL_SPEED + SCROLL_ACCEL)
    for _ in range(200):
        scroll.step()
        assert scroll.speed <= SCROLL_SPEED
    assert scroll.speed == SCROLL_SPEED


def test_a_target_within_one_accel_is_reached_in_a_single_step() -> None:
    scroll = TerrainScroll()
    scroll.set_target(SCROLL_SPEED - SCROLL_ACCEL / 2)
    scroll.step()
    assert scroll.speed == SCROLL_SPEED - SCROLL_ACCEL / 2


def test_jump_sets_the_distance_and_leaves_the_speed_alone() -> None:
    scroll = TerrainScroll()
    scroll.jump(8320.0)
    assert scroll.distance == 8320.0
    assert scroll.speed == SCROLL_SPEED
    scroll.step()
    assert scroll.distance == pytest.approx(8320.0 + SCROLL_SPEED)
