"""Terrain scroll distance (skeleton: behavior arrives in the GREEN commit)."""

from dataclasses import dataclass


@dataclass(slots=True)
class TerrainScroll:
    """Distance the terrain has scrolled, in terrain units."""

    distance: float = 0.0

    def step(self) -> None:
        """Advance one 60 Hz step."""
