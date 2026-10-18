from scorched_core.weapons.weapon_kind import WeaponKind


def test_weapon_kinds_follow_the_crystal_colour_order() -> None:
    assert [(kind.name, kind.value) for kind in WeaponKind] == [
        ("VULCAN", 0),
        ("LASER", 1),
        ("HOMING", 2),
    ]
