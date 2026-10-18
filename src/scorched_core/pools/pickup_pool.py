"""Struct-of-arrays pool of pickups: colour-cycling crystals and fixed-colour drops."""

from array import array
from dataclasses import dataclass, field

from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.protocol import PICKUP_CAP, PICKUP_STRIDE
from scorched_core.tuning import CRYSTAL_CYCLE_TICKS, CRYSTAL_SPEED

# A crystal cycles through the three weapon colours: red, blue, purple.
_COLORS = 3
# The crystal is launched up and sideways along a 3-4-5 direction at CRYSTAL_SPEED.
_LAUNCH_X = 0.8 * CRYSTAL_SPEED
_LAUNCH_Y = -0.6 * CRYSTAL_SPEED


@dataclass(slots=True)
class PickupPool:
    """Up to ``PICKUP_CAP`` live pickups in preallocated columns.

    Removal swaps the last live pickup into the freed slot, so slot order carries no meaning.
    A CRYSTAL's colour is a function of its age; every other kind has a fixed colour equal to
    its kind value.
    """

    x: array = field(init=False)
    y: array = field(init=False)
    vx: array = field(init=False)
    vy: array = field(init=False)
    kind: array = field(init=False)
    age: array = field(init=False)
    n: int = field(default=0, init=False)
    _side: float = field(default=1.0, init=False, repr=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * PICKUP_CAP)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.vx = array("f", zeros)
        self.vy = array("f", zeros)
        self.kind = array("i", zeros)
        self.age = array("i", zeros)

    def spawn(self, kind: int, x: float, y: float, vx: float, vy: float) -> bool:
        """Add a pickup; return False when ``PICKUP_CAP`` are already alive."""
        i = self.n
        if i >= PICKUP_CAP:
            return False
        self.x[i] = x
        self.y[i] = y
        self.vx[i] = vx
        self.vy[i] = vy
        self.kind[i] = kind
        self.age[i] = 0
        self.n = i + 1
        return True

    def spawn_crystal(self, x: float, y: float) -> bool:
        """Launch a CRYSTAL at ``(x, y)``, alternating left and right on each call."""
        side = self._side
        self._side = -side
        return self.spawn(PickupKind.CRYSTAL, x, y, side * _LAUNCH_X, _LAUNCH_Y)

    def step(self) -> None:
        """Advance one 60 Hz step: move every pickup and age it."""
        x, y, vx, vy, age = self.x, self.y, self.vx, self.vy, self.age
        for i in range(self.n):
            x[i] += vx[i]
            y[i] += vy[i]
            age[i] += 1

    def color_at(self, i: int) -> int:
        """Return pickup ``i``'s colour index: the cycle position for a CRYSTAL, else its kind."""
        kind = self.kind[i]
        if kind == PickupKind.CRYSTAL:
            return (self.age[i] // CRYSTAL_CYCLE_TICKS) % _COLORS
        return kind

    def remove_at(self, i: int) -> None:
        """Swap-remove pickup ``i``: the last live pickup takes its slot."""
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.vx[i] = self.vx[last]
            self.vy[i] = self.vy[last]
            self.kind[i] = self.kind[last]
            self.age[i] = self.age[last]
        self.n = last

    def pack_into(self, out: array) -> None:
        """Write ``x, y, colour index, kind`` at stride 4 for the live pickups.

        Python decides the colour here, so JS never recomputes the cycle.
        """
        for i in range(self.n):
            base = i * PICKUP_STRIDE
            out[base] = self.x[i]
            out[base + 1] = self.y[i]
            out[base + 2] = self.color_at(i)
            out[base + 3] = self.kind[i]
