"""One row of a stage timeline: what spawns, where, and at which scroll distance."""

from dataclasses import dataclass

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind


@dataclass(frozen=True, slots=True)
class WaveEntry:
    """A single spawn: ``at`` is the stage-local scroll distance at which the row spawns (D-04).

    ``y`` is the spawn row (above the top edge by default) and ``vx`` / ``vy`` the velocity the
    motion model starts from. ``drop`` is the pickup a kill leaves, ``None`` for nothing.
    ``pattern`` names a bullet pattern, ``path`` a registered enemy path (the ``PATH`` motion
    follows it) and ``mirror`` flips that path's x offsets.
    """

    at: float
    kind: EnemyKind
    x: float
    y: float = -16.0
    motion: MotionKind = MotionKind.DIVE
    vx: float = 0.0
    vy: float = 2.0
    drop: PickupKind | None = None
    pattern: str | None = None
    path: str | None = None
    mirror: bool = False
