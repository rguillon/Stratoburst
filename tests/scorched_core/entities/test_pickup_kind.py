from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.weapons.weapon_kind import WeaponKind


def test_the_pickup_values_are_the_wire_values() -> None:
    assert {kind.name: kind.value for kind in PickupKind} == {
        "RED": 0,
        "BLUE": 1,
        "PURPLE": 2,
        "CRYSTAL": 3,
        "BOMB": 4,
        "MEDAL": 5,
    }


def test_the_fixed_colours_share_their_values_with_the_weapons_they_select() -> None:
    assert PickupKind.RED == WeaponKind.VULCAN
    assert PickupKind.BLUE == WeaponKind.LASER
    assert PickupKind.PURPLE == WeaponKind.HOMING
