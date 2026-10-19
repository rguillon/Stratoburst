"""Struct-of-arrays pool of homing missiles: uid targeting, turn-rate-limited steering."""

import math
from array import array
from dataclasses import dataclass, field
from typing import Final

from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import MISSILE_CAP, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    HOMING_LIFE_TICKS,
    HOMING_RETARGET_TICKS,
    HOMING_SPEED,
    HOMING_TURN_DEG,
)

_TURN: Final = math.radians(HOMING_TURN_DEG)
_MARGIN: Final = 16.0  # a missile this far outside the playfield is gone
_NO_TARGET: Final = 0  # enemy uids start at 1, so 0 never names an enemy


@dataclass(slots=True)
class MissilePool:
    """Fixed-capacity homing missiles stored as parallel columns.

    ``angle`` is the heading in radians, 0 straight up the screen and positive to the right.
    ``target`` holds an enemy's stable ``uid`` (never a pool index, which a swap-remove
    changes); ``life`` counts the steps flown and ``retarget`` the steps until the next
    re-acquisition. Removal swaps the last missile into the freed
    slot, so slot order carries no meaning.
    """

    capacity: int = MISSILE_CAP
    n: int = field(default=0, init=False)
    x: array = field(init=False)
    y: array = field(init=False)
    angle: array = field(init=False)
    target: array = field(init=False)
    life: array = field(init=False)
    retarget: array = field(init=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * self.capacity)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.angle = array("f", zeros)
        self.target = array("i", zeros)
        self.life = array("i", zeros)
        self.retarget = array("i", zeros)

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
        self.retarget[i] = HOMING_RETARGET_TICKS
        self.n = i + 1
        return True

    def nearest_uid(self, enemies: EnemyPool, x: float, y: float) -> int:
        """Return the uid of the nearest live on-screen enemy to ``(x, y)``, or 0 when none."""
        j = self._nearest(enemies, x, y)
        return int(enemies.uid[j]) if j >= 0 else _NO_TARGET

    def steer(self, enemies: EnemyPool) -> None:
        """Turn each missile toward its target, fly it one step, age it and cull it.

        A missile re-acquires the nearest live on-screen enemy every ``HOMING_RETARGET_TICKS``
        steps, and at once when its target is gone. The turn is the signed angle to the target
        wrapped to ``[-pi, pi]`` and clamped to the turn rate, so a missile curves instead of
        snapping onto its target. A missile with no target flies straight. Missiles are visited
        from the highest slot down so a swap-remove only ever moves one that was already visited.
        """
        x, y, angle, target, life = self.x, self.y, self.angle, self.target, self.life
        retarget = self.retarget
        ex, ey = enemies.x, enemies.y
        for i in range(self.n - 1, -1, -1):
            j = enemies.index_of_uid(target[i])
            retarget[i] -= 1
            if retarget[i] <= 0 or (j < 0 and target[i] != _NO_TARGET):
                j = self._nearest(enemies, x[i], y[i])
                target[i] = enemies.uid[j] if j >= 0 else _NO_TARGET
                retarget[i] = HOMING_RETARGET_TICKS
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

    @staticmethod
    def _nearest(enemies: EnemyPool, x: float, y: float) -> int:
        """Return the slot of the nearest live, unshielded enemy inside the playfield, or -1.

        A shielded row (a boss during its entrance, a phase change or its death) is never a
        target, so a missile does not waste itself on a hit the shield would absorb.

        Slots are scanned in ascending order and only a strictly nearer enemy replaces the
        best, so a tie goes to the lower pool index and the choice is deterministic.
        """
        best = -1
        best_d2 = math.inf
        ex, ey, hp, shield = enemies.x, enemies.y, enemies.hp, enemies.shield
        for j in range(enemies.n):
            dx = ex[j] - x
            dy = ey[j] - y
            d2 = dx * dx + dy * dy
            if (
                hp[j] > 0
                and shield[j] == 0
                and 0.0 <= ex[j] <= PLAYFIELD_W
                and 0.0 <= ey[j] <= PLAYFIELD_H
                and d2 < best_d2
            ):
                best_d2 = d2
                best = j
        return best

    def remove_at(self, i: int) -> None:
        """Swap-remove missile ``i``: the last live missile takes its slot."""
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.angle[i] = self.angle[last]
            self.target[i] = self.target[last]
            self.life[i] = self.life[last]
            self.retarget[i] = self.retarget[last]
        self.n = last

    def clear(self) -> None:
        """Remove every missile at once."""
        self.n = 0

    def pack_into(self, out: array) -> None:
        """Write ``x, y, angle, life fraction`` at stride 4 for the live missiles."""
        n = self.n
        end = n * 4
        out[0:end:4] = self.x[:n]
        out[1:end:4] = self.y[:n]
        out[2:end:4] = self.angle[:n]
        for i in range(n):
            out[i * 4 + 3] = self.life[i] / HOMING_LIFE_TICKS
