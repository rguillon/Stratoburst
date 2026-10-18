import dataclasses

import pytest

from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.part_spec import PartSpec
from scorched_core.entities.enemy_kind import EnemyKind


def turret(dx: float = -20.0) -> PartSpec:
    return PartSpec(EnemyKind.TRAIN_TURRET, dx, 10.0, 120, 1500, EnemyKind.TRAIN_STUMP)


def make_spec(**overrides: object) -> BossSpec:
    fields: dict[str, object] = {
        "hull_kind": EnemyKind.TRAIN,
        "hull_hp": 500,
        "hull_radius": 28.0,
        "x": 120.0,
        "enter_y": -60.0,
        "hold_y": 80.0,
        "enter_speed": 2.0,
        "parts": (turret(-20.0), turret(20.0)),
        "timeout_ticks": 600,
        "kill_points": 20000,
        "death_ticks": 60,
    }
    return BossSpec(**{**fields, **overrides})  # type: ignore[arg-type]


def test_a_spec_keeps_its_fields() -> None:
    spec = make_spec()
    assert spec.hull_kind == EnemyKind.TRAIN
    assert (spec.hull_hp, spec.hull_radius, spec.x) == (500, 28.0, 120.0)
    assert (spec.enter_y, spec.hold_y, spec.enter_speed) == (-60.0, 80.0, 2.0)
    assert len(spec.parts) == 2
    assert (spec.timeout_ticks, spec.kill_points, spec.death_ticks) == (600, 20000, 60)


def test_a_spec_is_frozen() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        make_spec().hull_hp = 1  # type: ignore[misc]


def test_a_spec_with_no_parts_is_valid() -> None:
    assert make_spec(parts=()).parts == ()


def test_a_hull_radius_above_the_grid_limit_is_rejected() -> None:
    assert make_spec(hull_radius=29.5).hull_radius == 29.5
    with pytest.raises(ValueError, match="radius"):
        make_spec(hull_radius=29.6)


def test_a_non_positive_hull_radius_is_rejected() -> None:
    with pytest.raises(ValueError, match="radius"):
        make_spec(hull_radius=0.0)


def test_a_hold_line_above_the_start_line_is_rejected() -> None:
    assert make_spec(enter_y=80.0, hold_y=80.0).hold_y == 80.0
    with pytest.raises(ValueError, match="hold_y"):
        make_spec(enter_y=80.0, hold_y=79.0)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("hull_hp", 0),
        ("enter_speed", 0.0),
        ("timeout_ticks", 0),
        ("death_ticks", 0),
        ("kill_points", -1),
    ],
)
def test_a_spec_that_could_never_run_or_end_is_rejected(field: str, value: float) -> None:
    with pytest.raises(ValueError, match=field):
        make_spec(**{field: value})
