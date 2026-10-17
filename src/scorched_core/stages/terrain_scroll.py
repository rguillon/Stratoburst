"""Terrain scroll distance: the single value the renderer scrolls the ground by (STGE-02)."""

from dataclasses import dataclass

from scorched_core.tuning import SCROLL_SPEED


@dataclass(slots=True)
class TerrainScroll:
    """Distance the terrain has scrolled, in terrain units."""

    distance: float = 0.0

    def step(self) -> None:
        """Advance one 60 Hz step."""
        self.distance += SCROLL_SPEED
