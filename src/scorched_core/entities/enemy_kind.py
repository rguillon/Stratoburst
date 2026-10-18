"""The gallery's enemy roster; values index the per-kind tuning tables."""

from enum import IntEnum


class EnemyKind(IntEnum):
    """Enemy types. Values never change: they index ``ENEMY_*`` tuples and cross the boundary."""

    JET = 0
    HELI = 1
    CARRIER = 2
    TANK = 3
    TURRET = 4
