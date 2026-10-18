from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.patterns.pattern_library import PATTERNS
from scorched_core.protocol import BLAST_LARGE, BLAST_MEDIUM, BLAST_SMALL
from scorched_core.tuning import (
    ENEMY_BLAST,
    ENEMY_GROUND,
    ENEMY_HP,
    ENEMY_PATTERN,
    ENEMY_POINTS,
    ENEMY_RADIUS,
    ENEMY_WRECK,
    GRID_CELL,
    HITSTOP_BOSS_TICKS,
    HITSTOP_PART_TICKS,
    MISSILE_RADIUS,
    PBULLET_RADIUS,
)

TRAIN_KINDS = (EnemyKind.TRAIN, EnemyKind.TRAIN_TURRET, EnemyKind.TRAIN_STUMP)
TARGET_KINDS = (EnemyKind.HOUSE, EnemyKind.FUEL_TANK, EnemyKind.DEPOT, EnemyKind.BILLBOARD)


def test_the_roster_values_are_the_wire_values() -> None:
    assert {kind.name: kind.value for kind in EnemyKind} == {
        "JET": 0,
        "HELI": 1,
        "CARRIER": 2,
        "TANK": 3,
        "TURRET": 4,
        "TRAIN": 5,
        "TRAIN_TURRET": 6,
        "TRAIN_STUMP": 7,
        "HOUSE": 8,
        "FUEL_TANK": 9,
        "DEPOT": 10,
        "BILLBOARD": 11,
    }


def test_a_kind_is_usable_as_an_integer_index() -> None:
    table = ("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l")
    assert table[EnemyKind.TANK] == "d"


def test_every_per_kind_table_has_one_row_per_kind() -> None:
    for table in (
        ENEMY_RADIUS,
        ENEMY_HP,
        ENEMY_BLAST,
        ENEMY_GROUND,
        ENEMY_PATTERN,
        ENEMY_POINTS,
        ENEMY_WRECK,
    ):
        assert len(table) == len(EnemyKind)


def test_the_kind_tables_match_the_design_numbers() -> None:
    assert ENEMY_RADIUS == (9.0, 10.0, 14.0, 11.0, 10.0, 28.0, 11.0, 6.0, 12.0, 11.0, 14.0, 12.0)
    assert ENEMY_HP == (3, 6, 12, 8, 6, 500, 120, 1, 8, 6, 16, 10)
    assert ENEMY_BLAST == (
        BLAST_SMALL,
        BLAST_MEDIUM,
        BLAST_MEDIUM,
        BLAST_LARGE,
        BLAST_MEDIUM,
        BLAST_LARGE,
        BLAST_MEDIUM,
        BLAST_SMALL,
        BLAST_MEDIUM,
        BLAST_LARGE,
        BLAST_LARGE,
        BLAST_MEDIUM,
    )


def test_tanks_turrets_the_train_and_the_four_targets_are_ground_units() -> None:
    ground = {kind for kind in EnemyKind if ENEMY_GROUND[kind]}
    assert ground == {
        EnemyKind.TANK,
        EnemyKind.TURRET,
        EnemyKind.TRAIN,
        EnemyKind.TRAIN_TURRET,
        EnemyKind.TRAIN_STUMP,
        *TARGET_KINDS,
    }


def test_every_enemy_plus_a_player_bolt_fits_in_one_grid_cell() -> None:
    # The 3x3 broadphase query only sees neighbouring cells, so a touching pair must be closer
    # than one cell edge.
    assert max(ENEMY_RADIUS) + PBULLET_RADIUS <= GRID_CELL


def test_every_enemy_plus_a_missile_fits_in_one_grid_cell() -> None:
    assert max(ENEMY_RADIUS) + MISSILE_RADIUS <= GRID_CELL


def test_a_hit_needs_at_least_one_bolt_and_every_hp_is_positive() -> None:
    assert all(hp > 0 for hp in ENEMY_HP)
    assert all(radius > 0 for radius in ENEMY_RADIUS)


def test_each_kind_names_its_default_pattern_and_the_carrier_has_none() -> None:
    assert ENEMY_PATTERN == (
        "jet_aimed",
        "heli_ring",
        None,
        "tank_aimed",
        "turret_aimed",
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    )
    assert ENEMY_PATTERN[EnemyKind.CARRIER] is None
    assert all(ENEMY_PATTERN[kind] is None for kind in (*TRAIN_KINDS, *TARGET_KINDS))
    assert all(name in PATTERNS for name in ENEMY_PATTERN if name is not None)


def test_each_kind_pays_fixed_points_with_no_multiplier() -> None:
    assert ENEMY_POINTS == (300, 800, 2000, 1000, 1200, 0, 0, 0, 500, 1500, 2000, 1000)
    assert ENEMY_POINTS[EnemyKind.JET] == 300
    assert ENEMY_POINTS[EnemyKind.TURRET] == 1200
    assert all(points > 0 for points in ENEMY_POINTS[: EnemyKind.TRAIN])
    assert all(ENEMY_POINTS[kind] == 0 for kind in TRAIN_KINDS)  # the controller pays the train
    assert all(ENEMY_POINTS[kind] > 0 for kind in TARGET_KINDS)


def test_the_four_target_kinds_are_tougher_than_a_tank_and_pay_by_their_size() -> None:
    assert [ENEMY_POINTS[kind] for kind in TARGET_KINDS] == [500, 1500, 2000, 1000]
    assert [ENEMY_RADIUS[kind] for kind in TARGET_KINDS] == [12.0, 11.0, 14.0, 12.0]
    assert [ENEMY_HP[kind] for kind in TARGET_KINDS] == [8, 6, 16, 10]


def test_which_kinds_leave_a_wreck_is_data_one_flag_per_kind() -> None:
    assert ENEMY_WRECK == (0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1)
    wrecked = {kind for kind in EnemyKind if ENEMY_WRECK[kind]}
    assert wrecked == {EnemyKind.TANK, EnemyKind.TURRET, EnemyKind.TRAIN, *TARGET_KINDS}
    assert not wrecked & {EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER}
    assert not wrecked & {EnemyKind.TRAIN_TURRET, EnemyKind.TRAIN_STUMP}


def test_the_train_hull_is_the_largest_row_and_still_fits_one_grid_cell() -> None:
    assert max(ENEMY_RADIUS) == ENEMY_RADIUS[EnemyKind.TRAIN] == 28.0
    assert ENEMY_RADIUS[EnemyKind.TRAIN] + max(PBULLET_RADIUS, MISSILE_RADIUS) <= GRID_CELL


def test_the_boss_hitstop_lengths_are_the_d14_big_events() -> None:
    assert HITSTOP_PART_TICKS == 4
    assert HITSTOP_BOSS_TICKS == 8
    assert HITSTOP_PART_TICKS < HITSTOP_BOSS_TICKS
