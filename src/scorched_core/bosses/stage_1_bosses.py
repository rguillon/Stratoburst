"""Stage 1's bosses as data (D-02, D-09 to D-12): the armored train and the giant bomber.

The mid-boss is the armored train that rolls in halfway.

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


_WING_X: Final = 46.0  # how far to each side of the bomber's centre a wing turret sits
_ENGINE_X: Final = 26.0  # and an engine pod


def _wing_turret(dx: float) -> PartSpec:
    return PartSpec(
        kind=EnemyKind.BOMBER_TURRET,
        dx=dx,
        dy=6.0,
        hp=200,
        points=8000,
        stump_kind=EnemyKind.BOMBER_STUMP,
    )


def _engine(dx: float) -> PartSpec:
    return PartSpec(
        kind=EnemyKind.BOMBER_ENGINE,
        dx=dx,
        dy=-2.0,
        hp=220,
        points=6000,
        stump_kind=EnemyKind.BOMBER_STUMP,
    )


# The boss (D-09): a giant bomber that descends over the city on the centre column. Parts 0 and 1
# are the wing turrets and parts 2 and 3 the engines. The turrets stand clear of the hull circle
# so a bolt or a missile reaches them; an engine pod centre lies just inside the hull circle, so a
# bolt reaches it only through the narrow gap between the hull and the wing turret (the sway sweeps
# that gap across the screen, and a tracking Lv1 vulcan does wear a pod down), while the laser and
# the bomb pierce the hull and hit it anywhere. Total hit points are 2240 (hull plus
# parts), the research's starting range for a 60 to 75 s fight at Lv4-5 (tuned at the vertical-slice
# gate with ?at=boss); the kill pays nothing directly because the stage tally pays the boss bonus
# (D-18). Phase 2 starts at 60% hull or with all four parts gone and opens the core (the hull row
# becomes BOMBER_OPEN); phase 3 at 25% is the desperation, faster and denser but still sparse.
BOMBER_1: Final = BossSpec(
    hull_kind=EnemyKind.BOMBER,
    hull_hp=1400,
    hull_radius=28.0,
    x=120.0,
    enter_y=-60.0,
    hold_y=84.0,
    enter_speed=1.2,
    parts=(
        _wing_turret(-_WING_X),
        _wing_turret(_WING_X),
        _engine(-_ENGINE_X),
        _engine(_ENGINE_X),
    ),
    timeout_ticks=100 * 60,  # 100 s of fight steps (D-12): then the bomber retreats
    kill_points=0,
    death_ticks=150,
    phases=(
        PhaseSpec(
            hp_frac=1.0,
            emitters=(
                EmitterSpec("bomber_turret_spread", part=0),
                EmitterSpec("bomber_turret_spread", part=1),
                EmitterSpec("bomber_nose_ring", dy=24.0),
            ),
            sway_x=30.0,
            sway_period=360,
        ),
        PhaseSpec(
            hp_frac=0.6,  # or as soon as all four parts are gone (D-11)
            emitters=(
                EmitterSpec("bomber_turret_spread", part=0),  # fire only while the turret lives
                EmitterSpec("bomber_turret_spread", part=1),
                EmitterSpec("bomber_core_ring"),
                EmitterSpec("bomber_core_stream"),
            ),
            sway_x=36.0,
            sway_period=300,
            hull_kind=EnemyKind.BOMBER_OPEN,
        ),
        PhaseSpec(
            hp_frac=0.25,
            emitters=(
                EmitterSpec("bomber_desperation_ring"),
                EmitterSpec("bomber_desperation_spread"),
            ),
            sway_x=44.0,
            sway_y=8.0,
            sway_period=240,
        ),
    ),
)
