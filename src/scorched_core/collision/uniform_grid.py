"""Uniform-grid broadphase: counting-sort rebuild, 3x3 neighbourhood queries."""

import math
from array import array
from dataclasses import dataclass, field


@dataclass(slots=True)
class UniformGrid:
    """Bins up to ``capacity`` points into square cells with one margin cell on every side.

    Everything is preallocated: a rebuild is a counting sort into ``items`` and a query copies
    item indices into a caller-owned buffer, so neither allocates per call.
    """

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
        return self._row(y) * self.cols + self._col(x)

    def rebuild(self, xs: array, ys: array, n: int) -> None:
        """Bin the first ``n`` points (indices ``0..n-1``); more than ``capacity`` are ignored."""
        n = min(n, self.capacity)
        count, start, cell_of, items = self.cell_count, self.cell_start, self._cell_of, self.items
        count[:] = self._zeros
        for i in range(n):
            c = self.cell_index(xs[i], ys[i])
            cell_of[i] = c
            count[c] += 1
        running = 0
        for c in range(self.cols * self.rows):
            start[c] = running
            running += count[c]
        start[self.cols * self.rows] = running
        count[:] = self._zeros
        for i in range(n):  # ascending i keeps every cell's items in ascending order
            c = cell_of[i]
            items[start[c] + count[c]] = i
            count[c] += 1

    def query(self, x: float, y: float, out: array) -> int:
        """Write the 3x3 neighbourhood's item indices into ``out``; return how many.

        Cells are visited row-major from the top-left, items ascending within a cell. ``out``
        must hold at least ``capacity`` entries.
        """
        col, row = self._col(x), self._row(y)
        first_col = max(col - 1, 0)
        last_col = min(col + 1, self.cols - 1)
        start, items = self.cell_start, self.items
        written = 0
        for r in range(max(row - 1, 0), min(row + 1, self.rows - 1) + 1):
            line = r * self.cols
            # The cells of one row are contiguous, so their items are one contiguous run.
            for k in range(start[line + first_col], start[line + last_col + 1]):
                out[written] = items[k]
                written += 1
        return written

    def _col(self, x: float) -> int:
        return min(max(int(x // self.cell) + 1, 0), self.cols - 1)

    def _row(self, y: float) -> int:
        return min(max(int(y // self.cell) + 1, 0), self.rows - 1)
