"""Vulcan: the red weapon, a cooldown-gated fan of bolts whose shape is level data (D-01)."""

import math
from dataclasses import dataclass, field

from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import EV_SHOT
from scorched_core.tuning import (
    MUZZLE_AHEAD,
    PBULLET_SPEED,
    VULCAN_INTERVAL,
    VULCAN_STREAMS,
)
from scorched_core.weapons.weapon_kind import WeaponKind

type _Stream = tuple[float, float, float]


def _build_streams() -> tuple[tuple[_Stream, ...], ...]:
    """Turn the (offset, degrees) tables into (dx, vx, vy) once, so a shot needs no trigonometry."""
    return tuple(
        tuple(
            (
                dx,
                math.sin(math.radians(degrees)) * PBULLET_SPEED,
                -math.cos(math.radians(degrees)) * PBULLET_SPEED,
            )
            for dx, degrees in level
        )
        for level in VULCAN_STREAMS
    )


@dataclass(slots=True)
class Vulcan:
    """Fires one volley per ``VULCAN_INTERVAL[level - 1]`` steps while fire is held."""

    cooldown: int = 0
    _streams: tuple[tuple[_Stream, ...], ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._streams = _build_streams()

    def step(  # noqa: PLR0913, PLR0917 - the ship pose, level and both sinks are all needed
        self,
        firing: bool,
        x: float,
        y: float,
        level: int,
        pool: BulletPool,
        events: EventRing,
    ) -> int:
        """Advance one step; return how many bolts were spawned.

        The cooldown runs down whether or not fire is held, so releasing and pressing again
        never beats the fire interval. Bolts of a volley that do not fit in the pool are
        dropped. A volley that spawns at least one bolt pushes one low-priority SHOT event.
        """
        spawned = 0
        if firing and self.cooldown == 0:
            muzzle_y = y - MUZZLE_AHEAD
            for dx, vx, vy in self._streams[level - 1]:
                spawned += pool.spawn(x + dx, muzzle_y, vx, vy)
            if spawned:
                events.push(EV_SHOT, x, muzzle_y, WeaponKind.VULCAN, low=True)
            self.cooldown = VULCAN_INTERVAL[level - 1]
        if self.cooldown > 0:
            self.cooldown -= 1
        return spawned
