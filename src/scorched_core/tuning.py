"""Gameplay tuning constants (constants only), in logical playfield units."""

from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
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

# Player life cycle (PLYR-08, PLYR-10); every window counts 60 Hz simulation steps.
DEATHBOMB_TICKS: Final = 8  # D-11: the grace window after a fatal hit, tunable
DYING_TICKS: Final = 50  # no control and no fire while the wreck burns
RESPAWN_START_Y: Final = PLAYFIELD_H + 24.0  # D-14: the fly-in starts below the playfield
RESPAWN_SPEED: Final = 2.5  # units per step while flying in
INVULN_RESPAWN_TICKS: Final = 150  # 2.5 s, inside D-14's 2-3 s
INTRO_TICKS: Final = 120  # D-26: the stage intro, about 2 s of fly-in under the STAGE banner
ENEMY_BULLET_RADIUS: Final = 2.5

# Terrain scroll in terrain units per 60 Hz step (about 48 units per second); STGE-02.
SCROLL_SPEED: Final = 0.8
SCROLL_ACCEL: Final = 0.01  # most the scroll speed may change per step toward its target
MIDBOSS_CRAWL_SPEED: Final = 0.2  # D-06: the terrain slows to a crawl for the mid-boss
BOSS_CRAWL_SPEED: Final = 0.12  # D-06: and slower still for the boss
BOSS_PHASE_SHIELD_TICKS: Final = 45  # a boss is invulnerable this long when its phase changes
BOSS_RETREAT_SPEED: Final = 1.2  # units per step a timed-out boss rises off screen (ENMY-09)
BOSS_TIMER_SHOW_S: Final = 20  # the boss countdown is published only inside the last 20 s
AT_LEAD: Final = 320.0  # distance before a marker that ``?at=`` starts at: about one screen

# Touch drag catch-up: the most finger movement (in units) the ship may still owe (INPT-02).
TOUCH_LAG_CAP: Final = 40.0

# Player bolts (PLYR-03): travelling 8 units per step, leaving the muzzle 10 units ahead.
PBULLET_SPEED: Final = 8.0
PBULLET_RADIUS: Final = 2.0
MUZZLE_AHEAD: Final = 10.0

# Weapon levels (PLYR-05, D-01): the vulcan fan is data. ``VULCAN_STREAMS[level - 1]`` lists
# one (x offset in units, angle in degrees) pair per bolt of a volley; Lv1 is the Phase 1 twin
# shot (two parallel bolts 5 units either side) and Lv5 is a seven-stream fan.
MAX_LEVEL: Final = 5
VULCAN_STREAMS: Final = (
    ((-5.0, 0.0), (5.0, 0.0)),
    ((0.0, 0.0), (-4.0, -7.0), (4.0, 7.0)),
    ((0.0, 0.0), (-3.0, -6.0), (3.0, 6.0), (-6.0, -12.0), (6.0, 12.0)),
    ((0.0, 0.0), (-3.0, -8.0), (3.0, 8.0), (-6.0, -16.0), (6.0, 16.0)),
    (
        (0.0, 0.0),
        (-2.0, -7.0),
        (2.0, 7.0),
        (-4.0, -14.0),
        (4.0, 14.0),
        (-6.0, -21.0),
        (6.0, 21.0),
    ),
)
# Steps between volleys, per level.
VULCAN_INTERVAL: Final = (5, 5, 5, 4, 4)

# Homing missiles (PLYR-04, D-03): purple fires no forward shot, only a centred fan of missiles
# per volley (``HOMING_VOLLEY[level - 1]`` of them, ``HOMING_FAN_DEG`` apart). Each turns toward
# its target by at most ``HOMING_TURN_DEG`` per step, so it visibly curves, and re-acquires the
# nearest on-screen enemy every ``HOMING_RETARGET_TICKS`` steps or when its target is gone.
HOMING_VOLLEY: Final = (1, 2, 3, 4, 5)
HOMING_INTERVAL: Final = (14, 14, 13, 12, 12)
HOMING_DAMAGE: Final = (3, 3, 3, 3, 4)
HOMING_SPEED: Final = 4.5
HOMING_TURN_DEG: Final = 5.0
HOMING_RETARGET_TICKS: Final = 8
HOMING_LIFE_TICKS: Final = 90
HOMING_FAN_DEG: Final = 22.0
HOMING_MUZZLE_AHEAD: Final = 4.0
MISSILE_RADIUS: Final = 2.5

