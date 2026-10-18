"""One authored city block: a patch of lots between four roads."""

from dataclasses import dataclass

from scorched_core.stages.city_style import CityStyle

_MAX_GRID = 4


@dataclass(frozen=True, slots=True)
class CityBlock:
    """A block on the road grid (D-34).

    ``d`` is the stage distance where the block's road-to-road row starts (rows are
    ``CITY_PITCH`` apart) and ``col`` the block column: the block spans x
    ``80 * col + 8`` to ``80 * col + 72``. Its footprint is split into a ``cols`` x ``rows`` grid
    of lots whose buildings come from ``style`` and ``seed``. ``fires`` lots burn instead of
    holding a building and ``signs`` neon signs are hung on its buildings.
    """

    d: float
    col: int
    cols: int
    rows: int
    style: CityStyle
    seed: int
    fires: int = 0
    signs: int = 0

    def __post_init__(self) -> None:
        """Reject a block with a negative distance, a lot grid outside 1..4 or too many fires."""
        if self.d < 0.0:
            msg = f"block distance must not be negative, got {self.d}"
            raise ValueError(msg)
        for name, count in (("cols", self.cols), ("rows", self.rows)):
            if not 1 <= count <= _MAX_GRID:
                msg = f"block {name} must be 1..{_MAX_GRID}, got {count}"
                raise ValueError(msg)
        if self.fires < 0 or self.fires > self.cols * self.rows:
            msg = f"block fires must be 0..{self.cols * self.rows} (its lots), got {self.fires}"
            raise ValueError(msg)
        if self.signs < 0:
            msg = f"block signs must not be negative, got {self.signs}"
            raise ValueError(msg)
