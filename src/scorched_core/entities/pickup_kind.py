"""The pickups a destroyed enemy or a recovery drop can leave behind."""

from enum import IntEnum


class PickupKind(IntEnum):
    """Pickup types. Values never change: they are stored in the pools and cross the boundary.

    RED, BLUE and PURPLE are fixed-colour recovery pickups (plan 02-25) whose value equals the
    ``WeaponKind`` they select; CRYSTAL cycles through those colours; BOMB stocks a bomb.
    """

    RED = 0
    BLUE = 1
    PURPLE = 2
    CRYSTAL = 3
    BOMB = 4