# Laser (PLYR-04, D-02): blue is a hitscan beam locked to the ship's x, from the nose to the top of
# the playfield, that pierces every enemy in it. Its half-width in units and its damage per hit grow
# with the level; it deals that damage to everything it overlaps every ``LASER_HIT_INTERVAL`` steps.
LASER_HALF_WIDTH: Final = (2.0, 3.0, 4.0, 5.5, 7.0)
LASER_DAMAGE: Final = (1, 2, 3, 4, 5)
LASER_HIT_INTERVAL: Final = 3

# Bomb (PLYR-07, D-08, D-09, D-10): the Raiden nuke. A missile rises for ``BOMB_LAUNCH_TICKS`` steps
# toward a point ``BOMB_RISE`` units ahead of the ship (never above ``BOMB_MIN_Y``), then detonates
# into a fireball whose radius grows from ``BOMB_RADIUS_MIN`` to ``BOMB_RADIUS_MAX`` over
# ``BOMB_GROW_TICKS`` steps and lasts ``BOMB_BLAST_TICKS`` steps. It clears enemy bullets, deals
# ``BOMB_DAMAGE`` to every enemy inside it every ``BOMB_DAMAGE_INTERVAL`` steps, and the ship stays
# invulnerable for the launch, the blast and a further ``BOMB_INVULN_TAIL_TICKS``.
BOMB_START_STOCK: Final = 3
BOMB_MAX_STOCK: Final = 7
BOMB_LAUNCH_TICKS: Final = 24
BOMB_BLAST_TICKS: Final = 90
BOMB_DAMAGE: Final = 4
BOMB_DAMAGE_INTERVAL: Final = 6
BOMB_RADIUS_MIN: Final = 20.0
BOMB_RADIUS_MAX: Final = 230.0
BOMB_GROW_TICKS: Final = 30
BOMB_INVULN_TAIL_TICKS: Final = 30
BOMB_RISE: Final = 110.0
BOMB_MIN_Y: Final = 90.0

# Hitstop (VISL-04, D-26, D-27): the simulation freezes for this many steps when a bomb detonates
# and when the ship is destroyed. Nothing else freezes it: ordinary hits and kills stay smooth.
HITSTOP_BOMB_TICKS: Final = 4
HITSTOP_DEATH_TICKS: Final = 6
HITSTOP_PART_TICKS: Final = 4  # D-14: a boss part blowing off is a big event
HITSTOP_BOSS_TICKS: Final = 8  # D-14: and the boss's final explosion is the biggest

# Gallery enemies (D-17, D-20): typed targets that sway down the screen. Per-kind tuples are
# indexed by ``EnemyKind`` value (JET, HELI, CARRIER, TANK, TURRET, TRAIN, TRAIN_TURRET,
# TRAIN_STUMP). The three train kinds are the mid-boss's rows (plan 03-14): the hull is the
# largest collider in the game and still fits one grid cell with the larger shot radius.
ENEMY_FLASH_TICKS: Final = 4  # D-28: the hit flash lasts a couple of frames
ENEMY_MAX_ALIVE: Final = 56  # spawns beyond this are refused; a boss and its parts share the pool
ENEMY_EXIT_MARGIN: Final = 24.0  # an enemy this far outside the playfield is gone
ENEMY_SWAY: Final = 30.0  # sinusoidal sway amplitude in units
ENEMY_SWAY_PERIOD: Final = 120  # steps per full sway cycle
ENEMY_RADIUS: Final = (9.0, 10.0, 14.0, 11.0, 10.0, 28.0, 11.0, 6.0)
ENEMY_HP: Final = (3, 6, 12, 8, 6, 500, 120, 1)
ENEMY_BLAST: Final = (
    BLAST_SMALL,
    BLAST_MEDIUM,
    BLAST_MEDIUM,
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
)
ENEMY_GROUND: Final = (False, False, False, True, True, True, True, True)

