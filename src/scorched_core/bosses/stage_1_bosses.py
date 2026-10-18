"""Stage 1's bosses as data (D-02, D-11, D-12): the armored train that rolls in halfway.

The train runs in from above the screen along the maglev line at x 120 and holds in the upper
half while the terrain crawls beneath it. It has two destructible turrets, one fore and one aft
of the hull centre, each worth a bonus and each a permanent stump once shot off (D-14). Phase 1
aims both turrets at the ship; phase 2 starts at half hull health, or as soon as both turrets are
gone, and the hull itself fires a slow spread. A fight that nobody finishes ends in a retreat
after 45 seconds, so it can never stall the stage (D-12).

The turrets sit on the hull's own axis, so a piercing weapon (the laser, the bomb) reaches both of
them. A bolt or a missile coming from below reaches the fore turret first and is stopped by the
hull before it can reach the aft one.
"""

from typing import Final

from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.emitter_spec import EmitterSpec
from scorched_core.bosses.part_spec import PartSpec
from scorched_core.bosses.phase_spec import PhaseSpec
from scorched_core.entities.enemy_kind import EnemyKind

_TURRET_REACH: Final = 22.0  # how far fore and aft of the hull centre each turret sits
_TURRET_HP: Final = 120
_TURRET_POINTS: Final = 5000
_TIMEOUT_TICKS: Final = 45 * 60  # 45 s of fight steps (hitstop and pause do not count)


def _turret(dy: float) -> PartSpec:
    return PartSpec(
        kind=EnemyKind.TRAIN_TURRET,
        dx=0.0,
        dy=dy,
        hp=_TURRET_HP,
        points=_TURRET_POINTS,
        stump_kind=EnemyKind.TRAIN_STUMP,
    )


MIDBOSS_1: Final = BossSpec(
    hull_kind=EnemyKind.TRAIN,
    hull_hp=500,
    hull_radius=28.0,
    x=120.0,
    enter_y=-60.0,
    hold_y=96.0,
    enter_speed=1.2,
    parts=(_turret(-_TURRET_REACH), _turret(_TURRET_REACH)),
    timeout_ticks=_TIMEOUT_TICKS,
    kill_points=20000,
    death_ticks=120,
    phases=(
        PhaseSpec(
            hp_frac=1.0,
            emitters=(
                EmitterSpec("train_turret_aimed", part=0),
                EmitterSpec("train_turret_aimed", part=1),
            ),
            sway_y=8.0,
            sway_period=360,
        ),
        PhaseSpec(
            hp_frac=0.5,
            emitters=(EmitterSpec("train_hull_spread"),),
            sway_y=8.0,
            sway_period=240,
        ),
    ),
)
