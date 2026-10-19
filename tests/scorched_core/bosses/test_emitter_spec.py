import dataclasses

import pytest

from scorched_core.bosses.emitter_spec import EmitterSpec
from scorched_core.patterns.pattern_library import pattern_index


def test_an_emitter_defaults_to_the_hull_muzzle_with_no_offset() -> None:
    emitter = EmitterSpec("train_hull_spread")
    assert (emitter.pattern, emitter.part, emitter.dx, emitter.dy) == (
        "train_hull_spread",
        -1,
        0.0,
        0.0,
    )


def test_an_emitter_resolves_its_pattern_name_to_the_table_index_once() -> None:
    emitter = EmitterSpec("train_turret_aimed", part=1, dx=2.0, dy=-3.0)
    assert emitter.pattern_id == pattern_index("train_turret_aimed")
    assert (emitter.part, emitter.dx, emitter.dy) == (1, 2.0, -3.0)


def test_an_unknown_pattern_name_is_a_loud_error_naming_it() -> None:
    with pytest.raises(ValueError, match="no_such_pattern"):
        EmitterSpec("no_such_pattern")


def test_an_emitter_is_frozen() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        EmitterSpec("train_hull_spread").part = 0  # type: ignore[misc]
