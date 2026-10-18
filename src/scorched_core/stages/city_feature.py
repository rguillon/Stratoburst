"""A line of scenery that runs through the city regardless of the block grid."""

from dataclasses import dataclass

from scorched_core.stages.scenery_kind import SceneryKind


@dataclass(frozen=True, slots=True)
class CityFeature:
    """``kind`` is placed at x every ``spacing`` distance units from ``d0`` to ``d1`` inclusive.

    The maglev line and the runway lights are features; lots whose footprint falls in a
    feature's corridor are not built.
    """

    kind: SceneryKind
    x: float
    d0: float
    d1: float
    spacing: float

    def __post_init__(self) -> None:
        """Reject a feature that does not run forward or has no positive spacing."""
        if self.d1 <= self.d0:
            msg = f"feature d1 ({self.d1}) must be greater than d0 ({self.d0})"
            raise ValueError(msg)
        if self.spacing <= 0.0:
            msg = f"feature spacing must be positive, got {self.spacing}"
            raise ValueError(msg)
