import pytest
from scorched_core.patterns.pattern_library import (
    PATTERN_NAMES,
    PATTERN_TABLE,
    PATTERNS,
    pattern_index,
)
from scorched_core.patterns.pattern_spec import PatternSpec

from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.tuning import ENEMY_FIRE_DELAY


def test_the_four_kind_defaults_reproduce_the_phase_two_numbers() -> None:
    assert PATTERNS["jet_aimed"] == PatternSpec(FirePattern.AIMED, speed=2.0, interval=140)
    assert PATTERNS["heli_ring"] == PatternSpec(
        FirePattern.RING, count=8, speed=1.3, interval=150, phase_step_deg=22.5
    )
    assert PATTERNS["tank_aimed"] == PatternSpec(FirePattern.AIMED, speed=1.6, interval=120)
    assert PATTERNS["turret_aimed"] == PatternSpec(FirePattern.AIMED, speed=1.8, interval=90)
    for name in ("jet_aimed", "heli_ring", "tank_aimed", "turret_aimed"):
        assert PATTERNS[name].delay == ENEMY_FIRE_DELAY == 45


def test_the_stage_patterns_are_registered() -> None:
    assert {"aimed_slow", "spread3", "spread5", "ring10_slow", "stream3"} <= set(PATTERNS)
    assert PATTERNS["spread3"].shape is FirePattern.SPREAD
    assert PATTERNS["spread3"].count == 3
    assert PATTERNS["spread5"].count == 5
    assert PATTERNS["ring10_slow"].shape is FirePattern.RING
    assert PATTERNS["ring10_slow"].count == 10
    assert PATTERNS["stream3"].shape is FirePattern.STREAM
    assert PATTERNS["stream3"].burst == 3


def test_names_and_table_follow_the_registry_in_one_fixed_order() -> None:
    assert tuple(PATTERNS) == PATTERN_NAMES
    assert tuple(PATTERNS.values()) == PATTERN_TABLE
    assert len(set(PATTERN_NAMES)) == len(PATTERN_NAMES)


def test_pattern_index_is_the_position_in_the_table() -> None:
    for position, name in enumerate(PATTERN_NAMES):
        assert pattern_index(name) == position
        assert PATTERN_TABLE[pattern_index(name)] is PATTERNS[name]


def test_an_unknown_pattern_name_raises_naming_it() -> None:
    with pytest.raises(ValueError, match="nope"):
        pattern_index("nope")
