import dataclasses

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.wave_entry import WaveEntry


def test_defaults_describe_a_jet_diving_in_from_above_the_top_edge() -> None:
    entry = WaveEntry(at=40.0, kind=EnemyKind.JET, x=120.0)
    assert entry.y == -16.0
    assert entry.motion == MotionKind.DIVE
    assert (entry.vx, entry.vy) == (0.0, 2.0)
    assert entry.drop is None


def test_every_field_can_be_overridden() -> None:
    entry = WaveEntry(
        at=600.0,
        kind=EnemyKind.CARRIER,
        x=120.0,
        y=-18.0,
        motion=MotionKind.SWAY,
        vx=0.1,
        vy=0.5,
        drop=PickupKind.CRYSTAL,
    )
    assert (entry.at, entry.kind, entry.x, entry.y) == (600.0, EnemyKind.CARRIER, 120.0, -18.0)
    assert (entry.motion, entry.vx, entry.vy) == (MotionKind.SWAY, 0.1, 0.5)
    assert entry.drop == PickupKind.CRYSTAL


def test_an_entry_is_frozen() -> None:
    entry = WaveEntry(at=0.0, kind=EnemyKind.JET, x=0.0)
    with pytest.raises(dataclasses.FrozenInstanceError):
        entry.at = 1.0  # type: ignore[misc]


def test_an_entry_is_slotted() -> None:
    assert not hasattr(WaveEntry(at=0.0, kind=EnemyKind.JET, x=0.0), "__dict__")
