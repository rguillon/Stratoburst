"""Terrain scroll distance: the single value the renderer scrolls the ground by (STGE-02)."""

from dataclasses import dataclass

from scorched_core.tuning import SCROLL_ACCEL, SCROLL_SPEED


@dataclass(slots=True)
class TerrainScroll:
    """Distance the terrain has scrolled, in terrain units, and how fast it scrolls now.

    ``speed`` approaches ``target`` by at most ``SCROLL_ACCEL`` per step, so a boss fight can
    slow the world to a crawl (D-06) and let it recover without a visible jolt.
    """

    distance: float = 0.0
    speed: float = SCROLL_SPEED
    target: float = SCROLL_SPEED

    def step(self) -> None:
        """Advance one 60 Hz step: ramp the speed toward the target, then scroll by it."""
        if self.speed < self.target:
            self.speed = min(self.speed + SCROLL_ACCEL, self.target)
        elif self.speed > self.target:
            self.speed = max(self.speed - SCROLL_ACCEL, self.target)
        self.distance += self.speed

    def set_target(self, speed: float) -> None:
        """Ask the scroll to ramp to ``speed`` (never an instant change)."""
        self.target = speed

    def jump(self, distance: float) -> None:
        """Move the terrain straight to ``distance`` (the ``?at=`` debug jump)."""
        self.distance = distance
