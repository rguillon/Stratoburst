"""Expands the authored city (blocks and feature lines) into one flat placement list.

This is the single source of the city layout (RESEARCH Pattern 5): Python turns the data into
records of six floats (``protocol.CITY_STRIDE``: scenery kind, x, distance, width, height,
variant) from a seeded ``random.Random``, and JS only draws what the manifest hands it. It runs
once at import, so it allocates freely.
"""

import random
from collections.abc import Sequence
from typing import Final

from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.city_style import CityStyle
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.tuning import (
    CITY_BLOCK,
    CITY_CORRIDOR_HALF,
    CITY_MAX_HEIGHT,
    CITY_PITCH,
)

type Record = tuple[float, float, float, float, float, float]
type Corridor = tuple[float, float, float, float]  # x low, x high, distance from, distance to

NEON_HUES: Final = 6  # a sign's (and a tower's) variant picks one of this many neon hues
_INSET: Final = (CITY_PITCH - CITY_BLOCK) / 2  # the road half-width on each side of a block
_MARGIN_COLS: Final = (-2, -1, 3, 4)  # the blocks beyond the playfield that fill the screen edges
_LOT_FILL: Final = (0.7, 0.9)  # a building covers this share of its lot's shorter side
_TOWER_SHARE: Final = 0.5  # share of downtown buildings that are towers rather than low-rises
_LAMP_SHARE: Final = 0.3  # share of slum houses with a street lamp beside them
_SLUM_HEIGHT: Final = (4.0, 10.0)
_LOWRISE_HEIGHT: Final = (6.0, 12.0)
_TOWER_HEIGHT: Final = (12.0, CITY_MAX_HEIGHT)
_HANGAR_HEIGHT: Final = (8.0, 12.0)
_FIRE_HEIGHT: Final = (1.0, 3.0)
_FIRE_VARIANTS: Final = 3
_SIGN_WIDTH: Final = 2.0
_SIGN_HEIGHT_SHARE: Final = (0.5, 0.8)  # of the building it hangs on
_LAMP_WIDTH: Final = 1.0
_LAMP_HEIGHT: Final = 3.0
# Feature kind -> (width, height): the maglev track deck is elevated, runway lights are low.
_FEATURE_SHAPES: Final = {
    SceneryKind.MAGLEV: (6.0, 22.0),
    SceneryKind.RUNWAY_LIGHT: (1.5, 0.6),
}


def _record(  # noqa: PLR0913, PLR0917 - one argument per field of the stride-6 record
    kind: SceneryKind, x: float, d: float, width: float, height: float, variant: int
) -> Record:
    """Pack one placement: ``protocol.CITY_STRIDE`` floats."""
    return (float(kind), x, d, width, height, float(variant))


def _building(
    style: CityStyle, cell_w: float, cell_d: float, rng: random.Random
) -> tuple[SceneryKind, float, float, int]:
    """Pick a building of ``style`` for a lot: its kind, width, height and variant."""
    width = min(cell_w, cell_d) * rng.uniform(*_LOT_FILL)
    if style is CityStyle.SLUMS:
        return SceneryKind.SLUM_HOUSE, width, rng.uniform(*_SLUM_HEIGHT), rng.randrange(4)
    if style is CityStyle.DOWNTOWN:
        if rng.random() < _TOWER_SHARE:
            return SceneryKind.TOWER, width, rng.uniform(*_TOWER_HEIGHT), rng.randrange(NEON_HUES)
        return SceneryKind.LOWRISE, width, rng.uniform(*_LOWRISE_HEIGHT), rng.randrange(NEON_HUES)
    return SceneryKind.HANGAR, width, rng.uniform(*_HANGAR_HEIGHT), rng.randrange(2)


def _blocked(record: Record, corridors: Sequence[Corridor]) -> bool:
    """True when the building overlaps the corridor of a feature line."""
    _, x, d, width, _, _ = record
    half = width / 2
    return any(
        x - half < x_high and x + half > x_low and d - half < d_to and d + half > d_from
        for x_low, x_high, d_from, d_to in corridors
    )


def _signs(count: int, buildings: list[Record], cell_w: float, rng: random.Random) -> list[Record]:
    """Hang ``count`` neon signs on the side of buildings, towers first."""
    pool = list(buildings)
    rng.shuffle(pool)
    pool.sort(key=lambda lot: lot[0] != float(SceneryKind.TOWER))
    signs: list[Record] = []
    for lot in pool[:count]:
        side = rng.choice((-1.0, 1.0))
        x = lot[1] + side * (cell_w / 2 - _SIGN_WIDTH / 2)
        height = lot[4] * rng.uniform(*_SIGN_HEIGHT_SHARE)
        signs.append(
            _record(SceneryKind.SIGN, x, lot[2], _SIGN_WIDTH, height, rng.randrange(NEON_HUES))
        )
    return signs


