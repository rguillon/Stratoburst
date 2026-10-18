"""The kinds of scenery the city layout places on the ground."""

from enum import IntEnum


class SceneryKind(IntEnum):
    """Scenery types. Values only ever grow: they are stored in the layout and cross the boundary.

    ``MAGLEV`` and ``RUNWAY_LIGHT`` come from a ``CityFeature`` line, ``FIRE`` is a burning lot
    standing in for a building, ``SIGN`` a neon sign and ``LAMP`` a street lamp; the rest are the
    buildings of the three city styles.
    """

    SLUM_HOUSE = 0
    LOWRISE = 1
    TOWER = 2
    SIGN = 3
    MAGLEV = 4
    HANGAR = 5
    RUNWAY_LIGHT = 6
    FIRE = 7
    LAMP = 8
