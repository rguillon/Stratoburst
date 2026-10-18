"""How an enemy kind shoots (D-17)."""

from enum import IntEnum


class FirePattern(IntEnum):
    """Enemy fire patterns (D-17). Values never change: they ride ENEMY_FIRE events as ``a``."""

    NONE = 0
    AIMED = 1
    RING = 2
    SPREAD = 3
    STREAM = 4
