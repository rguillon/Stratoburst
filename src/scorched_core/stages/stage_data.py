"""A whole stage as typed, frozen data: its length, its timeline and its named markers."""

from dataclasses import dataclass, field

from scorched_core.entities.motion_kind import MotionKind
from scorched_core.paths.path_library import path_index
from scorched_core.patterns.pattern_library import pattern_index
from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_builder import scenery_placements
from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.wave_entry import WaveEntry


@dataclass(frozen=True, slots=True)
class StageData:
    """Stage ``number`` is ``length`` scroll units long, with spawns sorted by ``at`` (D-03).

    ``waves`` is the timeline, ``markers`` the named distances (``midboss``, ``boss``) that a
    debug jump or a boss trigger can address. Both are validated on construction, so a stage
    module that imports cleanly is ordered and in range.

    ``city`` (road-grid blocks) and ``features`` (the maglev, the runway lights) author the
    scenery as data (D-34); ``seed`` seeds its expansion, which is done once here into the flat
    ``placements`` tuple the manifest ships to the renderer.
    """

    number: int
    length: float
    waves: tuple[WaveEntry, ...]
    markers: tuple[tuple[str, float], ...]
    city: tuple[CityBlock, ...] = ()
    features: tuple[CityFeature, ...] = ()
    seed: int = 1
    placements: tuple[float, ...] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        """Reject a timeline that is unsorted, out of range or names an unknown pattern or path."""
        previous = 0.0
        for index, wave in enumerate(self.waves):
            if not 0.0 <= wave.at <= self.length:
                msg = f"wave {index} (at={wave.at}) is outside the stage [0, {self.length}]"
                raise ValueError(msg)
            if wave.at < previous:
                msg = f"wave {index} (at={wave.at}) breaks the order: waves must be sorted by at"
                raise ValueError(msg)
            previous = wave.at
            if wave.pattern is not None:
                try:
                    pattern_index(wave.pattern)
                except ValueError as error:
                    msg = (
                        f"wave {index} (at={wave.at}, {wave.kind.name}) "
                        f"names an unknown pattern {wave.pattern!r}"
                    )
                    raise ValueError(msg) from error
            self._check_path(index, wave)
        for name, distance in self.markers:
            if not 0.0 <= distance <= self.length:
                msg = f"marker {name!r} (at={distance}) is outside the stage [0, {self.length}]"
                raise ValueError(msg)
        self._check_city()
        object.__setattr__(
            self, "placements", scenery_placements(self.city, self.features, self.seed)
        )

    def _check_city(self) -> None:
        """Every city block row and feature line must lie inside the stage."""
        for index, block in enumerate(self.city):
            if not 0.0 <= block.d <= self.length:
                msg = f"city block {index} (d={block.d}) is outside the stage [0, {self.length}]"
                raise ValueError(msg)
        for index, feature in enumerate(self.features):
            if not 0.0 <= feature.d0 <= feature.d1 <= self.length:
                msg = (
                    f"city feature {index} ({feature.d0} to {feature.d1}) "
                    f"is outside the stage [0, {self.length}]"
                )
                raise ValueError(msg)

    @staticmethod
    def _check_path(index: int, wave: WaveEntry) -> None:
        """A wave's path must exist, and exactly the PATH motion uses one."""
        where = f"wave {index} (at={wave.at}, {wave.kind.name})"
        if wave.path is not None:
            try:
                path_index(wave.path)
            except ValueError as error:
                msg = f"{where} names an unknown path {wave.path!r}"
                raise ValueError(msg) from error
            if wave.motion != MotionKind.PATH:
                msg = f"{where} has path {wave.path!r} but its motion is not PATH"
                raise ValueError(msg)
        elif wave.motion == MotionKind.PATH:
            msg = f"{where} has PATH motion but no path"
            raise ValueError(msg)

    def marker(self, name: str) -> float:
        """Return the scroll distance of the marker called ``name``; KeyError if there is none."""
        for marker_name, distance in self.markers:
            if marker_name == name:
                return distance
        raise KeyError(name)
