import dataclasses
import math

import pytest
from scorched_core.patterns.pattern_spec import PatternSpec

from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.tuning import ENEMY_FIRE_DELAY


def test_the_defaults_are_a_single_aimed_style_shot() -> None:
    spec = PatternSpec(FirePattern.AIMED)
    assert spec.shape is FirePattern.AIMED
    assert (spec.count, spec.speed, spec.interval, spec.delay) == (1, 1.6, 120, ENEMY_FIRE_DELAY)
    assert (spec.arc_deg, spec.aim_offset_deg, spec.phase_step_deg) == (0.0, 0.0, 0.0)
    assert (spec.burst, spec.burst_gap) == (1, 6)


def test_a_spec_is_frozen_and_slotted() -> None:
    spec = PatternSpec(FirePattern.AIMED)
    with pytest.raises(dataclasses.FrozenInstanceError):
        spec.speed = 9.0  # type: ignore[misc]
    assert not hasattr(spec, "__dict__")


def test_a_ring_and_a_spread_may_have_many_bullets() -> None:
    assert PatternSpec(FirePattern.RING, count=10).count == 10
    assert PatternSpec(FirePattern.SPREAD, count=5, arc_deg=70.0).count == 5


@pytest.mark.parametrize(
    ("kwargs", "match"),
    [
        ({"shape": FirePattern.NONE}, "shape"),
        ({"shape": FirePattern.RING, "count": 0}, "count"),
        ({"shape": FirePattern.AIMED, "count": 2}, "one bullet"),
        ({"shape": FirePattern.STREAM, "count": 3}, "one bullet"),
        ({"shape": FirePattern.AIMED, "speed": 0.0}, "speed"),
        ({"shape": FirePattern.AIMED, "speed": -1.0}, "speed"),
        ({"shape": FirePattern.AIMED, "speed": math.inf}, "speed"),
        ({"shape": FirePattern.AIMED, "speed": math.nan}, "speed"),
        ({"shape": FirePattern.AIMED, "interval": 0}, "interval"),
        ({"shape": FirePattern.AIMED, "delay": -1}, "delay"),
        ({"shape": FirePattern.STREAM, "burst": 0}, "burst"),
        ({"shape": FirePattern.STREAM, "burst": 2, "burst_gap": 0}, "burst_gap"),
        ({"shape": FirePattern.SPREAD, "count": 3, "arc_deg": math.inf}, "arc_deg"),
        ({"shape": FirePattern.AIMED, "aim_offset_deg": math.nan}, "aim_offset_deg"),
        ({"shape": FirePattern.RING, "count": 4, "phase_step_deg": math.inf}, "phase_step_deg"),
    ],
)
def test_a_bad_spec_is_rejected_when_it_is_built(kwargs: dict[str, object], match: str) -> None:
    with pytest.raises(ValueError, match=match):
        PatternSpec(**kwargs)  # type: ignore[arg-type]
