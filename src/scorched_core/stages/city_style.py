"""The look of a city block: which buildings it grows and how tall they stand."""

from enum import IntEnum


class CityStyle(IntEnum):
    """Block styles of stage 1's arc (D-35): slums, neon downtown, then the airbase."""

    SLUMS = 0
    DOWNTOWN = 1
    AIRBASE = 2
