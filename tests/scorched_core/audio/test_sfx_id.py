from scorched_core.audio.sfx_id import SfxId


def test_sfx_ids_are_contiguous_from_zero_and_never_renumbered() -> None:
    assert {sfx.name: sfx.value for sfx in SfxId} == {
        "EXPLODE_SMALL": 0,
        "EXPLODE_MEDIUM": 1,
        "EXPLODE_LARGE": 2,
        "VULCAN": 3,
        "MISSILE": 4,
        "HIT": 5,
        "WEAPON_UP": 6,
        "WEAPON_SWITCH": 7,
        "MAX": 8,
        "BOMB_PICKUP": 9,
        "BOMB_LAUNCH": 10,
        "BOMB_BLAST": 11,
        "PLAYER_HIT": 12,
        "DEATH": 13,
        "RESPAWN": 14,
        "DEATHBOMB": 15,
        "ENEMY_FIRE": 16,
        "LASER_HUM": 17,
        "EXPLODE_HUGE": 18,
        "WARNING": 19,
        "EXTEND": 20,
        "MEDAL": 21,
        "PART_DESTROY": 22,
        "BOSS_PHASE": 23,
        "BOSS_DEFEAT": 24,
        "TALLY_TICK": 25,
        "STAGE_CLEAR": 26,
        "GAME_OVER": 27,
    }
