"""One enemy bullet pattern as frozen data (ENMY-04): a shape plus its numbers."""

import math
from dataclasses import dataclass

from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.tuning import ENEMY_FIRE_DELAY


@dataclass(frozen=True, slots=True)
class PatternSpec:
    """How one enemy shoots: ``shape`` decides the layout, the other fields tune it.

    ``count`` is the bullets per volley (1 for AIMED and STREAM), ``speed`` the units per step,
    ``interval`` the steps between volleys and ``delay`` the steps from spawn to the first one.
    ``arc_deg`` is the full fan width of a SPREAD, ``aim_offset_deg`` turns an AIMED shot or a
    whole SPREAD away from the ship and ``phase_step_deg`` rotates a RING by that much on every
    volley. A volley can repeat ``burst`` times, ``burst_gap`` steps apart, before the interval.
    Every field is validated on construction, so a registry that imports cleanly is safe to run.
    """

    shape: FirePattern
    count: int = 1
    speed: float = 1.6
    interval: int = 120
    delay: int = ENEMY_FIRE_DELAY
    arc_deg: float = 0.0
    aim_offset_deg: float = 0.0
    phase_step_deg: float = 0.0
    burst: int = 1
    burst_gap: int = 6

    def __post_init__(self) -> None:
        """Reject a pattern that could not run: no shape, no bullets, a bad speed or timing."""
        if self.shape == FirePattern.NONE:
            msg = "a pattern needs a shape: NONE is not one"
            raise ValueError(msg)
        if self.count < 1:
            msg = f"count must be at least 1, got {self.count}"
            raise ValueError(msg)
        if self.shape in {FirePattern.AIMED, FirePattern.STREAM} and self.count != 1:
            msg = f"{self.shape.name} fires one bullet per call, got count {self.count}"
            raise ValueError(msg)
        if not (math.isfinite(self.speed) and self.speed > 0.0):
            msg = f"speed must be finite and positive, got {self.speed}"
            raise ValueError(msg)
        if self.interval < 1:
            msg = f"interval must be at least 1 step, got {self.interval}"
            raise ValueError(msg)
        if self.delay < 0:
            msg = f"delay must not be negative, got {self.delay}"
            raise ValueError(msg)
        if self.burst < 1:
            msg = f"burst must be at least 1, got {self.burst}"
            raise ValueError(msg)
        if self.burst_gap < 1:
            msg = f"burst_gap must be at least 1 step, got {self.burst_gap}"
            raise ValueError(msg)
        for name in ("arc_deg", "aim_offset_deg", "phase_step_deg"):
            if not math.isfinite(getattr(self, name)):
                msg = f"{name} must be finite, got {getattr(self, name)}"
                raise ValueError(msg)
