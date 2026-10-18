import pytest
from scorched_core.stages.formations import (
    column_formation,
    line_formation,
    mirrored,
    v_formation,
)

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.wave_entry import WaveEntry


def test_a_v_of_five_has_a_leader_and_two_pairs_of_wings_each_rank_later() -> None:
    rows = v_formation(100.0, EnemyKind.JET, 120.0, 5, 30.0, 12.0)
    assert [(row.at, row.x) for row in rows] == [
        (100.0, 120.0),
        (112.0, 90.0),
        (112.0, 150.0),
        (124.0, 60.0),
        (124.0, 180.0),
    ]


def test_a_v_is_centred_on_its_x() -> None:
    rows = v_formation(0.0, EnemyKind.JET, 100.0, 7, 20.0, 5.0)
    assert sum(row.x for row in rows) / len(rows) == pytest.approx(100.0)


def test_a_v_of_four_trails_one_extra_wing_on_the_left() -> None:
    rows = v_formation(0.0, EnemyKind.JET, 120.0, 4, 30.0, 10.0)
    assert [row.x for row in rows] == [120.0, 90.0, 150.0, 60.0]


def test_a_v_of_one_is_just_the_leader() -> None:
    rows = v_formation(7.0, EnemyKind.HELI, 80.0, 1, 30.0, 10.0)
    assert [(row.at, row.kind, row.x) for row in rows] == [(7.0, EnemyKind.HELI, 80.0)]


def test_a_v_is_ordered_by_at() -> None:
    ats = [row.at for row in v_formation(10.0, EnemyKind.JET, 120.0, 9, 20.0, 8.0)]
    assert ats == sorted(ats)


def test_a_line_spreads_rows_across_x_at_one_distance() -> None:
    rows = line_formation(50.0, EnemyKind.JET, 120.0, 4, 40.0)
    assert [row.x for row in rows] == [60.0, 100.0, 140.0, 180.0]
    assert {row.at for row in rows} == {50.0}


def test_a_line_of_one_sits_on_x() -> None:
    assert [row.x for row in line_formation(1.0, EnemyKind.TURRET, 90.0, 1, 40.0)] == [90.0]


def test_a_column_repeats_one_entry_a_gap_apart() -> None:
    rows = column_formation(10.0, EnemyKind.TANK, 80.0, 3, 30.0)
    assert [(row.at, row.x) for row in rows] == [(10.0, 80.0), (40.0, 80.0), (70.0, 80.0)]


def test_a_v_without_members_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least one member"):
        v_formation(0.0, EnemyKind.JET, 120.0, 0, 30.0, 10.0)


def test_a_line_without_members_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least one member"):
        line_formation(0.0, EnemyKind.JET, 120.0, 0, 30.0)


def test_a_column_without_members_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least one member"):
        column_formation(0.0, EnemyKind.TANK, 80.0, 0, 30.0)


def test_every_helper_returns_a_tuple_of_wave_entries() -> None:
    for rows in (
        v_formation(0.0, EnemyKind.JET, 120.0, 3, 30.0, 10.0),
        line_formation(0.0, EnemyKind.JET, 120.0, 3, 30.0),
        column_formation(0.0, EnemyKind.JET, 120.0, 3, 30.0),
        mirrored(column_formation(0.0, EnemyKind.JET, 60.0, 2, 30.0)),
    ):
        assert isinstance(rows, tuple)
        assert all(isinstance(row, WaveEntry) for row in rows)


EXTRA = {
    "motion": MotionKind.PATH,
    "path": "road_down",
    "pattern": "aimed_slow",
    "drop": PickupKind.BOMB,
    "y": -20.0,
    "vy": 0.0,
}


def assert_carries_extra_fields(rows: tuple[WaveEntry, ...]) -> None:
    assert len(rows) == 3
    for row in rows:
        assert row.kind == EnemyKind.TANK
        assert (row.motion, row.path, row.pattern) == (MotionKind.PATH, "road_down", "aimed_slow")
        assert (row.drop, row.y, row.vy) == (PickupKind.BOMB, -20.0, 0.0)


def test_extra_wave_fields_reach_every_member_of_a_v() -> None:
    assert_carries_extra_fields(v_formation(0.0, EnemyKind.TANK, 80.0, 3, 30.0, 10.0, **EXTRA))


def test_extra_wave_fields_reach_every_member_of_a_line() -> None:
    assert_carries_extra_fields(line_formation(0.0, EnemyKind.TANK, 80.0, 3, 30.0, **EXTRA))


def test_extra_wave_fields_reach_every_member_of_a_column() -> None:
    assert_carries_extra_fields(column_formation(0.0, EnemyKind.TANK, 80.0, 3, 30.0, **EXTRA))


def test_mirrored_returns_the_entries_then_their_reflections_about_the_field_centre() -> None:
    entry = WaveEntry(
        5.0, EnemyKind.JET, 60.0, motion=MotionKind.PATH, path="swoop", pattern="spread3"
    )
    rows = mirrored((entry,))
    assert rows[0] == entry
    assert len(rows) == 2
    reflected = rows[1]
    assert (reflected.at, reflected.x, reflected.mirror) == (5.0, 180.0, True)
    assert (reflected.kind, reflected.path, reflected.pattern) == (
        EnemyKind.JET,
        "swoop",
        "spread3",
    )


def test_mirroring_a_mirrored_entry_toggles_it_back() -> None:
    entry = WaveEntry(5.0, EnemyKind.JET, 200.0, mirror=True)
    assert mirrored((entry,))[1].mirror is False


def test_mirrored_negates_the_sideways_velocity() -> None:
    entry = WaveEntry(5.0, EnemyKind.JET, -12.0, y=60.0, vx=2.4, vy=0.9)
    reflected = mirrored((entry,))[1]
    assert (reflected.x, reflected.vx, reflected.vy, reflected.y) == (252.0, -2.4, 0.9, 60.0)


def test_mirrored_keeps_the_order_of_a_whole_formation() -> None:
    column = column_formation(0.0, EnemyKind.TANK, 80.0, 3, 30.0)
    rows = mirrored(column)
    assert rows[:3] == column
    assert [row.at for row in rows[3:]] == [0.0, 30.0, 60.0]
    assert {row.x for row in rows[3:]} == {160.0}
