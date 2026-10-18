"""The phases of a bomb, published to JS by name through the manifest."""

from enum import IntEnum


class BombPhase(IntEnum):
    """No bomb, the missile rising, or the fireball burning."""

    NONE = 0
    LAUNCH = 1
    BLAST = 2
