"""Drifting air drones as struct-of-arrays columns."""

import math
import random
from array import array
from dataclasses import dataclass, field
from typing import Final

from scorched_core.protocol import DRONE_CAP, DRONE_STRIDE, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    DRONE_FLASH_TICKS,
    DRONE_HP,
    DRONE_MAX_ALIVE,
    DRONE_SPAWN_INTERVAL,
    DRONE_SPAWN_MARGIN_X,
    DRONE_SPEED,
    DRONE_SWAY,
    DRONE_SWAY_PERIOD,
)

_SPAWN_Y: Final = -12.0
# A drone is gone once it is this far below the bottom edge.
_EXIT_Y: Final = PLAYFIELD_H + 16.0
_PHASE_STEP: Final = math.tau / DRONE_SWAY_PERIOD


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
        """Advance one 60 Hz step: move, sway, decay flashes, drop leavers, maybe spawn."""
        x, y, base_x, phase, flash = self.x, self.y, self.base_x, self.phase, self.flash
        for i in range(self.n - 1, -1, -1):
            y[i] += DRONE_SPEED
            if y[i] > _EXIT_Y:
                self._remove_at(i)
                continue
            phase[i] += _PHASE_STEP
            x[i] = base_x[i] + DRONE_SWAY * math.sin(phase[i])
            if flash[i] > 0:
                flash[i] -= 1
        self._timer -= 1
        if self._timer == 0:
            self._timer = DRONE_SPAWN_INTERVAL
            if self.n < DRONE_MAX_ALIVE:
                self._spawn()

    def apply_hit(self, i: int) -> None:
        """Take one hit on drone ``i`` and flash."""
        self.hp[i] -= 1
        self.flash[i] = DRONE_FLASH_TICKS

    def remove_dead(self) -> None:
        """Swap-remove every drone at or below zero HP and count it destroyed."""
        hp = self.hp
        for i in range(self.n - 1, -1, -1):
            if hp[i] <= 0:
                self._remove_at(i)
                self.destroyed += 1

    def pack_into(self, out: array) -> None:
        """Write ``x, y, angle, flash, hp, scale, kind, spare`` at stride 8 for live drones."""
        for i in range(self.n):
            base = i * DRONE_STRIDE
            out[base] = self.x[i]
            out[base + 1] = self.y[i]
            out[base + 2] = 0.0
            out[base + 3] = self.flash[i] / DRONE_FLASH_TICKS
            out[base + 4] = self.hp[i] / DRONE_HP
            out[base + 5] = 1.0
            out[base + 6] = 0.0
            out[base + 7] = 0.0

    def _spawn(self) -> None:
        i = self.n
        spawn_x = self.rng.uniform(DRONE_SPAWN_MARGIN_X, PLAYFIELD_W - DRONE_SPAWN_MARGIN_X)
        self.x[i] = spawn_x
        self.base_x[i] = spawn_x
        self.y[i] = _SPAWN_Y
        self.phase[i] = 0.0
        self.hp[i] = DRONE_HP
        self.flash[i] = 0
        self.n = i + 1

    def _remove_at(self, i: int) -> None:
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.base_x[i] = self.base_x[last]
            self.phase[i] = self.phase[last]
            self.hp[i] = self.hp[last]
            self.flash[i] = self.flash[last]
        self.n = last
