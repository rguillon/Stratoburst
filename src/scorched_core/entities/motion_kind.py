"""How a gallery enemy moves; the script picks one per enemy and the pool applies it."""

from enum import IntEnum


class MotionKind(IntEnum):
    """Motion models. Values never change: they are stored in the enemy pool's motion column."""

    SWAY = 0
    DIVE = 1
    HOVER = 2
    GROUND = 3
