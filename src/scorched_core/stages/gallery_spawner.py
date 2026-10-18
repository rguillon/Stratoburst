"""The shooting gallery's looping spawn script (D-17), a stand-in for the stage timeline."""

from dataclasses import dataclass, field

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.tuning import GALLERY_LOOP_TICKS, GALLERY_SCRIPT

type ScriptEntry = tuple[int, EnemyKind, float, float, float, float, int]


@dataclass(slots=True)
class GallerySpawner:
    """Spawns each ``(tick, kind, x, y, vx, vy, drop)`` entry on its tick and loops forever.

    The script is deterministic data, so the same inputs always give the same gallery. An
    entry the pool refuses (the alive cap) is skipped, never queued.
    """

    script: tuple[ScriptEntry, ...] = GALLERY_SCRIPT
    loop_ticks: int = GALLERY_LOOP_TICKS
    t: int = field(default=0, init=False)
    cursor: int = field(default=0, init=False)

    def step(self, enemies: EnemyPool) -> None:
        """Spawn the entries due this tick, then advance (wrapping at ``loop_ticks``)."""
        script = self.script
        while self.cursor < len(script) and script[self.cursor][0] == self.t:
            _, kind, x, y, vx, vy, drop = script[self.cursor]
            enemies.spawn(kind, x, y, vx, vy, drop)
            self.cursor += 1
        self.t += 1
        if self.t >= self.loop_ticks:
            self.t = 0
            self.cursor = 0
