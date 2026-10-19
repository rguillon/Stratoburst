"""Drives a stage's timeline: spawns each entry once the terrain has scrolled to it (D-04)."""

from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field
from typing import Final

from scorched_core.entities.motion_kind import MotionKind
from scorched_core.paths.path_library import path_index
from scorched_core.patterns.pattern_library import pattern_index
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import PLAYFIELD_H
from scorched_core.stages.stage_data import StageData
from scorched_core.tuning import GROUND_SCROLL_RATIO, GROUND_Y0

# How far past a ground entry's distance the scroll can be before its row has left the bottom of
# the playfield: a debug jump keeps every entry closer than this, so the targets that should be on
# screen at the jump are still spawned (aligned with their blocks) rather than missing.
_GROUND_VISIBLE_SPAN: Final = (PLAYFIELD_H - GROUND_Y0) / GROUND_SCROLL_RATIO


@dataclass(slots=True)
class StageDirector:
    """A monotonic cursor over a stage's entries, keyed on scroll distance and never on ticks.

    The terrain advances by a float each step (0.8, or less during a crawl), so an entry is due
    when ``at <= distance``: an equality test would skip it whenever the sum steps over ``at``.
    Entries sharing an ``at`` spawn on the same step in declared order. A wave's pattern name and
    path name are resolved to registry indices once, in ``__post_init__``. An entry the pool
    refuses (the alive cap) is skipped, never queued.

    ``stage.ground`` (the city's destructible targets) has its own cursor. A ground entry spawns
    as a terrain-anchored ``GROUND`` row with no velocity at the y where the scenery of its
    distance is drawn, ``GROUND_Y0 + GROUND_SCROLL_RATIO * (distance - at)``, so it is glued to
    its block however late the step that spawns it (RESEARCH Pattern 5).
    """

    stage: StageData
    _ats: tuple[float, ...] = field(
        init=False, repr=False
    )  # built once: nothing allocates per step
    _patterns: tuple[int | None, ...] = field(init=False, repr=False)  # names resolved once
    _paths: tuple[int, ...] = field(init=False, repr=False)  # -1 where a wave has no path
    _flips: tuple[int, ...] = field(init=False, repr=False)  # -1 for a mirrored path
    _ground_ats: tuple[float, ...] = field(init=False, repr=False)
    cursor: int = field(default=0, init=False)
    ground_cursor: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        self._ground_ats = tuple(entry.at for entry in self.stage.ground)
        self._ats = tuple(wave.at for wave in self.stage.waves)
        self._patterns = tuple(
            None if wave.pattern is None else pattern_index(wave.pattern)
            for wave in self.stage.waves
        )
        self._paths = tuple(
            -1 if wave.path is None else path_index(wave.path) for wave in self.stage.waves
        )
        self._flips = tuple(-1 if wave.mirror else 1 for wave in self.stage.waves)

    def step(self, distance: float, enemies: EnemyPool) -> int:
        """Spawn every entry due at ``distance``; return how many the pool accepted."""
        waves, ats, patterns = self.stage.waves, self._ats, self._patterns
        paths, flips = self._paths, self._flips
        cursor, spawned = self.cursor, 0
        while cursor < len(waves) and ats[cursor] <= distance:
            wave = waves[cursor]
            drop = -1 if wave.drop is None else wave.drop
            if enemies.spawn(
                wave.kind,
                wave.x,
                wave.y,
                wave.motion,
                wave.vx,
                wave.vy,
                drop,
                pattern=patterns[cursor],
                path=paths[cursor],
                flip=flips[cursor],
            ):
                spawned += 1
            cursor += 1
        self.cursor = cursor
        ground, ground_ats = self.stage.ground, self._ground_ats
        cursor = self.ground_cursor
        while cursor < len(ground) and ground_ats[cursor] <= distance:
            entry = ground[cursor]
            if enemies.spawn(
                entry.kind,
                entry.x,
                GROUND_Y0 + GROUND_SCROLL_RATIO * (distance - entry.at),
                MotionKind.GROUND,
                0.0,
                0.0,
                -1 if entry.drop is None else entry.drop,
            ):
                spawned += 1
            cursor += 1
        self.ground_cursor = cursor
        return spawned

    def jump(self, distance: float) -> None:
        """Skip every wave at or before ``distance`` (the ``?at=`` debug jump, D-30).

        A ground entry is only skipped once it has scrolled off the bottom: those still on screen
        at ``distance`` spawn on the next step, where their blocks draw them.
        """
        self.cursor = bisect_right(self._ats, distance)
        self.ground_cursor = bisect_left(self._ground_ats, distance - _GROUND_VISIBLE_SPAN)

    def reset(self) -> None:
        """Return to the start of the stage."""
        self.cursor = 0
        self.ground_cursor = 0
