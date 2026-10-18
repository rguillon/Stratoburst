"""Struct-of-arrays bullet pool: preallocated columns, swap-remove, no per-bullet objects."""

import math
from array import array
from dataclasses import dataclass, field


@dataclass(slots=True)
class BulletPool:
    """Fixed-capacity bullets stored as parallel ``array('f')`` columns.

    Removal swaps the last live bullet into the freed slot, so slot order carries no meaning.
    ``angle`` is the flight direction at spawn, ``atan2(vx, -vy)`` (0 is straight up the screen,
    positive is to the right); it is not updated when a velocity is later changed in place.
    """

    capacity: int
    n: int = field(default=0, init=False)
    x: array = field(init=False)
    y: array = field(init=False)
    vx: array = field(init=False)
    vy: array = field(init=False)
    angle: array = field(init=False)
    _kinds: array = field(init=False, repr=False)
    _kind: float = field(default=0.0, init=False, repr=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * self.capacity)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.vx = array("f", zeros)
        self.vy = array("f", zeros)
        self.angle = array("f", zeros)
        self._kinds = array("f", zeros)

    def spawn(self, x: float, y: float, vx: float, vy: float) -> bool:
        """Add a bullet; return False when the pool is full."""
        i = self.n
        if i >= self.capacity:
            return False
        self.x[i] = x
        self.y[i] = y
        self.vx[i] = vx
        self.vy[i] = vy
        self.angle[i] = math.atan2(vx, -vy)
        self.n = i + 1
        return True

    def integrate(self) -> None:
        """Move every live bullet by its velocity."""
        x, y, vx, vy = self.x, self.y, self.vx, self.vy
        for i in range(self.n):
            x[i] += vx[i]
            y[i] += vy[i]

    def remove_at(self, i: int) -> None:
        """Swap-remove bullet ``i``: the last live bullet takes its slot."""
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.vx[i] = self.vx[last]
            self.vy[i] = self.vy[last]
            self.angle[i] = self.angle[last]
        self.n = last

    def cull_outside(self, min_x: float, min_y: float, max_x: float, max_y: float) -> None:
        """Remove every bullet whose centre lies outside the box (edges are inside)."""
        x, y = self.x, self.y
        for i in range(self.n - 1, -1, -1):
            if not (min_x <= x[i] <= max_x and min_y <= y[i] <= max_y):
                self.remove_at(i)

    def pack_into(self, out: array, kind: float) -> None:
        """Write ``x, y, angle, kind`` at stride 4 for the live bullets; the tail is untouched."""
        n = self.n
        if kind != self._kind:
            self._kinds = array("f", [kind]) * self.capacity
            self._kind = kind
        end = n * 4
        out[0:end:4] = self.x[:n]
        out[1:end:4] = self.y[:n]
        out[2:end:4] = self.angle[:n]
        out[3:end:4] = self._kinds[:n]
