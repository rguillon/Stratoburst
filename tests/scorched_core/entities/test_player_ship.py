import math

import pytest

from scorched_core.entities.player_ship import PlayerShip
from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    SHIP_HALF_H,
    SHIP_HALF_W,
    SHIP_SPEED,
    SHIP_START_X,
    SHIP_START_Y,
    TOUCH_LAG_CAP,
)


def test_speed_matches_decision_d10() -> None:
    assert pytest.approx(240 / 72) == SHIP_SPEED


def test_right_step_moves_one_speed_unit() -> None:
    ship = PlayerShip()
    ship.step(1.0, 0.0)
    assert ship.x == pytest.approx(SHIP_START_X + SHIP_SPEED)
    assert ship.y == SHIP_START_Y


def test_diagonal_is_normalised() -> None:
    ship = PlayerShip()
    ship.step(1.0, -1.0)
    displacement = math.hypot(ship.x - SHIP_START_X, ship.y - SHIP_START_Y)
    assert displacement == pytest.approx(SHIP_SPEED, abs=1e-9)


def test_short_vector_is_not_scaled_up() -> None:
    ship = PlayerShip()
    ship.step(0.5, 0.0)
    assert ship.x == pytest.approx(SHIP_START_X + 0.5 * SHIP_SPEED)


@pytest.mark.parametrize(
    ("move", "attr", "expected"),
    [
        ((-1.0, 0.0), "x", SHIP_HALF_W),
        ((1.0, 0.0), "x", PLAYFIELD_W - SHIP_HALF_W),
        ((0.0, -1.0), "y", SHIP_HALF_H),
        ((0.0, 1.0), "y", PLAYFIELD_H - SHIP_HALF_H),
    ],
)
def test_clamps_at_all_four_edges(move: tuple[float, float], attr: str, expected: float) -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(*move)
    assert getattr(ship, attr) == expected


@pytest.mark.parametrize(
    ("move_x", "move_y"),
    [(math.nan, 0.0), (0.0, math.inf), (-math.inf, math.nan)],
)
def test_non_finite_input_is_ignored(move_x: float, move_y: float) -> None:
    ship = PlayerShip()
    ship.step(move_x, move_y)
    assert (ship.x, ship.y) == (SHIP_START_X, SHIP_START_Y)


def test_lag_cap_is_forty_units() -> None:
    assert TOUCH_LAG_CAP == 40.0


def test_drag_is_caught_up_over_following_steps_at_keyboard_speed() -> None:
    ship = PlayerShip()
    ship.add_drag(10.0, 0.0)
    for _ in range(3):
        ship.step(0.0, 0.0)
    assert ship.x == pytest.approx(SHIP_START_X + 10.0)
    assert ship.y == SHIP_START_Y
    assert (ship.pending_x, ship.pending_y) == (0.0, 0.0)


def test_one_step_never_moves_further_than_the_keyboard_speed() -> None:
    ship = PlayerShip()
    ship.add_drag(30.0, 40.0)
    ship.step(0.0, 0.0)
    assert math.hypot(ship.x - SHIP_START_X, ship.y - SHIP_START_Y) == pytest.approx(SHIP_SPEED)


def test_catch_up_keeps_the_drag_direction() -> None:
    ship = PlayerShip()
    ship.add_drag(30.0, 40.0)
    ship.step(0.0, 0.0)
    assert (ship.x - SHIP_START_X) / (ship.y - SHIP_START_Y) == pytest.approx(30.0 / 40.0)


def test_a_small_drag_lands_exactly_and_clears_pending() -> None:
    ship = PlayerShip()
    ship.add_drag(1.0, -0.5)
    ship.step(0.0, 0.0)
    assert ship.x == pytest.approx(SHIP_START_X + 1.0)
    assert ship.y == pytest.approx(SHIP_START_Y - 0.5)
    assert (ship.pending_x, ship.pending_y) == (0.0, 0.0)


def test_pending_is_capped_at_the_lag_cap() -> None:
    ship = PlayerShip()
    ship.add_drag(100.0, 0.0)
    assert (ship.pending_x, ship.pending_y) == (40.0, 0.0)


def test_capping_preserves_the_direction_of_a_diagonal_drag() -> None:
    ship = PlayerShip()
    ship.add_drag(30.0, 40.0)
    assert math.hypot(ship.pending_x, ship.pending_y) <= TOUCH_LAG_CAP + 1e-9
    assert ship.pending_x / ship.pending_y == pytest.approx(30.0 / 40.0)


def test_drags_accumulate_until_the_cap() -> None:
    ship = PlayerShip()
    ship.add_drag(10.0, 0.0)
    ship.add_drag(15.0, 0.0)
    assert ship.pending_x == pytest.approx(25.0)


def test_keyboard_overrides_drag_and_leaves_pending_untouched() -> None:
    ship = PlayerShip()
    ship.add_drag(0.0, 20.0)
    ship.step(1.0, 0.0)
    assert ship.x == pytest.approx(SHIP_START_X + SHIP_SPEED)
    assert ship.y == SHIP_START_Y
    assert (ship.pending_x, ship.pending_y) == (0.0, 20.0)


@pytest.mark.parametrize(
    ("dx", "dy"),
    [(math.nan, 5.0), (5.0, math.nan), (math.inf, 0.0), (0.0, -math.inf)],
)
def test_non_finite_drag_is_ignored(dx: float, dy: float) -> None:
    ship = PlayerShip()
    ship.add_drag(7.0, 0.0)
    ship.add_drag(dx, dy)
    assert (ship.pending_x, ship.pending_y) == (7.0, 0.0)


def test_wall_rule_discards_pending_pushed_into_the_wall() -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(1.0, 0.0)
    assert ship.x == PLAYFIELD_W - SHIP_HALF_W
    ship.add_drag(30.0, 0.0)
    ship.step(0.0, 0.0)
    assert ship.pending_x == 0.0
    assert ship.x == PLAYFIELD_W - SHIP_HALF_W


def test_wall_rule_reverse_drag_moves_immediately() -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(1.0, 0.0)
    ship.add_drag(30.0, 0.0)
    ship.step(0.0, 0.0)
    before = ship.x
    ship.add_drag(-5.0, 0.0)
    ship.step(0.0, 0.0)
    assert ship.x == pytest.approx(before - SHIP_SPEED)


def test_wall_rule_discards_only_the_blocked_axis() -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(0.0, 1.0)
    assert ship.y == PLAYFIELD_H - SHIP_HALF_H
    ship.add_drag(20.0, 20.0)
    ship.step(0.0, 0.0)
    assert ship.pending_y == 0.0
    assert ship.pending_x > 0.0
    assert ship.x > SHIP_START_X


def test_wall_rule_on_the_top_edge() -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(0.0, -1.0)
    ship.add_drag(0.0, -30.0)
    ship.step(0.0, 0.0)
    assert (ship.y, ship.pending_y) == (SHIP_HALF_H, 0.0)


def test_a_ship_standing_at_a_wall_with_no_drag_keeps_zero_pending() -> None:
    ship = PlayerShip()
    for _ in range(1000):
        ship.step(-1.0, 0.0)
    ship.step(0.0, 0.0)
    assert (ship.pending_x, ship.pending_y) == (0.0, 0.0)
