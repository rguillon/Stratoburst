import dataclasses

import pytest

from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_style import CityStyle


def block(**changes: int) -> CityBlock:
    fields = {"d": 0.0, "col": 0, "cols": 2, "rows": 2, "style": CityStyle.SLUMS, "seed": 1}
    return CityBlock(**{**fields, **changes})


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
