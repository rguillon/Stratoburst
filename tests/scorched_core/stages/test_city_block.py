import dataclasses

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_style import CityStyle


def block(**changes: object) -> CityBlock:
    fields: dict[str, object] = {
        "d": 0.0,
        "col": 0,
        "cols": 2,
        "rows": 2,
        "style": CityStyle.SLUMS,
        "seed": 1,
    }
    return CityBlock(**{**fields, **changes})  # type: ignore[arg-type]


def test_a_block_defaults_to_no_fires_and_no_signs() -> None:
    made = block()
    assert (made.fires, made.signs) == (0, 0)


def test_a_block_is_frozen() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        block().d = 1.0  # type: ignore[misc]


@pytest.mark.parametrize("field", ["cols", "rows"])
@pytest.mark.parametrize("value", [0, 5, -1])
def test_a_lot_grid_outside_one_to_four_is_rejected(field: str, value: int) -> None:
    with pytest.raises(ValueError, match=field):
        block(**{field: value})


@pytest.mark.parametrize("value", [1, 4])
def test_the_grid_limits_themselves_are_valid(value: int) -> None:
    assert block(cols=value, rows=value).cols == value


def test_a_negative_distance_is_rejected() -> None:
    with pytest.raises(ValueError, match="distance"):
        block(d=-1.0)


def test_more_fires_than_lots_are_rejected() -> None:
    with pytest.raises(ValueError, match="fires"):
        block(cols=2, rows=1, fires=3)


def test_as_many_fires_as_lots_is_valid() -> None:
    assert block(cols=2, rows=1, fires=2).fires == 2


def test_negative_fires_and_signs_are_rejected() -> None:
    with pytest.raises(ValueError, match="fires"):
        block(fires=-1)
    with pytest.raises(ValueError, match="signs"):
        block(signs=-1)


def test_a_block_defaults_to_no_targets() -> None:
    assert block().targets == ()


def test_a_block_carries_its_targets() -> None:
    targets = ((0, EnemyKind.HOUSE, PickupKind.MEDAL), (3, EnemyKind.FUEL_TANK, None))
    assert block(cols=2, rows=2, targets=targets).targets == targets


@pytest.mark.parametrize(
    "kind", [EnemyKind.HOUSE, EnemyKind.FUEL_TANK, EnemyKind.DEPOT, EnemyKind.BILLBOARD]
)
def test_every_target_kind_is_valid(kind: EnemyKind) -> None:
    assert block(targets=((0, kind, None),)).targets == ((0, kind, None),)


@pytest.mark.parametrize("lot", [-1, 4])
def test_a_target_lot_outside_the_grid_is_rejected(lot: int) -> None:
    with pytest.raises(ValueError, match="lot"):
        block(cols=2, rows=2, targets=((lot, EnemyKind.HOUSE, None),))


def test_the_last_lot_of_the_grid_is_a_valid_target() -> None:
    assert block(cols=2, rows=2, targets=((3, EnemyKind.HOUSE, None),)).targets


def test_two_targets_on_one_lot_are_rejected() -> None:
    targets = ((1, EnemyKind.HOUSE, None), (1, EnemyKind.DEPOT, None))
    with pytest.raises(ValueError, match="twice"):
        block(targets=targets)


@pytest.mark.parametrize("kind", [EnemyKind.JET, EnemyKind.TANK, EnemyKind.TRAIN])
def test_a_kind_that_is_not_a_target_is_rejected(kind: EnemyKind) -> None:
    with pytest.raises(ValueError, match=kind.name):
        block(targets=((0, kind, None),))
