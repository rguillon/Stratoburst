"""A whole stage as typed, frozen data: its length, its timeline and its named markers."""

from dataclasses import dataclass

from scorched_core.stages.wave_entry import WaveEntry


@dataclass(frozen=True, slots=True)
class StageData:
    """Stage ``number`` is ``length`` scroll units long, with spawns sorted by ``at`` (D-03).

    ``waves`` is the timeline, ``markers`` the named distances (``midboss``, ``boss``) that a
    debug jump or a boss trigger can address. Both are validated on construction, so a stage
    module that imports cleanly is ordered and in range.
    """

    number: int
    length: float
    waves: tuple[WaveEntry, ...]
    markers: tuple[tuple[str, float], ...]

    def __post_init__(self) -> None:
        """Reject a timeline that is unsorted or a distance outside ``[0, length]``."""
        previous = 0.0
        for index, wave in enumerate(self.waves):
            if not 0.0 <= wave.at <= self.length:
                msg = f"wave {index} (at={wave.at}) is outside the stage [0, {self.length}]"
                raise ValueError(msg)
            if wave.at < previous:
                msg = f"wave {index} (at={wave.at}) breaks the order: waves must be sorted by at"
                raise ValueError(msg)
            previous = wave.at
        for name, distance in self.markers:
            if not 0.0 <= distance <= self.length:
                msg = f"marker {name!r} (at={distance}) is outside the stage [0, {self.length}]"
                raise ValueError(msg)

    def marker(self, name: str) -> float:
        """Return the scroll distance of the marker called ``name``; KeyError if there is none."""
        for marker_name, distance in self.markers:
            if marker_name == name:
                return distance
        raise KeyError(name)
