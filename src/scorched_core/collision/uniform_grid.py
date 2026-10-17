"""Uniform-grid broadphase: counting-sort rebuild, 3x3 neighbourhood queries."""

import math
from array import array
from dataclasses import dataclass, field


@dataclass(slots=True)
class UniformGrid:
    """Bins up to ``capacity`` points into square cells with one margin cell on every side."""

    width: float
    height: float
    cell: float
    capacity: int
    cols: int = field(init=False)
    rows: int = field(init=False)
    cell_count: array = field(init=False, repr=False)
    cell_start: array = field(init=False, repr=False)
    items: array = field(init=False, repr=False)
    _cell_of: array = field(init=False, repr=False)
    _zeros: array = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.cols = math.ceil(self.width / self.cell) + 2
        self.rows = math.ceil(self.height / self.cell) + 2
        cells = self.cols * self.rows
        self.cell_count = array("i", bytes(4 * cells))
        self.cell_start = array("i", bytes(4 * (cells + 1)))
        self.items = array("i", bytes(4 * self.capacity))
        self._cell_of = array("i", bytes(4 * self.capacity))
        self._zeros = array("i", bytes(4 * cells))

    def cell_index(self, x: float, y: float) -> int:
        """Return the flat cell index for a point, clamped into the grid."""
        return 0

    def rebuild(self, xs: array, ys: array, n: int) -> None:
        """Bin the first ``n`` points (indices ``0..n-1``)."""

    def query(self, x: float, y: float, out: array) -> int:
        """Write the 3x3 neighbourhood's item indices into ``out``; return how many."""
        return 0
