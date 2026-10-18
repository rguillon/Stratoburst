from scorched_core.entities.enemy_kind import EnemyKind


def test_the_roster_values_are_the_wire_values() -> None:
    assert {kind.name: kind.value for kind in EnemyKind} == {
        "JET": 0,
        "HELI": 1,
        "CARRIER": 2,
        "TANK": 3,
        "TURRET": 4,
    }


def test_a_kind_is_usable_as_an_integer_index() -> None:
    table = ("a", "b", "c", "d", "e")
    assert table[EnemyKind.TANK] == "d"