# Enemy fire (D-17), Raiden pacing and not bullet hell. Fire is data (ENMY-04): each kind names
# its default pattern from the PATTERNS registry (patterns/pattern_library.py), indexed by
# EnemyKind (JET, HELI, CARRIER, TANK, TURRET, TRAIN, TRAIN_TURRET, TRAIN_STUMP); None means the
# kind never fires (a boss's own guns are emitters in its BossSpec, not the pool's). A stage
# wave can name another pattern. Nothing fires until a pattern's delay (ENEMY_FIRE_DELAY steps
# by default) after it spawned, nor above the top edge or below ENEMY_FIRE_MAX_Y, so nothing
# shoots point-blank from under the ship.
ENEMY_FIRE_DELAY: Final = 45
ENEMY_FIRE_MAX_Y: Final = PLAYFIELD_H * 0.7
ENEMY_PATTERN: Final = (
    "jet_aimed",
    "heli_ring",
    None,
    "tank_aimed",
    "turret_aimed",
    None,
    None,
    None,
)

# Scoring (SCOR-01, SCOR-04, D-17, D-19), all tunable. A kill pays a fixed amount by kind, indexed
# by EnemyKind (JET, HELI, CARRIER, TANK, TURRET; the train kinds pay 0 because the boss
# controller pays its parts and its hull): no multiplier and no point-blank bonus. The
# deferred Lv5 MAX catch pays a flat MAX_BONUS_POINTS. The score is a Python int clamped at
# SCORE_CAP, seven digits, so the float32 header slot always holds it exactly. The player starts
# with LIVES_START ships (never more than LIVES_CAP) and earns an extend at EXTEND_FIRST and then
# every EXTEND_EVERY.
ENEMY_POINTS: Final = (300, 800, 2000, 1000, 1200, 0, 0, 0)
SCORE_CAP: Final = 9_999_999
MAX_BONUS_POINTS: Final = 10_000
LIVES_START: Final = 3
LIVES_CAP: Final = 9
EXTEND_FIRST: Final = 200_000
EXTEND_EVERY: Final = 500_000

# Helicopters (D-17): descend to HOVER_STOP_Y, hold there drifting side to side, then leave.
HOVER_STOP_Y: Final = 96.0
HOVER_HOLD_TICKS: Final = 240
HOVER_DRIFT: Final = 20.0  # side-to-side amplitude in units
HOVER_DRIFT_PERIOD: Final = 180  # steps per full drift cycle
HOVER_EXIT_SPEED: Final = 1.4  # units per step, straight down

# Ground units are anchored to the terrain (D-21, STGE-04) and scroll with it. A ratio below 1
# keeps the residual slide against the ray-compensated JS ground layer within about 2% across
# aspect ratios (RESEARCH Pattern 14, about 1 / 1.065); it is exported in the manifest.
GROUND_SCROLL_RATIO: Final = 0.94

