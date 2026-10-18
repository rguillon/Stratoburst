"""Stage 1 as data (D-03): slums, downtown and the airbase, then the boss marker (D-35).

Distances are scroll units (48 per second at the cruise speed of 0.8 per step); the boss marker
sits at 8640, about three minutes in (D-01). The slums opening is sparse on purpose (D-07, Raiden
pacing): a few jets, a helicopter or two, tanks crawling down the two roads (x 80 and 160; the
left column carries medals) and a carrier about every 30 to 40 seconds (D-08). Downtown is
denser, with jets in curved formations on authored paths, helicopter pairs, tank columns driving
down their roads and rooftop turrets, and breaks for the mid-boss at 4200: nothing spawns in the
``MIDBOSS_LULL`` after its marker. The airbase strafes, brings heavier turret groups and the last
carrier, then goes quiet for ``BOSS_QUIET`` units before the bomber arrives. Every wave names
slow, spaced-out bullet patterns. Each section is a tuple of rows (formation helpers expand into
plain rows) and the stage merges them with a stable sort on ``at``, so rows that share a distance
keep their authored order.

The city under it is data too (D-34, D-35): a road grid of ``CityBlock`` rows, 80 distance units
apart, in the three playfield columns. Dark low-rise slums with sparse neon open the stage,
downtown is dense neon with towers, signs and an elevated maglev line along x = 120 that runs
past the mid-boss marker, and the lit airbase has hangars and runway lights where the bomber
arrives. Burning ruins appear in every section (D-33). ``scenery_placements`` expands the whole
thing once, in ``StageData``.

Only selected buildings are destructible (D-05): every few blocks of a section flag their middle
lot as a target (houses and fuel tanks in the slums, billboards and depots downtown, fuel tanks
and depots at the airbase), two of every three carrying a medal (D-15). ``target_entries``
turns the flagged lots into the stage's ground rows, which spawn on their blocks.
"""

import math
from typing import Final

from scorched_core.bosses.stage_1_bosses import MIDBOSS_1
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_builder import target_entries
from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.city_style import CityStyle
from scorched_core.stages.formations import (
    column_formation,
    line_formation,
    mirrored,
    v_formation,
)
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.wave_entry import WaveEntry
from scorched_core.tuning import CITY_BLOCK, CITY_CORRIDOR_HALF, CITY_PITCH

_JET: Final = EnemyKind.JET
_HELI: Final = EnemyKind.HELI
_CARRIER: Final = EnemyKind.CARRIER
_TANK: Final = EnemyKind.TANK
_TURRET: Final = EnemyKind.TURRET
_DIVE: Final = MotionKind.DIVE
_HOVER: Final = MotionKind.HOVER
_SWAY: Final = MotionKind.SWAY
_GROUND: Final = MotionKind.GROUND
_PATH: Final = MotionKind.PATH

_MEDAL: Final = PickupKind.MEDAL
_HOUSE: Final = EnemyKind.HOUSE
_FUEL_TANK: Final = EnemyKind.FUEL_TANK
_DEPOT: Final = EnemyKind.DEPOT
_BILLBOARD: Final = EnemyKind.BILLBOARD
_TARGET_DROPS: Final = (_MEDAL, _MEDAL, None)  # two targets in three carry a medal (D-15)

_MIDBOSS_AT: Final = 4200.0
_BOSS_AT: Final = 8640.0  # about three minutes in (D-01)

DOWNTOWN_AT: Final = 2600.0  # the slums end and the neon downtown begins (D-35)
AIRBASE_AT: Final = 6500.0  # the rooftop airbase begins
MIDBOSS_LULL: Final = 420.0  # nothing spawns this far past the mid-boss marker
BOSS_QUIET: Final = 240.0  # nothing spawns this close before the boss marker
_RESUME_AT: Final = _MIDBOSS_AT + MIDBOSS_LULL  # the first wave after the mid-boss
_LAST_WAVE_AT: Final = _BOSS_AT - BOSS_QUIET

