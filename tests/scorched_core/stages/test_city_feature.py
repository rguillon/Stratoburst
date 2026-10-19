import dataclasses

import pytest

from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.scenery_kind import SceneryKind


def test_a_feature_is_a_frozen_line_of_scenery() -> None:
    feature = CityFeature(SceneryKind.MAGLEV, 120.0, 100.0, 500.0, 40.0)
    assert (feature.kind, feature.x, feature.d0, feature.d1, feature.spacing) == (
        SceneryKind.MAGLEV,
        120.0,
        100.0,
        500.0,
        40.0,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        feature.x = 1.0  # type: ignore[misc]


@pytest.mark.parametrize("d1", [100.0, 99.0])
def test_a_feature_that_does_not_run_forward_is_rejected(d1: float) -> None:
    with pytest.raises(ValueError, match="d1"):
        CityFeature(SceneryKind.MAGLEV, 120.0, 100.0, d1, 40.0)


@pytest.mark.parametrize("spacing", [0.0, -5.0])
def test_a_feature_with_no_positive_spacing_is_rejected(spacing: float) -> None:
    with pytest.raises(ValueError, match="spacing"):
        CityFeature(SceneryKind.MAGLEV, 120.0, 100.0, 500.0, spacing)
