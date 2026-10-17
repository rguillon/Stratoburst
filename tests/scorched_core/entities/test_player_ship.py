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
