"""Stage 1 as data (D-03): the slums opening, then the mid-boss and boss markers.

Distances are scroll units (48 per second at the cruise speed of 0.8 per step). The opening is
sparse on purpose (D-07, Raiden pacing): a few jets, a helicopter or two, tanks crawling down the
two roads (x 80 and 160) and a carrier about every 30 to 40 seconds (D-08). The opening waves
name their bullet patterns (a jet spread, a helicopter ring, a tank aimed shot, a turret stream),
all slow and spaced out so they stay approachable.
"""

from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.wave_entry import WaveEntry

_JET: Final = EnemyKind.JET
_HELI: Final = EnemyKind.HELI
_CARRIER: Final = EnemyKind.CARRIER
_TANK: Final = EnemyKind.TANK
_TURRET: Final = EnemyKind.TURRET
_DIVE: Final = MotionKind.DIVE
_HOVER: Final = MotionKind.HOVER
_SWAY: Final = MotionKind.SWAY
_GROUND: Final = MotionKind.GROUND

_MIDBOSS_AT: Final = 4200.0
_BOSS_AT: Final = 8640.0  # about three minutes in (D-01)

STAGE_1: Final = StageData(
    number=1,
    length=_BOSS_AT + 660.0,
    waves=(
        # A V of jets diving from the top, each fanning a slow spread of three.
        WaveEntry(80.0, _JET, 60.0, y=-12.0, vx=0.5, vy=2.2, pattern="spread3"),
        WaveEntry(90.0, _JET, 120.0, y=-12.0, vy=2.4, pattern="spread3"),
        WaveEntry(100.0, _JET, 180.0, y=-12.0, vx=-0.5, vy=2.2, pattern="spread3"),
        # Two helicopters hover over the first avenue, each throwing a slow ring of ten.
        WaveEntry(380.0, _HELI, 80.0, y=-14.0, motion=_HOVER, vy=1.2, pattern="ring10_slow"),
        WaveEntry(420.0, _HELI, 160.0, y=-14.0, motion=_HOVER, vy=1.2, pattern="ring10_slow"),
        # The first carrier: kill it for a crystal.
        WaveEntry(600.0, _CARRIER, 120.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
        # A tank column crawls down the left road, then another down the right.
        WaveEntry(820.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow"),
        WaveEntry(850.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow"),
        WaveEntry(880.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow"),
        WaveEntry(1000.0, _TANK, 160.0, motion=_GROUND, vy=0.0),
        WaveEntry(1030.0, _TANK, 160.0, motion=_GROUND, vy=0.0),
        # An AA turret guards a bomb.
        WaveEntry(
            1200.0, _TURRET, 80.0, motion=_GROUND, vy=0.0, drop=PickupKind.BOMB, pattern="stream3"
        ),
        # Jets sweep in from the left.
        WaveEntry(1400.0, _JET, -12.0, y=60.0, vx=2.4, vy=0.9),
        WaveEntry(1415.0, _JET, -12.0, y=60.0, vx=2.4, vy=0.9),
        WaveEntry(1430.0, _JET, -12.0, y=60.0, vx=2.4, vy=0.9),
        WaveEntry(1560.0, _HELI, 120.0, y=-14.0, motion=_HOVER, vy=1.2),
        # And from the right.
        WaveEntry(1700.0, _JET, 252.0, y=80.0, vx=-2.4, vy=0.9),
        WaveEntry(1715.0, _JET, 252.0, y=80.0, vx=-2.4, vy=0.9),
        WaveEntry(1730.0, _JET, 252.0, y=80.0, vx=-2.4, vy=0.9),
        # A pair of swaying jets, then both roads at once.
        WaveEntry(1850.0, _JET, 50.0, y=-12.0, motion=_SWAY, vy=1.1),
        WaveEntry(1850.0, _JET, 190.0, y=-12.0, motion=_SWAY, vy=1.1),
        WaveEntry(1950.0, _TANK, 80.0, motion=_GROUND, vy=0.0),
        WaveEntry(1950.0, _TANK, 160.0, motion=_GROUND, vy=0.0),
        WaveEntry(2050.0, _TURRET, 160.0, motion=_GROUND, vy=0.0, drop=PickupKind.BOMB),
        # The second carrier, 1560 units (32 s) after the first.
        WaveEntry(2160.0, _CARRIER, 70.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
        # A closing V, a helicopter and a last tank before the downtown section.
        WaveEntry(2300.0, _JET, 100.0, y=-12.0, vx=0.3, vy=2.3),
        WaveEntry(2312.0, _JET, 140.0, y=-12.0, vx=-0.3, vy=2.3),
        WaveEntry(2450.0, _HELI, 120.0, y=-14.0, motion=_HOVER, vy=1.2),
        WaveEntry(2550.0, _TANK, 160.0, motion=_GROUND, vy=0.0),
    ),
    markers=(("midboss", _MIDBOSS_AT), ("boss", _BOSS_AT)),
)
