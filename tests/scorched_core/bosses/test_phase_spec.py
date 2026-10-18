import dataclasses

import pytest
from scorched_core.bosses.emitter_spec import EmitterSpec
from scorched_core.bosses.phase_spec import PhaseSpec

from scorched_core.entities.enemy_kind import EnemyKind

GUN = (EmitterSpec("train_hull_spread"),)


def test_a_phase_defaults_to_no_sway_and_keeps_the_hull_kind() -> None:
    phase = PhaseSpec(1.0, GUN)
    assert phase.hp_frac == 1.0
    assert phase.emitters == GUN
    assert (phase.sway_x, phase.sway_y, phase.sway_period) == (0.0, 0.0, 240)
    assert phase.hull_kind is None


def test_a_phase_keeps_its_sway_and_hull_kind() -> None:
    phase = PhaseSpec(0.5, (), sway_x=12.0, sway_y=4.0, sway_period=90, hull_kind=EnemyKind.TRAIN)
    assert (phase.sway_x, phase.sway_y, phase.sway_period) == (12.0, 4.0, 90)
    assert phase.hull_kind == EnemyKind.TRAIN
    assert phase.emitters == ()


def test_a_phase_is_frozen() -> None:
    with pytest.raises(dataclasses.FrozenInstanceError):
        PhaseSpec(1.0, GUN).hp_frac = 0.5  # type: ignore[misc]


@pytest.mark.parametrize("hp_frac", [0.0, -0.1, 1.01])
def test_a_threshold_outside_zero_to_one_is_rejected(hp_frac: float) -> None:
    with pytest.raises(ValueError, match="hp_frac"):
        PhaseSpec(hp_frac, GUN)


def test_a_sway_period_below_one_step_is_rejected() -> None:
    with pytest.raises(ValueError, match="sway_period"):
        PhaseSpec(1.0, GUN, sway_period=0)
