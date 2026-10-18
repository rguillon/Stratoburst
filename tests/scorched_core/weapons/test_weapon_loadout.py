from scorched_core.tuning import DEATH_LEVEL_PENALTY, MAX_LEVEL
from scorched_core.weapons.pickup_outcome import PickupOutcome
from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_core.weapons.weapon_loadout import WeaponLoadout


def test_a_new_loadout_is_the_vulcan_at_level_one() -> None:
    loadout = WeaponLoadout()
    assert loadout.kind is WeaponKind.VULCAN
    assert loadout.level == 1


def test_a_crystal_of_the_current_colour_raises_the_level_by_one() -> None:
    loadout = WeaponLoadout()
    assert loadout.collect(WeaponKind.VULCAN) is PickupOutcome.RAISED
    assert loadout.level == 2
    assert loadout.kind is WeaponKind.VULCAN


def test_the_level_climbs_to_five_and_no_further() -> None:
    loadout = WeaponLoadout()
    outcomes = [loadout.collect(WeaponKind.VULCAN) for _ in range(MAX_LEVEL + 2)]
    assert outcomes == [PickupOutcome.RAISED] * (MAX_LEVEL - 1) + [PickupOutcome.MAXED] * 3
    assert loadout.level == MAX_LEVEL


def test_a_same_colour_crystal_at_level_five_is_maxed_and_changes_nothing() -> None:
    loadout = WeaponLoadout(kind=WeaponKind.HOMING, level=5)
    assert loadout.collect(WeaponKind.HOMING) is PickupOutcome.MAXED
    assert (loadout.kind, loadout.level) == (WeaponKind.HOMING, 5)


def test_a_different_colour_switches_the_weapon_and_keeps_the_level() -> None:
    loadout = WeaponLoadout(kind=WeaponKind.VULCAN, level=4)
    assert loadout.collect(WeaponKind.LASER) is PickupOutcome.SWITCHED
    assert (loadout.kind, loadout.level) == (WeaponKind.LASER, 4)


def test_a_switch_keeps_the_level_even_at_level_one() -> None:
    loadout = WeaponLoadout()
    assert loadout.collect(WeaponKind.HOMING) is PickupOutcome.SWITCHED
    assert (loadout.kind, loadout.level) == (WeaponKind.HOMING, 1)


def test_a_switch_at_level_five_is_a_switch_not_maxed() -> None:
    loadout = WeaponLoadout(kind=WeaponKind.LASER, level=5)
    assert loadout.collect(WeaponKind.VULCAN) is PickupOutcome.SWITCHED
    assert (loadout.kind, loadout.level) == (WeaponKind.VULCAN, 5)


def test_a_death_costs_two_levels_and_keeps_the_kind_penalize() -> None:
    loadout = WeaponLoadout(kind=WeaponKind.LASER, level=5)
    loadout.penalize()
    assert (loadout.kind, loadout.level) == (WeaponKind.LASER, 3)


def test_a_death_at_level_four_leaves_level_two_penalize() -> None:
    loadout = WeaponLoadout(kind=WeaponKind.LASER, level=4)
    loadout.penalize()
    assert loadout.level == 2


def test_a_death_never_goes_below_level_one_penalize() -> None:
    low = WeaponLoadout(kind=WeaponKind.HOMING, level=2)
    low.penalize()
    floor = WeaponLoadout(kind=WeaponKind.HOMING, level=1)
    floor.penalize()
    assert (low.kind, low.level) == (WeaponKind.HOMING, 1)
    assert (floor.kind, floor.level) == (WeaponKind.HOMING, 1)


def test_the_death_penalty_is_two_levels_penalize() -> None:
    assert DEATH_LEVEL_PENALTY == 2
