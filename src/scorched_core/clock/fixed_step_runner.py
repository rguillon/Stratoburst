"""Fixed 60 Hz simulation stepping with a bounded catch-up."""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Final

STEP_MS: Final = 1000.0 / 60.0
MAX_STEPS: Final = 3
MAX_DT_MS: Final = 100.0
EPS: Final = 1e-6


@dataclass(slots=True)
class FixedStepRunner:
    """Accumulates frame time and runs ``step_fn`` once per elapsed 60 Hz step."""

    step_fn: Callable[[], None]
    acc: float = field(default=0.0, init=False)

    def advance(self, dt_ms: float) -> int:
        """Add ``dt_ms`` of frame time and run the owed steps; return how many ran."""
        self.acc += min(dt_ms, MAX_DT_MS)
        steps = 0
        while self.acc >= STEP_MS - EPS and steps < MAX_STEPS:
            self.step_fn()
            self.acc -= STEP_MS
            steps += 1
        if steps == MAX_STEPS:
            self.acc = 0.0  # slow down, never spiral
        return steps

    def reset(self) -> None:
        """Drop any accumulated time."""
        self.acc = 0.0

    @property
    def alpha(self) -> float:
        """Fraction of the next step already accumulated, in 0..1."""
        return max(0.0, min(1.0, self.acc / STEP_MS))
