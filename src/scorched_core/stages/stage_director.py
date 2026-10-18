"""Drives a stage's timeline: spawns each entry once the terrain has scrolled to it (D-04)."""

from dataclasses import dataclass, field

from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.stages.stage_data import StageData


@dataclass(slots=True)
class StageDirector:
    """Cursor over a stage's sorted entries."""

    stage: StageData
    cursor: int = field(default=0, init=False)

    def step(self, distance: float, enemies: EnemyPool) -> int:
        """Spawn the entries due at ``distance``; return how many were spawned."""
        del distance, enemies
        return 0

    def jump(self, distance: float) -> None:
        """Skip every entry at or before ``distance``."""
        raise NotImplementedError(distance)

    def reset(self) -> None:
        """Return to the start of the stage."""
        raise NotImplementedError
