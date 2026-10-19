"""One authored city block: a patch of lots between four roads."""

from dataclasses import dataclass
from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.stages.city_style import CityStyle

_MAX_GRID = 4
TARGET_KINDS: Final = frozenset(
    {EnemyKind.HOUSE, EnemyKind.FUEL_TANK, EnemyKind.DEPOT, EnemyKind.BILLBOARD}
)  # what a flagged lot may become (D-05)


@dataclass(frozen=True, slots=True)
class CityBlock:
    """A block on the road grid (D-34).

    ``d`` is the stage distance where the block's road-to-road row starts (rows are
    ``CITY_PITCH`` apart) and ``col`` the block column: the block spans x
    ``80 * col + 8`` to ``80 * col + 72``. Its footprint is split into a ``cols`` x ``rows`` grid
    of lots whose buildings come from ``style`` and ``seed``. ``fires`` lots burn instead of
    holding a building and ``signs`` neon signs are hung on its buildings.

    ``targets`` flags lots as destructible (D-05, STGE-03): each ``(lot, kind, drop)`` names a lot
    index (row by row, ``row * cols + col``), the target kind standing on it and the pickup its
    destruction leaves. A flagged lot is not built as scenery; ``target_entries`` emits it as an
    enemy row instead.
    """

    d: float
    col: int
    cols: int
    rows: int
    style: CityStyle
    seed: int
    fires: int = 0
    signs: int = 0
    targets: tuple[tuple[int, EnemyKind, PickupKind | None], ...] = ()

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
        lots = self.cols * self.rows
        seen: set[int] = set()
        for lot, kind, _ in self.targets:
            if not 0 <= lot < lots:
                msg = f"block target lot must be 0..{lots - 1} (its lots), got {lot}"
                raise ValueError(msg)
            if lot in seen:
                msg = f"block lot {lot} is flagged as a target twice"
                raise ValueError(msg)
            seen.add(lot)
            if kind not in TARGET_KINDS:
                msg = f"block target kind must be a building target, got {kind.name}"
                raise ValueError(msg)
