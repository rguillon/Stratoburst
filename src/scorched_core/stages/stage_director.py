"""Drives a stage's timeline: spawns each entry once the terrain has scrolled to it (D-04)."""

from bisect import bisect_right
from dataclasses import dataclass, field

from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.stages.stage_data import StageData


@dataclass(slots=True)
class StageDirector:
    """A monotonic cursor over a stage's entries, keyed on scroll distance and never on ticks.

    The terrain advances by a float each step (0.8, or less during a crawl), so an entry is due
    when ``at <= distance``: an equality test would skip it whenever the sum steps over ``at``.
    Entries sharing an ``at`` spawn on the same step in declared order. An entry the pool refuses
    (the alive cap) is skipped, never queued.
    """

    stage: StageData
    _ats: tuple[float, ...] = field(
        init=False, repr=False
    )  # built once: nothing allocates per step
    cursor: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        self._ats = tuple(wave.at for wave in self.stage.waves)

    def step(self, distance: float, enemies: EnemyPool) -> int:
        """Spawn every entry due at ``distance``; return how many the pool accepted."""
        waves, ats = self.stage.waves, self._ats
        cursor, spawned = self.cursor, 0
        while cursor < len(waves) and ats[cursor] <= distance:
            wave = waves[cursor]
            drop = -1 if wave.drop is None else wave.drop
            if enemies.spawn(wave.kind, wave.x, wave.y, wave.motion, wave.vx, wave.vy, drop):
                spawned += 1
            cursor += 1
        self.cursor = cursor
        return spawned

    def jump(self, distance: float) -> None:
        """Skip every entry at or before ``distance`` (the ``?at=`` debug jump, D-30)."""
        self.cursor = bisect_right(self._ats, distance)

    def reset(self) -> None:
        """Return to the start of the stage."""
        self.cursor = 0
