from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.protocol import BLAST_LARGE, BLAST_MEDIUM, BLAST_SMALL
from scorched_core.tuning import (
    ENEMY_BLAST,
    ENEMY_GROUND,
    ENEMY_HP,
    ENEMY_RADIUS,
    GRID_CELL,
    PBULLET_RADIUS,
)


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


def test_every_per_kind_table_has_one_row_per_kind() -> None:
    for table in (ENEMY_RADIUS, ENEMY_HP, ENEMY_BLAST, ENEMY_GROUND):
        assert len(table) == len(EnemyKind)


def test_the_kind_tables_match_the_design_numbers() -> None:
    assert ENEMY_RADIUS == (9.0, 10.0, 14.0, 11.0, 10.0)
    assert ENEMY_HP == (3, 6, 12, 8, 6)
    assert ENEMY_BLAST == (BLAST_SMALL, BLAST_MEDIUM, BLAST_MEDIUM, BLAST_LARGE, BLAST_MEDIUM)


def test_only_tanks_and_turrets_are_ground_units() -> None:
    ground = {kind for kind in EnemyKind if ENEMY_GROUND[kind]}
    assert ground == {EnemyKind.TANK, EnemyKind.TURRET}


def test_every_enemy_plus_a_player_bolt_fits_in_one_grid_cell() -> None:
    # The 3x3 broadphase query only sees neighbouring cells, so a touching pair must be closer
    # than one cell edge.
    assert max(ENEMY_RADIUS) + PBULLET_RADIUS <= GRID_CELL


def test_a_hit_needs_at_least_one_bolt_and_every_hp_is_positive() -> None:
    assert all(hp > 0 for hp in ENEMY_HP)
    assert all(radius > 0 for radius in ENEMY_RADIUS)
