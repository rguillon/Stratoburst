"""One-shot sound ids crossing the JS/Python boundary."""

from enum import IntEnum


class SfxId(IntEnum):
    """Every sound the game can make; the value is the SFX event's ``a`` payload.

    JS maps each name (published in the manifest) to a pre-rendered buffer. LASER_HUM is the
    looped beam sound that JS drives from the beam half-width in the header: it exists so the
    sound table covers it, and the router never emits it.
    """

    EXPLODE_SMALL = 0
    EXPLODE_MEDIUM = 1
    EXPLODE_LARGE = 2
    VULCAN = 3
    MISSILE = 4
    HIT = 5
    WEAPON_UP = 6
    WEAPON_SWITCH = 7
    MAX = 8
    BOMB_PICKUP = 9
    BOMB_LAUNCH = 10
    BOMB_BLAST = 11
    PLAYER_HIT = 12
    DEATH = 13
    RESPAWN = 14
    DEATHBOMB = 15
    ENEMY_FIRE = 16
    LASER_HUM = 17
