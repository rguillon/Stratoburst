"""One terrain-anchored row of a stage: a building target that spawns where its lot is drawn."""

from dataclasses import dataclass

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.tuning import ENEMY_GROUND


@dataclass(frozen=True, slots=True)
class GroundEntry:
    """A ground unit at scroll distance ``at`` and logical ``x`` (D-04, RESEARCH Pattern 5).

    Unlike a ``WaveEntry`` it has no spawn row of its own: the director places it at the y where
    the city scenery drawn at distance ``at`` is, and it then scrolls with the terrain without
    any velocity. ``drop`` is the pickup its destruction leaves, ``None`` for nothing.
    """

    at: float
    kind: EnemyKind
    x: float
    drop: PickupKind | None = None

    def __post_init__(self) -> None:
        """Reject a kind that is not a ground unit: only the terrain carries these rows."""
        if not ENEMY_GROUND[self.kind]:
            msg = f"a ground entry needs a ground kind, got {self.kind.name}"
            raise ValueError(msg)
