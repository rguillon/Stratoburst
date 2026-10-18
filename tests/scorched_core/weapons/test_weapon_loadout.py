from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_core.weapons.weapon_loadout import WeaponLoadout


def test_a_new_loadout_is_the_vulcan_at_level_one() -> None:
    loadout = WeaponLoadout()
    assert loadout.kind is WeaponKind.VULCAN
    assert loadout.level == 1
