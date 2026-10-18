"""A boss fight as frozen data (ENMY-06, ENMY-07, ENMY-09): a hull, its parts and the timings."""

from dataclasses import dataclass

from scorched_core.bosses.part_spec import PartSpec
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.tuning import BOSS_MAX_RADIUS


@dataclass(frozen=True, slots=True)
class BossSpec:
    """Everything a ``BossController`` needs to run one boss.

    The hull is one row of ``hull_kind`` with ``hull_hp`` and ``hull_radius`` at horizontal
    centre ``x``. It starts at ``enter_y`` (above the screen), descends ``enter_speed`` units per
    step to ``hold_y`` and fights from there. ``parts`` ride on it at fixed offsets.
    ``timeout_ticks`` counts fight steps (hitstop and pause freeze it) before the boss retreats,
    ``kill_points`` is what destroying the hull pays and ``death_ticks`` the length of its death
    sequence. Radii are limited to ``BOSS_MAX_RADIUS`` (RESEARCH Pitfall 2).
    """

    hull_kind: EnemyKind
    hull_hp: int
    hull_radius: float
    x: float
    enter_y: float
    hold_y: float
    enter_speed: float
    parts: tuple[PartSpec, ...]
    timeout_ticks: int
    kill_points: int
    death_ticks: int

    def __post_init__(self) -> None:
        """Reject a boss that could not be hit, placed in the grid, entered or ended."""
        if self.hull_hp < 1:
            msg = f"hull_hp must be at least 1, got {self.hull_hp}"
            raise ValueError(msg)
        if not 0.0 < self.hull_radius <= BOSS_MAX_RADIUS:
            msg = f"hull radius must be in (0, {BOSS_MAX_RADIUS}], got {self.hull_radius}"
            raise ValueError(msg)
        if self.hold_y < self.enter_y:
            msg = f"hold_y {self.hold_y} is above enter_y {self.enter_y}: the boss descends"
            raise ValueError(msg)
        if self.enter_speed <= 0.0:
            msg = f"enter_speed must be positive, got {self.enter_speed}"
            raise ValueError(msg)
        if self.timeout_ticks < 1:
            msg = f"timeout_ticks must be at least 1, got {self.timeout_ticks}"
            raise ValueError(msg)
        if self.death_ticks < 1:
            msg = f"death_ticks must be at least 1, got {self.death_ticks}"
            raise ValueError(msg)
        if self.kill_points < 0:
            msg = f"kill_points cannot be negative, got {self.kill_points}"
            raise ValueError(msg)
