"""One-shot sound ids crossing the JS/Python boundary."""

from enum import IntEnum


class SfxId(IntEnum):
    """Every sound the game can make; the value is the SFX event's ``a`` payload.

    JS maps each name (published in the manifest) to a pre-rendered buffer. LASER_HUM is the
    looped beam sound that JS drives from the beam half-width in the header: it exists so the
    sound table covers it, and the router never emits it. Values are only ever appended: 18-27 are
    the stage-event sounds (the boss alarm, the extend chime, the tally tick and the rest).
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
    EXPLODE_HUGE = 18
    WARNING = 19
    EXTEND = 20
    MEDAL = 21
    PART_DESTROY = 22
    BOSS_PHASE = 23
    BOSS_DEFEAT = 24
    TALLY_TICK = 25
    STAGE_CLEAR = 26
    GAME_OVER = 27
