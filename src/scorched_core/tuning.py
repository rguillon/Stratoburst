"""Gameplay tuning constants (constants only), in logical playfield units."""

from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.protocol import BLAST_LARGE, BLAST_MEDIUM, BLAST_SMALL, PLAYFIELD_H, PLAYFIELD_W

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

# Gallery enemies (D-17, D-20): typed targets that sway down the screen. Per-kind tuples are
# indexed by ``EnemyKind`` value (JET, HELI, CARRIER, TANK, TURRET).
ENEMY_FLASH_TICKS: Final = 4  # D-28: the hit flash lasts a couple of frames
ENEMY_MAX_ALIVE: Final = 40  # spawns beyond this are refused; the columns hold ENEMY_CAP
ENEMY_EXIT_MARGIN: Final = 24.0  # an enemy this far outside the playfield is gone
ENEMY_SWAY: Final = 30.0  # sinusoidal sway amplitude in units
ENEMY_SWAY_PERIOD: Final = 120  # steps per full sway cycle
ENEMY_RADIUS: Final = (9.0, 10.0, 14.0, 11.0, 10.0)
ENEMY_HP: Final = (3, 6, 12, 8, 6)
ENEMY_BLAST: Final = (BLAST_SMALL, BLAST_MEDIUM, BLAST_MEDIUM, BLAST_LARGE, BLAST_MEDIUM)
ENEMY_GROUND: Final = (False, False, False, True, True)

# The shooting gallery's looping spawn script (D-17), the stand-in for the Phase 3 stage
# timeline. Entries are ``(tick, kind, x, y, vx, vy, drop)`` sorted by tick; ten jets arrive
# 40 ticks apart (the Phase 1 drone cadence), the last one inside the loop.
GALLERY_LOOP_TICKS: Final = 400
_GALLERY_JET_X: Final = (60.0, 180.0, 120.0, 90.0, 150.0, 70.0, 170.0, 110.0, 130.0, 100.0)
GALLERY_SCRIPT: Final = tuple(
    (39 + 40 * i, EnemyKind.JET, x, -12.0, 0.0, 0.9, -1) for i, x in enumerate(_GALLERY_JET_X)
)

# Broadphase cell edge; the largest ENEMY_RADIUS plus PBULLET_RADIUS must stay at or below it
# so a 3x3 query suffices.
GRID_CELL: Final = 32.0
