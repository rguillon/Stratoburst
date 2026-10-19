"""The enemy path registry (ENMY-01, ENMY-02): a new path is a new entry in ``PATHS``.

Every path is a polyline of offsets from the spawn point, built once at import by the pure point
generators below (arcs, S-curves, loops) and joined with straight legs. There is no spline
evaluation at run time. Headings are degrees with 0 pointing down the screen and 90 to the
right, so a positive sweep turns from down toward right. ``PATH_TABLE`` is the fixed order the
enemy pool indexes; names resolve to indices once, in ``path_index``.
"""

import math
from typing import Final

from scorched_core.paths.path_spec import PathSpec

type Point = tuple[float, float]


def arc_points(radius: float, start_deg: float, sweep_deg: float, steps: int) -> tuple[Point, ...]:
    """Return ``steps + 1`` points on a circular arc that starts at (0, 0).

    The arc leaves heading ``start_deg`` and turns ``sweep_deg`` degrees (positive: from down
    toward right) around a circle of ``radius``.
    """
    if radius <= 0.0 or steps < 1:
        msg = f"an arc needs a positive radius and at least one step, got {radius} and {steps}"
        raise ValueError(msg)
    if sweep_deg == 0.0:
        msg = "an arc needs a non-zero sweep"
        raise ValueError(msg)
    start = math.radians(start_deg)
    sign = math.copysign(1.0, sweep_deg)
    points = []
    for step in range(steps + 1):
        heading = start + math.radians(sweep_deg) * step / steps
        points.append(
            (
                sign * radius * (math.cos(start) - math.cos(heading)),
                sign * radius * (math.sin(heading) - math.sin(start)),
            )
        )
    return tuple(points)


def loop_points(radius: float, steps: int) -> tuple[Point, ...]:
    """Return a full circle that starts heading down at (0, 0) and closes back on it."""
    if steps < 3:
        msg = f"a loop needs at least three steps, got {steps}"
        raise ValueError(msg)
    return arc_points(radius, 0.0, 360.0, steps)


def s_curve_points(amplitude: float, length: float, steps: int) -> tuple[Point, ...]:
    """Return an S: one sine period of side-to-side ``amplitude`` over ``length`` of descent."""
    if length <= 0.0 or steps < 2:
        msg = f"an S-curve needs a positive length and at least two steps, got {length} and {steps}"
        raise ValueError(msg)
    return tuple(
        (amplitude * math.sin(math.tau * step / steps), length * step / steps)
        for step in range(steps + 1)
    )


def _join(*parts: tuple[Point, ...]) -> tuple[Point, ...]:
    """Chain point lists that each start at (0, 0): every part continues from the previous end."""
    joined: list[Point] = [parts[0][0]]
    for part in parts:
        end_x, end_y = joined[-1]
        joined.extend((end_x + x, end_y + y) for x, y in part[1:])
    return tuple(joined)


def _line(dx: float, dy: float) -> tuple[Point, ...]:
    return ((0.0, 0.0), (dx, dy))


PATHS: Final[dict[str, PathSpec]] = {
    # Enter at the top left, curve down and sweep out to the right.
    "swoop": PathSpec(
        _join(_line(0.0, 50.0), arc_points(90.0, 0.0, 90.0, 10), _line(260.0, 0.0)), 2.2
    ),
    # A lazy S down the whole screen.
    "s_dive": PathSpec(s_curve_points(50.0, 420.0, 14), 2.0),
    # Dive, loop the loop, then U-turn and leave upward.
    "loop_back": PathSpec(
        _join(
            _line(0.0, 80.0),
            loop_points(22.0, 14),
            arc_points(30.0, 0.0, 180.0, 10),
            _line(0.0, -320.0),
        ),
        2.0,
    ),
    # Enter from the side edge and cross the screen on a shallow slope.
    "strafe": PathSpec(_line(280.0, 40.0), 2.4),
    # Descend, arc across to the right and settle back onto a downward heading.
    "hover_arc": PathSpec(
        _join(
            _line(0.0, 70.0),
            arc_points(60.0, 0.0, 90.0, 8),
            arc_points(60.0, 90.0, -90.0, 8),
            _line(0.0, 300.0),
        ),
        1.4,
    ),
    # A tank drives straight down its road, a crawl on top of the terrain scroll.
    "road_down": PathSpec(_line(0.0, 600.0), 0.25),
    # Down a road, then a rounded turn onto the crossing road and off to the right. The tank
    # drives faster than a crawl so the turn happens on screen while the terrain scrolls by.
    "road_bend": PathSpec(
        _join(_line(0.0, 40.0), arc_points(14.0, 0.0, 90.0, 5), _line(260.0, 0.0)), 0.8
    ),
}
PATH_NAMES: Final = tuple(PATHS)
PATH_TABLE: Final = tuple(PATHS.values())
_INDEX: Final = {name: position for position, name in enumerate(PATH_NAMES)}


def path_index(name: str) -> int:
    """Return the ``PATH_TABLE`` index of the path called ``name``; ValueError if unknown."""
    try:
        return _INDEX[name]
    except KeyError:
        msg = f"unknown path {name!r}"
        raise ValueError(msg) from None
