"""Circle overlap test."""


def circles_touch(ax: float, ay: float, ar: float, bx: float, by: float, br: float) -> bool:  # noqa: PLR0913, PLR0917 - two circles are six numbers
    """Return whether circle ``a`` and circle ``b`` overlap; touching counts as overlap."""
    dx = ax - bx
    dy = ay - by
    return dx * dx + dy * dy <= (ar + br) ** 2
