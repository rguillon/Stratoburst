"""The player's ship: instant-response movement clamped to the playfield."""

import math
from dataclasses import dataclass

from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    SHIP_HALF_H,
    SHIP_HALF_W,
    SHIP_SPEED,
    SHIP_START_X,
    SHIP_START_Y,
)


@dataclass(slots=True)
class PlayerShip:
    """Ship position in logical playfield units."""

    x: float = SHIP_START_X
    y: float = SHIP_START_Y
    pending_x: float = 0.0
    pending_y: float = 0.0

    def add_drag(self, dx: float, dy: float) -> None:
        """Queue finger movement (skeleton)."""

    def step(self, move_x: float, move_y: float) -> None:
        """Advance one 60 Hz step from a move vector (each axis nominally -1..1)."""
        if not math.isfinite(move_x):
            move_x = 0.0
        if not math.isfinite(move_y):
            move_y = 0.0
        length = math.hypot(move_x, move_y)
        if length > 1.0:
            move_x /= length
            move_y /= length
        self.x = min(max(self.x + move_x * SHIP_SPEED, SHIP_HALF_W), PLAYFIELD_W - SHIP_HALF_W)
        self.y = min(max(self.y + move_y * SHIP_SPEED, SHIP_HALF_H), PLAYFIELD_H - SHIP_HALF_H)
