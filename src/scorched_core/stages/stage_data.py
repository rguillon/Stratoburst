"""A whole stage as typed, frozen data: its length, its timeline and its named markers."""

from dataclasses import dataclass

from scorched_core.stages.wave_entry import WaveEntry


@dataclass(frozen=True, slots=True)
class StageData:
    """Stage ``number`` is ``length`` scroll units long, with spawns sorted by ``at``."""

    number: int
    length: float
    waves: tuple[WaveEntry, ...]
    markers: tuple[tuple[str, float], ...]

    def marker(self, name: str) -> float:
        """Return the scroll distance of the marker called ``name``."""
        raise NotImplementedError(name)
