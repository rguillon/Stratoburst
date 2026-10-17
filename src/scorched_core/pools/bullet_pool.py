"""Struct-of-arrays bullet pool (skeleton, replaced in the GREEN commit)."""

from array import array
from dataclasses import dataclass, field


@dataclass(slots=True)
class BulletPool:
    """Skeleton."""

    capacity: int
    n: int = field(default=0, init=False)

    def spawn(self, x: float, y: float, vx: float, vy: float) -> bool:  # noqa: ARG002
        """Skeleton."""
        return False

    def integrate(self) -> None:
        """Skeleton."""

    def remove_at(self, i: int) -> None:
        """Skeleton."""

    def cull_outside(self, min_x: float, min_y: float, max_x: float, max_y: float) -> None:
        """Skeleton."""

    def pack_into(self, out: array, kind: float) -> None:
        """Skeleton."""
