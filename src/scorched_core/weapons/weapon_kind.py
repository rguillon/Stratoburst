"""Weapon kinds, in crystal colour order, crossing the JS/Python boundary."""

from enum import IntEnum


class WeaponKind(IntEnum):
    """The three weapon types; each has its own crystal colour (red, blue, purple)."""

    VULCAN = 0
    LASER = 1
    HOMING = 2
