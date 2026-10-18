"""Gameplay tuning constants (constants only), in logical playfield units."""

from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
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

# Helicopters (D-17): descend to HOVER_STOP_Y, hold there drifting side to side, then leave.
HOVER_STOP_Y: Final = 96.0
HOVER_HOLD_TICKS: Final = 240
HOVER_DRIFT: Final = 20.0  # side-to-side amplitude in units
HOVER_DRIFT_PERIOD: Final = 180  # steps per full drift cycle
HOVER_EXIT_SPEED: Final = 1.4  # units per step, straight down

# The shooting gallery's looping spawn script (D-17), the stand-in for the Phase 3 stage
# timeline. Entries are ``(tick, kind, x, y, motion, vx, vy, drop)`` sorted by tick: jets dive
# in as a V from the top and sweep in from both sides, helicopters hover, carriers cruise.
GALLERY_LOOP_TICKS: Final = 1200
_JET: Final = EnemyKind.JET
_HELI: Final = EnemyKind.HELI
_CARRIER: Final = EnemyKind.CARRIER
_DIVE: Final = MotionKind.DIVE
_HOVER: Final = MotionKind.HOVER
_SWAY: Final = MotionKind.SWAY
GALLERY_SCRIPT: Final = (
    (30, _JET, 60.0, -12.0, _DIVE, 0.5, 2.2, -1),  # a V from the top
    (42, _JET, 120.0, -12.0, _DIVE, 0.0, 2.4, -1),
    (54, _JET, 180.0, -12.0, _DIVE, -0.5, 2.2, -1),
    (200, _HELI, 80.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (230, _HELI, 160.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (400, _CARRIER, 120.0, -18.0, _SWAY, 0.0, 0.5, -1),
    (520, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),  # sweeping in from the left
    (535, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),
    (550, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),
    (700, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),  # and from the right
    (715, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),
    (730, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),
    (860, _HELI, 120.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (900, _JET, 50.0, -12.0, _SWAY, 0.0, 1.1, -1),
    (900, _JET, 190.0, -12.0, _SWAY, 0.0, 1.1, -1),
    (1000, _CARRIER, 70.0, -18.0, _SWAY, 0.0, 0.5, -1),
    (1060, _JET, 100.0, -12.0, _DIVE, 0.3, 2.3, -1),
    (1072, _JET, 140.0, -12.0, _DIVE, -0.3, 2.3, -1),
)

# Broadphase cell edge; the largest ENEMY_RADIUS plus PBULLET_RADIUS must stay at or below it
# so a 3x3 query suffices.
GRID_CELL: Final = 32.0
