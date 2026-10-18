"""The player's ship: instant-response movement clamped to the playfield, and its fly-in."""

import math
from dataclasses import dataclass

from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    RESPAWN_SPEED,
    RESPAWN_START_Y,
    SHIP_HALF_H,
    SHIP_HALF_W,
    SHIP_SPEED,
    SHIP_START_X,
    SHIP_START_Y,
    TOUCH_LAG_CAP,
)


@dataclass(slots=True)
class PlayerShip:
    """Ship position in logical playfield units, plus the touch drag it still owes."""

    x: float = SHIP_START_X
    y: float = SHIP_START_Y
    pending_x: float = 0.0
    pending_y: float = 0.0

    def add_drag(self, dx: float, dy: float) -> None:
        """Queue finger movement (units) to be caught up over the following steps."""
        if not (math.isfinite(dx) and math.isfinite(dy)):
            return
        self.pending_x += dx
        self.pending_y += dy
        length = math.hypot(self.pending_x, self.pending_y)
        if length > TOUCH_LAG_CAP:
            scale = TOUCH_LAG_CAP / length
            self.pending_x *= scale
            self.pending_y *= scale

    def respawn_start(self) -> None:
        """Place the ship below the playfield, centred, with no touch drag owed (D-14)."""
        self.x = SHIP_START_X
        self.y = RESPAWN_START_Y
        self.pending_x = 0.0
        self.pending_y = 0.0

    def fly_in(self) -> bool:
        """Rise ``RESPAWN_SPEED`` towards the start position; return True once it has arrived."""
        self.y = max(self.y - RESPAWN_SPEED, SHIP_START_Y)
        return self.y <= SHIP_START_Y

    def step(self, move_x: float, move_y: float) -> None:
        """Advance one 60 Hz step from a move vector (each axis nominally -1..1).

        A non-zero keyboard vector wins and leaves the queued drag alone; otherwise the drag is
        caught up at no more than the keyboard speed.
        """
        if not math.isfinite(move_x):
            move_x = 0.0
        if not math.isfinite(move_y):
            move_y = 0.0
        length = math.hypot(move_x, move_y)
        if length > 1.0:
            move_x /= length
            move_y /= length
        if move_x or move_y:
            delta_x = move_x * SHIP_SPEED
            delta_y = move_y * SHIP_SPEED
        else:
            delta_x, delta_y = self._take_pending()
        wanted_x = self.x + delta_x
        wanted_y = self.y + delta_y
        self.x = min(max(wanted_x, SHIP_HALF_W), PLAYFIELD_W - SHIP_HALF_W)
        self.y = min(max(wanted_y, SHIP_HALF_H), PLAYFIELD_H - SHIP_HALF_H)
        # Wall rule: drag pushed into an edge is discarded, so reversing moves the ship at once.
        if self.x != wanted_x:
            self.pending_x = 0.0
        if self.y != wanted_y:
            self.pending_y = 0.0

    def _take_pending(self) -> tuple[float, float]:
        """Remove and return up to one step's worth (at most SHIP_SPEED long) of pending drag."""
        distance = math.hypot(self.pending_x, self.pending_y)
        if distance <= SHIP_SPEED:
            taken = (self.pending_x, self.pending_y)
            self.pending_x = 0.0
            self.pending_y = 0.0
            return taken
        scale = SHIP_SPEED / distance
        taken = (self.pending_x * scale, self.pending_y * scale)
        self.pending_x -= taken[0]
        self.pending_y -= taken[1]
        return taken
