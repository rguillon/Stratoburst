"""Struct-of-arrays pool of homing missiles: uid targeting, turn-rate-limited steering."""

import math
from array import array
from dataclasses import dataclass, field
from typing import Final

from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import MISSILE_CAP, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import HOMING_LIFE_TICKS, HOMING_SPEED, HOMING_TURN_DEG

_TURN: Final = math.radians(HOMING_TURN_DEG)
_MARGIN: Final = 16.0  # a missile this far outside the playfield is gone
_NO_TARGET: Final = 0  # enemy uids start at 1, so 0 never names an enemy


@dataclass(slots=True)
class MissilePool:
    """Fixed-capacity homing missiles stored as parallel columns.

    ``angle`` is the heading in radians, 0 straight up the screen and positive to the right.
    ``target`` holds an enemy's stable ``uid`` (never a pool index, which a swap-remove
    changes); ``life`` counts the steps flown. Removal swaps the last missile into the freed
    slot, so slot order carries no meaning.
    """

    capacity: int = MISSILE_CAP
    n: int = field(default=0, init=False)
    x: array = field(init=False)
    y: array = field(init=False)
    angle: array = field(init=False)
    target: array = field(init=False)
    life: array = field(init=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * self.capacity)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.angle = array("f", zeros)
        self.target = array("i", zeros)
        self.life = array("i", zeros)

    def spawn(self, x: float, y: float, angle: float, target_uid: int) -> bool:
        """Add a missile heading ``angle`` at ``target_uid``; return False when the pool is full."""
        i = self.n
        if i >= self.capacity:
            return False
        self.x[i] = x
        self.y[i] = y
        self.angle[i] = angle
        self.target[i] = target_uid
        self.life[i] = 0
        self.n = i + 1
        return True

    def nearest_uid(self, enemies: EnemyPool, x: float, y: float) -> int:
        """Return the uid of the live enemy nearest ``(x, y)``, or 0 when there is none."""
        best = _NO_TARGET
        best_d2 = math.inf
        ex, ey, hp, uid = enemies.x, enemies.y, enemies.hp, enemies.uid
        for j in range(enemies.n):
            dx = ex[j] - x
            dy = ey[j] - y
            d2 = dx * dx + dy * dy
            if hp[j] > 0 and d2 < best_d2:
                best_d2 = d2
                best = uid[j]
        return best

    def steer(self, enemies: EnemyPool) -> None:
        """Turn each missile toward its target, fly it one step, age it and cull it.

        The turn is the signed angle to the target wrapped to ``[-pi, pi]`` and clamped to the
        turn rate, so a missile curves instead of snapping onto its target. A missile whose
        target is gone (or that never had one) flies straight. Missiles are visited from the
        highest slot down so a swap-remove only ever moves one that was already visited.
        """
        x, y, angle, target, life = self.x, self.y, self.angle, self.target, self.life
        ex, ey = enemies.x, enemies.y
        for i in range(self.n - 1, -1, -1):
            j = enemies.index_of_uid(target[i])
            if j >= 0:
                wanted = math.atan2(ex[j] - x[i], y[i] - ey[j])
                turn = (wanted - angle[i] + math.pi) % math.tau - math.pi
                heading = angle[i] + min(max(turn, -_TURN), _TURN)
                angle[i] = (heading + math.pi) % math.tau - math.pi
            a = angle[i]
            x[i] += math.sin(a) * HOMING_SPEED
            y[i] -= math.cos(a) * HOMING_SPEED
            life[i] += 1
            if (
                life[i] >= HOMING_LIFE_TICKS
                or not -_MARGIN <= x[i] <= PLAYFIELD_W + _MARGIN
                or not -_MARGIN <= y[i] <= PLAYFIELD_H + _MARGIN
            ):
                self.remove_at(i)

    def remove_at(self, i: int) -> None:
        """Swap-remove missile ``i``: the last live missile takes its slot."""
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.angle[i] = self.angle[last]
            self.target[i] = self.target[last]
            self.life[i] = self.life[last]
        self.n = last

    def pack_into(self, out: array) -> None:
        """Write ``x, y, angle, life fraction`` at stride 4 for the live missiles."""
        n = self.n
        end = n * 4
        out[0:end:4] = self.x[:n]
        out[1:end:4] = self.y[:n]
        out[2:end:4] = self.angle[:n]
        for i in range(n):
            out[i * 4 + 3] = self.life[i] / HOMING_LIFE_TICKS
