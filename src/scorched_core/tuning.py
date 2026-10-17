"""Gameplay tuning constants (constants only), in logical playfield units."""

from typing import Final

from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W

# About 1.2 s to cross the playfield width at 60 steps per second (D-10).
SHIP_SPEED: Final = PLAYFIELD_W / (1.2 * 60.0)
SHIP_HALF_W: Final = 8.0
SHIP_HALF_H: Final = 10.0
SHIP_START_X: Final = PLAYFIELD_W / 2
SHIP_START_Y: Final = PLAYFIELD_H - 48.0

# Stress storm (PLAT-04): bouncing bullets that exist only to load the pipeline.
STORM_RADIUS: Final = 2.5
STORM_SPEED_MIN: Final = 0.6  # units per 60 Hz step
STORM_SPEED_MAX: Final = 2.0
# Player hitbox core radius; plan 01-06 draws its marker.
HITBOX_RADIUS: Final = 2.0

# Terrain scroll in terrain units per 60 Hz step (about 48 units per second); STGE-02.
SCROLL_SPEED: Final = 0.8
