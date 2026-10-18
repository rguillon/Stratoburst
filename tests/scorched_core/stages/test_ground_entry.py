import dataclasses

import pytest
from scorched_core.stages.ground_entry import GroundEntry

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind


def test_an_entry_defaults_to_no_drop() -> None:
    entry = GroundEntry(at=120.0, kind=EnemyKind.HOUSE, x=40.0)
    assert (entry.at, entry.kind, entry.x, entry.drop) == (120.0, EnemyKind.HOUSE, 40.0, None)


def test_an_entry_carries_its_drop() -> None:
    entry = GroundEntry(at=120.0, kind=EnemyKind.DEPOT, x=40.0, drop=PickupKind.MEDAL)
    assert entry.drop == PickupKind.MEDAL


def test_an_entry_is_frozen() -> None:
    entry = GroundEntry(at=1.0, kind=EnemyKind.TANK, x=1.0)
    with pytest.raises(dataclasses.FrozenInstanceError):
        entry.at = 2.0  # type: ignore[misc]


@pytest.mark.parametrize("kind", [EnemyKind.TANK, EnemyKind.TURRET, EnemyKind.BILLBOARD])
def test_a_ground_kind_is_accepted(kind: EnemyKind) -> None:
    assert GroundEntry(at=1.0, kind=kind, x=1.0).kind == kind


@pytest.mark.parametrize("kind", [EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER])
def test_an_air_kind_is_rejected(kind: EnemyKind) -> None:
    with pytest.raises(ValueError, match=kind.name):
        GroundEntry(at=1.0, kind=kind, x=1.0)
