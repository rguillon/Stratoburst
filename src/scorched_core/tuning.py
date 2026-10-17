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

# Touch drag catch-up: the most finger movement (in units) the ship may still owe (INPT-02).
TOUCH_LAG_CAP: Final = 40.0

# Twin shot (PLYR-03): one volley every 5 steps, bolts travelling 8 units per step.
FIRE_INTERVAL_TICKS: Final = 5
PBULLET_SPEED: Final = 8.0
PBULLET_RADIUS: Final = 2.0
TWIN_OFFSET: Final = 5.0
MUZZLE_AHEAD: Final = 10.0

# Drifting air drones (D-14): plain block targets that sway down the screen.
DRONE_RADIUS: Final = 8.0
DRONE_HP: Final = 3
DRONE_SPEED: Final = 0.9  # units per step, downward
DRONE_SWAY: Final = 30.0  # sinusoidal sway amplitude in units
DRONE_SWAY_PERIOD: Final = 120  # steps per full sway cycle
DRONE_SPAWN_INTERVAL: Final = 40  # steps between spawns
DRONE_MAX_ALIVE: Final = 10
DRONE_FLASH_TICKS: Final = 6
# Derived so a drone at full sway still lies wholly inside the playfield.
DRONE_SPAWN_MARGIN_X: Final = DRONE_SWAY + DRONE_RADIUS

# Broadphase cell edge; must be at least DRONE_RADIUS + PBULLET_RADIUS so a 3x3 query suffices.
GRID_CELL: Final = 32.0
