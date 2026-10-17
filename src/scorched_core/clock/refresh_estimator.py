"""Display refresh estimation: snaps jittery frame times onto whole display periods."""

from array import array
from dataclasses import dataclass, field
from typing import Final

WINDOW: Final = 15
SNAP_TOLERANCE: Final = 0.25
RATE_TOLERANCE: Final = 0.015
STANDARD_RATES_HZ: Final = (30, 60, 72, 90, 120, 144, 165, 240)
MIN_SAMPLES: Final = 3


@dataclass(slots=True)
class RefreshEstimator:
    """Snaps requestAnimationFrame deltas onto the display period (PLAT-06).

    A plain accumulator turns timestamp jitter into 0-step and 2-step frames, which shows as
    stutter. The median of the last ``WINDOW`` deltas estimates the display period (snapped to a
    standard rate when within ``RATE_TOLERANCE``), and a delta within ``SNAP_TOLERANCE`` of a whole
    number of periods becomes exactly that many periods. Anything farther away is a genuine hitch
    and is passed through untouched.
    """

    _ring: array = field(default_factory=lambda: array("d", bytes(8 * WINDOW)), init=False)
    _count: int = field(default=0, init=False)
    _index: int = field(default=0, init=False)

    def snap(self, dt_ms: float) -> float:
        """Record ``dt_ms`` and return the frame time to feed the fixed-step runner."""
        if dt_ms <= 0.0:
            return dt_ms  # the first frame, or a clock that did not move: nothing to learn
        self._ring[self._index] = dt_ms
        self._index = (self._index + 1) % WINDOW
        self._count = min(self._count + 1, WINDOW)
        if self._count < MIN_SAMPLES:
            return dt_ms
        period = self._period()
        periods = max(1, round(dt_ms / period))
        target = periods * period
        if abs(dt_ms - target) < SNAP_TOLERANCE * period:
            return target
        return dt_ms

    def reset(self) -> None:
        """Forget every recorded frame time."""
        self._count = 0
        self._index = 0

    def _period(self) -> float:
        # One short-lived sorted list per rAF (not per entity); the allocation test guards leaks.
        ordered = sorted(self._ring[: self._count])
        middle = self._count // 2
        median = ordered[middle] if self._count % 2 else (ordered[middle - 1] + ordered[middle]) / 2
        for hz in STANDARD_RATES_HZ:
            nominal = 1000.0 / hz
            if abs(median - nominal) <= RATE_TOLERANCE * nominal:
                return nominal
        return median