def _block_records(block: CityBlock, seed: int, corridors: Sequence[Corridor]) -> list[Record]:
    """Every placement of one block: buildings, fires, lamps and signs."""
    rng = random.Random(seed ^ block.seed)  # noqa: S311 - scenery randomness, not security
    cell_w = CITY_BLOCK / block.cols
    cell_d = CITY_BLOCK / block.rows
    x0 = CITY_PITCH * block.col + _INSET
    d0 = block.d + _INSET
    lots: list[Record] = []
    for row in range(block.rows):
        for col in range(block.cols):
            kind, width, height, variant = _building(block.style, cell_w, cell_d, rng)
            lots.append(
                _record(
                    kind,
                    x0 + (col + 0.5) * cell_w,
                    d0 + (row + 0.5) * cell_d,
                    width,
                    height,
                    variant,
                )
            )
    burning = set(rng.sample(range(len(lots)), block.fires))
    placed: list[Record] = []
    buildings: list[Record] = []
    for index, lot in enumerate(lots):
        if _blocked(lot, corridors):
            continue
        if index in burning:
            fire = _record(
                SceneryKind.FIRE,
                lot[1],
                lot[2],
                lot[3],
                rng.uniform(*_FIRE_HEIGHT),
                rng.randrange(_FIRE_VARIANTS),
            )
            placed.append(fire)
            continue
        placed.append(lot)
        buildings.append(lot)
        if block.style is CityStyle.SLUMS and rng.random() < _LAMP_SHARE:
            x = lot[1] + cell_w / 2 - _LAMP_WIDTH / 2
            placed.append(_record(SceneryKind.LAMP, x, lot[2], _LAMP_WIDTH, _LAMP_HEIGHT, 0))
    placed.extend(_signs(block.signs, buildings, cell_w, rng))
    return placed


def _margin_records(
    blocks: Sequence[CityBlock], seed: int, corridors: Sequence[Corridor]
) -> list[Record]:
    """One large building per margin column for every authored block row, in that row's style."""
    styles: dict[float, CityStyle] = {}
    for block in sorted(blocks, key=lambda b: (b.d, b.col)):
        styles.setdefault(block.d, block.style)
    placed: list[Record] = []
    for d, style in styles.items():
        for col in _MARGIN_COLS:
            rng = random.Random(f"{seed}:{d}:{col}")  # noqa: S311 - scenery randomness
            kind, width, height, variant = _building(style, CITY_BLOCK, CITY_BLOCK, rng)
            record = _record(
                kind, CITY_PITCH * col + CITY_PITCH / 2, d + CITY_PITCH / 2, width, height, variant
            )
            if not _blocked(record, corridors):
                placed.append(record)
    return placed


def _feature_records(feature: CityFeature) -> list[Record]:
    """The placements of one feature line: one every ``spacing`` from ``d0`` to ``d1``."""
    shape = _FEATURE_SHAPES.get(feature.kind)
    if shape is None:
        msg = f"a city feature must be MAGLEV or RUNWAY_LIGHT, not {feature.kind.name}"
        raise ValueError(msg)
    width, height = shape
    count = int((feature.d1 - feature.d0) / feature.spacing + 1e-9) + 1
    alternate = feature.kind is SceneryKind.RUNWAY_LIGHT
    return [
        _record(
            feature.kind,
            feature.x,
            feature.d0 + i * feature.spacing,
            width,
            height,
            i % 2 if alternate else 0,
        )
        for i in range(count)
    ]


def scenery_placements(
    blocks: Sequence[CityBlock], features: Sequence[CityFeature], seed: int
) -> tuple[float, ...]:
    """Expand ``blocks`` and ``features`` into flat stride-6 records sorted by distance.

    The same inputs and ``seed`` always give the same tuple. Lots inside a feature's corridor are
    skipped, and margin blocks fill the columns beside the authored ones.
    """
    corridors = tuple(
        (f.x - CITY_CORRIDOR_HALF, f.x + CITY_CORRIDOR_HALF, f.d0, f.d1) for f in features
    )
    records: list[Record] = []
    for feature in features:
        records.extend(_feature_records(feature))
    for block in blocks:
        records.extend(_block_records(block, seed, corridors))
    records.extend(_margin_records(blocks, seed, corridors))
    records.sort(key=lambda record: (record[2], record[1], record[0]))
    return tuple(value for record in records for value in record)
