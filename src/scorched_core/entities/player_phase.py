"""Where the player's ship is in its life cycle."""

from enum import IntEnum


class PlayerPhase(IntEnum):
    """Life phases. Values never change: later plans report them across the boundary."""

    ALIVE = 0
    GRACE = 1
    DYING = 2
    RESPAWN = 3
    OUT = 4  # terminal: the last ship is gone and no other flies in
