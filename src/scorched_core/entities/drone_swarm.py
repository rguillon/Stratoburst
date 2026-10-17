"""Drifting air drones as struct-of-arrays columns."""

import random
from array import array
from dataclasses import dataclass, field

from scorched_core.protocol import DRONE_CAP
from scorched_core.tuning import DRONE_SPAWN_INTERVAL


@dataclass(slots=True)
class DroneSwarm:
    """Up to ``DRONE_MAX_ALIVE`` drones: seeded spawn, sway, hit flash, swap-remove."""

    rng: random.Random
    x: array = field(init=False)
    y: array = field(init=False)
    base_x: array = field(init=False)
    phase: array = field(init=False)
    hp: array = field(init=False)
    flash: array = field(init=False)
    n: int = field(default=0, init=False)
    destroyed: int = field(default=0, init=False)
    _timer: int = field(default=DRONE_SPAWN_INTERVAL, init=False, repr=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * DRONE_CAP)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.base_x = array("f", zeros)
        self.phase = array("f", zeros)
        self.hp = array("i", zeros)
        self.flash = array("i", zeros)

    def step(self) -> None:
        """Advance one 60 Hz step."""

    def apply_hit(self, i: int) -> None:
        """Take one hit on drone ``i`` and flash."""

    def remove_dead(self) -> None:
        """Swap-remove every drone at or below zero HP and count it destroyed."""

    def pack_into(self, out: array) -> None:
        """Write ``x, y, angle, flash, hp, scale, kind, spare`` at stride 8 for live drones."""