_SLUMS: Final = (
    # A V of jets diving from the top, each fanning a slow spread of three.
    WaveEntry(80.0, _JET, 60.0, y=-12.0, vx=0.5, vy=2.2, pattern="spread3"),
    WaveEntry(90.0, _JET, 120.0, y=-12.0, vy=2.4, pattern="spread3"),
    WaveEntry(100.0, _JET, 180.0, y=-12.0, vx=-0.5, vy=2.2, pattern="spread3"),
    # Two helicopters hover over the first avenue, each throwing a slow ring of ten.
    WaveEntry(380.0, _HELI, 80.0, y=-14.0, motion=_HOVER, vy=1.2, pattern="ring10_slow"),
    WaveEntry(420.0, _HELI, 160.0, y=-14.0, motion=_HOVER, vy=1.2, pattern="ring10_slow"),
    # The first carrier: kill it for a crystal.
    WaveEntry(600.0, _CARRIER, 120.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
    # A tank column crawls down the left road, each tank carrying a medal, then another down the
    # right.
    WaveEntry(820.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow", drop=_MEDAL),
    WaveEntry(850.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow", drop=_MEDAL),
    WaveEntry(880.0, _TANK, 80.0, motion=_GROUND, vy=0.0, pattern="aimed_slow", drop=_MEDAL),
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
)

_DOWNTOWN: Final = (
    # Two Vs of jets swoop in from opposite corners and cross over the avenues.
    *mirrored(
        v_formation(
            2640.0, _JET, 50.0, 3, 24.0, 12.0, motion=_PATH, path="swoop", pattern="aimed_slow"
        )
    ),
    # A tank column drives down the left road, a rooftop turret covers the right.
    *column_formation(
        2880.0,
        _TANK,
        80.0,
        3,
        36.0,
        motion=_PATH,
        path="road_down",
        pattern="aimed_slow",
        drop=_MEDAL,
    ),
    WaveEntry(2900.0, _TURRET, 200.0, motion=_GROUND, vy=0.0, pattern="stream3", drop=_MEDAL),
    # Four jets weave down the screen abreast.
    *line_formation(
        3060.0, _JET, 120.0, 4, 44.0, motion=_PATH, path="s_dive", pattern="aimed_slow"
    ),
    # A helicopter pair arcs across from both sides, ringing as it goes.
    *mirrored(
        (
            WaveEntry(
                3260.0, _HELI, 30.0, y=-14.0, motion=_PATH, path="hover_arc", pattern="ring10_slow"
            ),
        )
    ),
    # Rooftop turrets; the right one guards a bomb.
    WaveEntry(3420.0, _TURRET, 40.0, motion=_GROUND, vy=0.0, pattern="stream3"),
    WaveEntry(3440.0, _TURRET, 200.0, motion=_GROUND, vy=0.0, drop=PickupKind.BOMB),
    # Jets dive, loop the loop and U-turn away, from both sides.
    *mirrored(
        column_formation(
            3560.0, _JET, 60.0, 3, 14.0, motion=_PATH, path="loop_back", pattern="aimed_slow"
        )
    ),
    # The third carrier, 1560 units (32 s) after the second.
    WaveEntry(3720.0, _CARRIER, 120.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
    # A tank column turns onto the crossing road, then a second column the other way.
    *column_formation(
        3800.0,
        _TANK,
        80.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
        drop=_MEDAL,
    ),
    *column_formation(
        3920.0,
        _TANK,
        160.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
        mirror=True,
    ),
    # Strafing runs from both edges close the section before the mid-boss.
    *column_formation(3960.0, _JET, -12.0, 3, 14.0, motion=_PATH, path="strafe", y=50.0),
    *column_formation(
        3990.0, _JET, 252.0, 3, 14.0, motion=_PATH, path="strafe", y=100.0, mirror=True
    ),
    # The mid-boss lull: nothing spawns from the marker for MIDBOSS_LULL units.
    # A deep S of five jets, the screen fills again.
    *v_formation(
        _RESUME_AT + 40.0,
        _JET,
        120.0,
        5,
        30.0,
        12.0,
        motion=_PATH,
        path="s_dive",
        pattern="aimed_slow",
    ),
    # Helicopters arc in from both sides, a turret on the roof between them.
    *mirrored(
        (
            WaveEntry(
                _RESUME_AT + 240.0,
                _HELI,
                30.0,
                y=-14.0,
                motion=_PATH,
                path="hover_arc",
                pattern="heli_ring",
            ),
        )
    ),
    WaveEntry(_RESUME_AT + 260.0, _TURRET, 120.0, motion=_GROUND, vy=0.0),
    # Tanks down the right road, another column bending off the left one.
    *column_formation(
        _RESUME_AT + 420.0,
        _TANK,
        160.0,
        4,
        36.0,
        motion=_PATH,
        path="road_down",
        pattern="aimed_slow",
    ),
    *column_formation(
        _RESUME_AT + 480.0,
        _TANK,
        80.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
    ),
    *mirrored(
        column_formation(
            _RESUME_AT + 580.0,
            _JET,
            60.0,
            3,
            14.0,
            motion=_PATH,
            path="loop_back",
            pattern="aimed_slow",
        )
    ),
    # The fourth carrier, 1620 units (34 s) after the third.
    WaveEntry(5340.0, _CARRIER, 170.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
    *column_formation(5480.0, _JET, -12.0, 3, 14.0, motion=_PATH, path="strafe", y=70.0),
    # A rooftop turret group; the middle one guards a bomb.
    WaveEntry(5640.0, _TURRET, 40.0, motion=_GROUND, vy=0.0, pattern="stream3"),
    WaveEntry(5660.0, _TURRET, 120.0, motion=_GROUND, vy=0.0, drop=PickupKind.BOMB),
    WaveEntry(5680.0, _TURRET, 200.0, motion=_GROUND, vy=0.0, pattern="stream3"),
    *mirrored(
        v_formation(
            5800.0, _JET, 50.0, 3, 24.0, 12.0, motion=_PATH, path="swoop", pattern="aimed_slow"
        )
    ),
    *line_formation(
        6000.0, _HELI, 90.0, 3, 50.0, y=-14.0, motion=_PATH, path="hover_arc", pattern="aimed_slow"
    ),
    *column_formation(
        6200.0, _TANK, 80.0, 4, 36.0, motion=_PATH, path="road_down", pattern="aimed_slow"
    ),
    *column_formation(
        6320.0,
        _TANK,
        160.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
        mirror=True,
    ),
    *mirrored(
        column_formation(
            6420.0, _JET, 60.0, 2, 14.0, motion=_PATH, path="loop_back", pattern="aimed_slow"
        )
    ),
)

_AIRBASE: Final = (
    # Strafing runs low across the apron from both edges.
    *column_formation(
        6560.0, _JET, -12.0, 4, 12.0, motion=_PATH, path="strafe", y=40.0, pattern="aimed_slow"
    ),
    *column_formation(
        6600.0,
        _JET,
        252.0,
        4,
        12.0,
        motion=_PATH,
        path="strafe",
        y=90.0,
        pattern="aimed_slow",
        mirror=True,
    ),
    # A heavy turret group guards the hangars.
    *line_formation(6700.0, _TURRET, 120.0, 4, 50.0, motion=_GROUND, vy=0.0, pattern="stream3"),
    WaveEntry(6780.0, _TURRET, 120.0, motion=_GROUND, vy=0.0, drop=PickupKind.BOMB),
    *mirrored(
        (
            WaveEntry(
                6840.0, _HELI, 30.0, y=-14.0, motion=_PATH, path="hover_arc", pattern="ring10_slow"
            ),
        )
    ),
    # The fifth and last carrier, 1620 units (34 s) after the fourth.
    WaveEntry(6960.0, _CARRIER, 120.0, y=-18.0, motion=_SWAY, vy=0.5, drop=PickupKind.CRYSTAL),
    *mirrored(
        v_formation(
            7060.0, _JET, 50.0, 3, 24.0, 12.0, motion=_PATH, path="swoop", pattern="aimed_slow"
        )
    ),
    *column_formation(
        7240.0,
        _TANK,
        80.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
        drop=_MEDAL,
    ),
    *column_formation(
        7380.0,
        _TANK,
        160.0,
        3,
        40.0,
        motion=_PATH,
        path="road_bend",
        pattern="aimed_slow",
        mirror=True,
    ),
    *mirrored(
        column_formation(
            7420.0, _JET, 60.0, 3, 14.0, motion=_PATH, path="loop_back", pattern="aimed_slow"
        )
    ),
    *line_formation(
        7560.0, _HELI, 90.0, 3, 50.0, y=-14.0, motion=_PATH, path="hover_arc", pattern="aimed_slow"
    ),
    *line_formation(
        7700.0, _TURRET, 120.0, 3, 80.0, motion=_GROUND, vy=0.0, pattern="stream3", drop=_MEDAL
    ),
    *column_formation(7800.0, _JET, -12.0, 4, 12.0, motion=_PATH, path="strafe", y=60.0),
    *column_formation(
        7860.0, _JET, 252.0, 4, 12.0, motion=_PATH, path="strafe", y=110.0, mirror=True
    ),
    *column_formation(
        8080.0, _TANK, 80.0, 4, 36.0, motion=_PATH, path="road_down", pattern="aimed_slow"
    ),
    *line_formation(
        7980.0, _JET, 120.0, 5, 36.0, motion=_PATH, path="s_dive", pattern="aimed_slow"
    ),
    *mirrored(
        (
            WaveEntry(
                8120.0, _HELI, 30.0, y=-14.0, motion=_PATH, path="hover_arc", pattern="heli_ring"
            ),
        )
    ),
    # The last jets swoop in; then the apron goes quiet for the bomber.
    *mirrored(
        v_formation(
            _LAST_WAVE_AT - 100.0,
            _JET,
            50.0,
            3,
            24.0,
            12.0,
            motion=_PATH,
            path="swoop",
            pattern="aimed_slow",
        )
    ),
)

_LENGTH: Final = _BOSS_AT + 660.0

type _Grid = tuple[int, int]  # lot columns x lot rows of one block


_CITY_FEATURES: Final = (
    # The elevated maglev line along x = 120, through downtown and across the mid-boss marker
    # (D-02, D-35): the mid-boss runs on it.
    CityFeature(SceneryKind.MAGLEV, 120.0, _MIDBOSS_AT - 700.0, _MIDBOSS_AT + 1100.0, 40.0),
    # Runway edge lights down the airbase, past the boss marker where the bomber arrives.
    CityFeature(SceneryKind.RUNWAY_LIGHT, 108.0, 7600.0, _LENGTH, 40.0),
    CityFeature(SceneryKind.RUNWAY_LIGHT, 132.0, 7600.0, _LENGTH, 40.0),
)


def _on_a_feature(col: int, d: float) -> bool:
    """True when the block at column ``col``, row ``d`` overlaps a feature line's corridor.

    Lots there are not built (the maglev and the runway lights own the strip), so the block
    holds no target either.
    """
    inset = (CITY_PITCH - CITY_BLOCK) / 2
    x_low = CITY_PITCH * col + inset
    d_low = d + inset
    return any(
        feature.x + CITY_CORRIDOR_HALF > x_low
        and feature.x - CITY_CORRIDOR_HALF < x_low + CITY_BLOCK
        and feature.d1 > d_low
        and feature.d0 < d_low + CITY_BLOCK
        for feature in _CITY_FEATURES
    )


def _section(  # noqa: PLR0913 - one keyword per authored property of a city section
    style: CityStyle,
    start: float,
    stop: float,
    grids: tuple[tuple[_Grid, ...], ...],
    *,
    fire_every: int,
    signs: int,
    sign_every: int,
    target_every: int,
    target_kinds: tuple[EnemyKind, ...],
) -> tuple[CityBlock, ...]:
    """The block rows of one section, in the three playfield columns.

    Rows start at the first road-grid row at or after ``start`` and stop before ``stop``. Column
    ``c`` cycles through ``grids[c]`` row by row; every ``fire_every``-th block (counting rows
    and columns together) burns one lot and every ``sign_every``-th hangs ``signs`` neon signs.
    Every ``target_every``-th block flags its middle lot as a target (the kinds cycle through
    ``target_kinds``, the drops through ``_TARGET_DROPS``), unless a feature line crosses the block
    or it lies in the quiet before the boss (``BOSS_QUIET``): the boss room holds no targets.
    """
    first = math.ceil(start / CITY_PITCH) * CITY_PITCH
    blocks: list[CityBlock] = []
    flagged = 0
    for index, d in enumerate(range(int(first), int(stop), int(CITY_PITCH))):
        for col, options in enumerate(grids):
            step = index + col
            cols, rows = options[step % len(options)]
            targets: tuple[tuple[int, EnemyKind, PickupKind | None], ...] = ()
            if (
                step % target_every == 0
                and d + CITY_PITCH <= _LAST_WAVE_AT
                and not _on_a_feature(col, float(d))
            ):
                lot = (rows // 2) * cols + cols // 2  # the lot nearest the block centre
                kind = target_kinds[flagged % len(target_kinds)]
                targets = ((lot, kind, _TARGET_DROPS[flagged % len(_TARGET_DROPS)]),)
                flagged += 1
            blocks.append(
                CityBlock(
                    d=float(d),
                    col=col,
                    cols=cols,
                    rows=rows,
                    style=style,
                    seed=int(style) * 1000 + index * 3 + col,
                    fires=1 if step % fire_every == 0 else 0,
                    signs=signs if step % sign_every == 0 else 0,
                    targets=targets,
                )
            )
    return tuple(blocks)


_CITY: Final = (
    # Dark low-rise slums; the odd lamp and a sparse neon sign.
    *_section(
        CityStyle.SLUMS,
        0.0,
        DOWNTOWN_AT,
        (((3, 2), (2, 2)), ((2, 2), (2, 3)), ((3, 2), (2, 3))),
        fire_every=5,
        signs=1,
        sign_every=8,
        target_every=7,
        target_kinds=(_HOUSE, _FUEL_TANK),
    ),
    # Dense neon downtown: towers and signs everywhere. The middle column keeps three lot columns
    # so the maglev corridor only costs it the middle one.
    *_section(
        CityStyle.DOWNTOWN,
        DOWNTOWN_AT,
        AIRBASE_AT,
        (((2, 2), (2, 3)), ((3, 2), (3, 3)), ((2, 2), (3, 2))),
        fire_every=6,
        signs=2,
        sign_every=1,
        target_every=6,
        target_kinds=(_BILLBOARD, _DEPOT),
    ),
    # The lit airbase: hangars beside the runway.
    *_section(
        CityStyle.AIRBASE,
        AIRBASE_AT,
        _LENGTH,
        (((2, 2), (1, 2)), ((2, 1), (2, 2)), ((1, 2), (2, 1))),
        fire_every=5,
        signs=1,
        sign_every=12,
        target_every=6,
        target_kinds=(_FUEL_TANK, _DEPOT),
    ),
)

STAGE_1: Final = StageData(
    number=1,
    length=_LENGTH,
    waves=tuple(sorted(_SLUMS + _DOWNTOWN + _AIRBASE, key=lambda wave: wave.at)),
    markers=(("midboss", _MIDBOSS_AT), ("boss", _BOSS_AT)),
    city=_CITY,
    features=_CITY_FEATURES,
    seed=1,
    ground=target_entries(_CITY),
    midboss=MIDBOSS_1,
)
