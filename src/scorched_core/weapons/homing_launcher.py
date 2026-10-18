"""Homing launcher: the purple weapon, a cooldown-gated centred fan of missiles (D-03)."""

import math
from dataclasses import dataclass, field

from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.missile_pool import MissilePool
from scorched_core.protocol import EV_SHOT
from scorched_core.tuning import (
    HOMING_FAN_DEG,
    HOMING_INTERVAL,
    HOMING_MUZZLE_AHEAD,
    HOMING_VOLLEY,
)
from scorched_core.weapons.weapon_kind import WeaponKind


def _build_fans() -> tuple[tuple[float, ...], ...]:
    """Turn each level's missile count into launch angles in radians, centred on straight up.

    Angles are ordered from the middle outwards, so a volley that does not fit in the pool
    keeps its central missiles.
    """
    fans = []
    for count in HOMING_VOLLEY:
        degrees = [(k - (count - 1) / 2) * HOMING_FAN_DEG for k in range(count)]
        degrees.sort(key=lambda d: (abs(d), d))
        fans.append(tuple(math.radians(d) for d in degrees))
    return tuple(fans)


@dataclass(slots=True)
class HomingLauncher:
    """Launches one fan per ``HOMING_INTERVAL[level - 1]`` steps while fire is held."""

    cooldown: int = 0
    _fans: tuple[tuple[float, ...], ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._fans = _build_fans()

    def step(  # noqa: PLR0913, PLR0917 - the ship pose, level, both pools and the sink are all needed
        self,
        firing: bool,
        x: float,
        y: float,
        level: int,
        missiles: MissilePool,
        enemies: EnemyPool,
        events: EventRing,
    ) -> int:
        """Advance one step; return how many missiles were launched.

        The cooldown runs down whether or not fire is held, so releasing and pressing again
        never beats the fire interval. Every missile of a volley starts aimed at the enemy
        nearest the ship (or straight up when there is none). Missiles that do not fit in the
        pool are dropped. A volley that launches at least one missile pushes one low-priority
        SHOT event.
        """
        launched = 0
        if firing and self.cooldown == 0:
            muzzle_y = y - HOMING_MUZZLE_AHEAD
            target = missiles.nearest_uid(enemies, x, y)
            for angle in self._fans[level - 1]:
                launched += missiles.spawn(x, muzzle_y, angle, target)
            if launched:
                events.push(EV_SHOT, x, muzzle_y, WeaponKind.HOMING, low=True)
            self.cooldown = HOMING_INTERVAL[level - 1]
        if self.cooldown > 0:
            self.cooldown -= 1
        return launched
