"""One authored enemy path: a polyline of offsets from the spawn point and a constant speed."""

import math
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PathSpec:
    """A polyline the ``PATH`` motion follows (ENMY-01).

    ``points`` are offsets from the spawn point (x to the right, y down the screen), walked at
    ``speed`` units per step. The segment lengths and unit directions are computed once here, so
    the step loop only indexes tuples: no square root, no spline evaluation per step. A path that
    ends keeps going along its last direction until the exit margins remove the enemy.

    Construction rejects fewer than two points, a non-finite coordinate, a speed that is not a
    positive finite number and a zero-length segment (T-03-07): no NaN position and no segment
    the carry loop could never cross can reach the pool.
    """

    points: tuple[tuple[float, float], ...]
    speed: float
    seg_len: tuple[float, ...] = field(init=False, repr=False, compare=False)
    seg_dx: tuple[float, ...] = field(init=False, repr=False, compare=False)
    seg_dy: tuple[float, ...] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        """Validate the polyline and precompute each segment's length and unit direction."""
        if len(self.points) < 2:
            msg = f"a path needs at least two points, got {len(self.points)}"
            raise ValueError(msg)
        if not all(math.isfinite(value) for point in self.points for value in point):
            msg = "every path coordinate must be finite"
            raise ValueError(msg)
        if not (math.isfinite(self.speed) and self.speed > 0.0):
            msg = f"path speed must be a positive finite number, got {self.speed}"
            raise ValueError(msg)
        lengths: list[float] = []
        dxs: list[float] = []
        dys: list[float] = []
        for index, ((x0, y0), (x1, y1)) in enumerate(
            zip(self.points, self.points[1:], strict=False)
        ):
            length = math.hypot(x1 - x0, y1 - y0)
            if length == 0.0:
                msg = f"path segment {index} has zero length"
                raise ValueError(msg)
            lengths.append(length)
            dxs.append((x1 - x0) / length)
            dys.append((y1 - y0) / length)
        object.__setattr__(self, "seg_len", tuple(lengths))
        object.__setattr__(self, "seg_dx", tuple(dxs))
        object.__setattr__(self, "seg_dy", tuple(dys))
