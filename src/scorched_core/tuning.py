"""Gameplay tuning constants (constants only), in logical playfield units."""

from typing import Final

from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W

# About 1.2 s to cross the playfield width at 60 steps per second (D-10).
SHIP_SPEED: Final = PLAYFIELD_W / (1.2 * 60.0)
SHIP_HALF_W: Final = 8.0
SHIP_HALF_H: Final = 10.0
SHIP_START_X: Final = PLAYFIELD_W / 2
SHIP_START_Y: Final = PLAYFIELD_H - 48.0
