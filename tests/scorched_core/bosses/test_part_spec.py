import dataclasses

import pytest

from scorched_core.bosses.part_spec import PartSpec
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.tuning import BOSS_MAX_RADIUS, ENEMY_RADIUS, GRID_CELL, MISSILE_RADIUS


def turret(**overrides: float) -> PartSpec:
    fields = {
        "kind": EnemyKind.TRAIN_TURRET,
        "dx": -20.0,
        "dy": 10.0,
        "hp": 120,
        "points": 1500,
        "stump_kind": EnemyKind.TRAIN_STUMP,
    }
    return PartSpec(**{**fields, **overrides})


def test_a_part_keeps_its_fields_and_defaults_to_the_kind_radius() -> None:
    part = turret()
    assert (part.kind, part.dx, part.dy, part.hp, part.points) == (
        EnemyKind.TRAIN_TURRET,
        -20.0,
        10.0,
        120,
        1500,
    )
    assert part.stump_kind == EnemyKind.TRAIN_STUMP
    assert part.radius is None
    assert part.effective_radius == ENEMY_RADIUS[EnemyKind.TRAIN_TURRET]


def test_an_explicit_radius_wins_over_the_kind_radius() -> None:
    assert turret(radius=14.0).effective_radius == 14.0


def test_a_part_is_frozen() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        turret().hp = 1  # type: ignore[misc]


def test_the_largest_legal_radius_leaves_room_for_the_larger_shot_inside_one_cell() -> None:
    assert BOSS_MAX_RADIUS == GRID_CELL - max(2.0, MISSILE_RADIUS) == 29.5
    assert turret(radius=BOSS_MAX_RADIUS).effective_radius == 29.5


def test_a_radius_above_the_grid_limit_is_rejected() -> None:
    with pytest.raises(ValueError, match="radius"):
        turret(radius=29.6)


def test_a_non_positive_radius_is_rejected() -> None:
    with pytest.raises(ValueError, match="radius"):
        turret(radius=0.0)


@pytest.mark.parametrize("hp", [0, -3])
def test_a_part_needs_at_least_one_hit_point(hp: int) -> None:
    with pytest.raises(ValueError, match="hp"):
        turret(hp=hp)


def test_a_part_cannot_pay_negative_points() -> None:
    with pytest.raises(ValueError, match="points"):
        turret(points=-1)
