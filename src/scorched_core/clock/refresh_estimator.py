"""Display refresh estimation: snaps jittery frame times onto whole display periods."""

from dataclasses import dataclass
from typing import Final

WINDOW: Final = 15
SNAP_TOLERANCE: Final = 0.25
RATE_TOLERANCE: Final = 0.015
STANDARD_RATES_HZ: Final = (30, 60, 72, 90, 120, 144, 165, 240)
MIN_SAMPLES: Final = 3


@dataclass(slots=True)
class RefreshEstimator:
    """Skeleton: passes frame times through unchanged."""

    def snap(self, dt_ms: float) -> float:
        """Return the frame time to feed the fixed-step runner."""
        return dt_ms

    def reset(self) -> None:
        """Forget every recorded frame time."""