# The authored city (D-34): roads run down the screen at logical x = CITY_PITCH * c and across it
# every CITY_PITCH distance units; the blocks between them fill the middle CITY_BLOCK of each
# cell. GROUND_Y0 is the logical y of a ground placement when the scroll equals its distance, and
# CITY_MAX_HEIGHT keeps every building top below the gameplay plane once the ground layer scales
# it (the terrain sits 40 units under the plane).
CITY_PITCH: Final = 80.0
CITY_BLOCK: Final = 64.0
GROUND_Y0: Final = -40.0
CITY_MAX_HEIGHT: Final = 34.0
CITY_CORRIDOR_HALF: Final = 6.0  # no lot is built this close to a maglev or runway line

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
_GROUND: Final = MotionKind.GROUND
_TANK: Final = EnemyKind.TANK
_TURRET: Final = EnemyKind.TURRET
_CRYSTAL: Final = PickupKind.CRYSTAL
_BOMB: Final = PickupKind.BOMB
GALLERY_SCRIPT: Final = (
    (30, _JET, 60.0, -12.0, _DIVE, 0.5, 2.2, -1),  # a V from the top
    (42, _JET, 120.0, -12.0, _DIVE, 0.0, 2.4, -1),
    (54, _JET, 180.0, -12.0, _DIVE, -0.5, 2.2, -1),
    (200, _HELI, 80.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (230, _HELI, 160.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (300, _TANK, 70.0, -16.0, _GROUND, 0.25, 0.0, -1),  # ground units crawl with the terrain
    (340, _TURRET, 60.0, -16.0, _GROUND, 0.0, 0.0, _BOMB),
    (400, _CARRIER, 120.0, -18.0, _SWAY, 0.0, 0.5, _CRYSTAL),
    (520, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),  # sweeping in from the left
    (535, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),
    (550, _JET, -12.0, 60.0, _DIVE, 2.4, 0.9, -1),
    (620, _TANK, 180.0, -16.0, _GROUND, -0.25, 0.0, -1),
    (700, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),  # and from the right
    (715, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),
    (730, _JET, 252.0, 80.0, _DIVE, -2.4, 0.9, -1),
    (780, _TURRET, 180.0, -16.0, _GROUND, 0.0, 0.0, _BOMB),
    (860, _HELI, 120.0, -14.0, _HOVER, 0.0, 1.2, -1),
    (900, _JET, 50.0, -12.0, _SWAY, 0.0, 1.1, -1),
    (900, _JET, 190.0, -12.0, _SWAY, 0.0, 1.1, -1),
    (1000, _CARRIER, 70.0, -18.0, _SWAY, 0.0, 0.5, _CRYSTAL),
    (1060, _JET, 100.0, -12.0, _DIVE, 0.3, 2.3, -1),
    (1072, _JET, 140.0, -12.0, _DIVE, -0.3, 2.3, -1),
    (1120, _TANK, 90.0, -16.0, _GROUND, 0.2, 0.0, -1),
    (1135, _TANK, 150.0, -16.0, _GROUND, -0.2, 0.0, -1),
)

# Pickups (PLYR-04, D-16): a carrier's crystal cycles red, blue, purple every CRYSTAL_CYCLE_TICKS,
# is launched up and sideways at CRYSTAL_SPEED, and is caught by the ship's body (a grab circle
# around its centre), not by the small hitbox core. After PICKUP_LIFE_TICKS it stops bouncing
# and drifts off the bottom at PICKUP_EXIT_SPEED.
CRYSTAL_CYCLE_TICKS: Final = 90
CRYSTAL_SPEED: Final = 0.8
PICKUP_RADIUS: Final = 6.0
PICKUP_GRAB_RADIUS: Final = 10.0
PICKUP_LIFE_TICKS: Final = 600
PICKUP_EXIT_SPEED: Final = 0.8
# A bomb pickup (PLYR-09, D-19) is dropped by a killed AA turret and falls slowly straight down.
BOMB_DROP_VY: Final = 0.5

# Medals (SCOR-02, D-15, D-16): a destroyed ground target may drop a medal that drifts down with
# the scroll at the ground speed and never bounces or times out. Catching one pays the chain value,
# which climbs the ladder on every catch and stays at its last entry; a medal that scrolls off, or
# a death, restarts the ladder. Medals may not take the last MEDAL_RESERVE pickup slots, so a flood
# of medals never blocks a weapon or bomb pickup (RESEARCH Pitfall 14).
MEDAL_LADDER: Final = (100, 200, 500, 1000, 2000, 5000, 10000)
MEDAL_RESERVE: Final = 4

# Death (PLYR-06, D-04, D-05): a death costs DEATH_LEVEL_PENALTY weapon levels (a reversible
# tuning constant, floor 1) and leaves one fixed-colour recovery pickup at the death spot, drifting
# up at RECOVERY_VY. The spot is clamped RECOVERY_MARGIN inside the pickup radius at the sides and
# RECOVERY_BOTTOM_MARGIN above the bottom edge so the ship can always fly to it.
DEATH_LEVEL_PENALTY: Final = 2
RECOVERY_VY: Final = -0.5
RECOVERY_MARGIN: Final = 4.0
RECOVERY_BOTTOM_MARGIN: Final = 40.0

# Broadphase cell edge; the largest ENEMY_RADIUS plus PBULLET_RADIUS or MISSILE_RADIUS must stay
# at or below it so a 3x3 query suffices.
GRID_CELL: Final = 32.0
# The largest radius a boss or part row may have: the 3x3 broadphase stays exact only while a
# collider plus the larger player shot (bolt or missile) fits inside one cell (RESEARCH Pitfall 2).
BOSS_MAX_RADIUS: Final = GRID_CELL - max(PBULLET_RADIUS, MISSILE_RADIUS)
