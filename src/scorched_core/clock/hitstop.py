"""Hitstop: a short, deterministic freeze of the simulation on the biggest events (D-26, D-27)."""

from dataclasses import dataclass


@dataclass(slots=True)
class Hitstop:
    """Counts the simulation steps left to freeze.

    ``trigger`` raises the count to at least ``ticks`` (overlapping triggers keep the larger
    value, they never add up) and ``consume`` swallows one step while any are left.
    """

    ticks: int = 0

    def trigger(self, ticks: int) -> None:
        """Freeze for ``ticks`` more steps, unless more are already owed."""
        self.ticks = max(self.ticks, ticks)

    def consume(self) -> bool:
        """Swallow one step; True while the freeze lasts, False once it is over."""
        if self.ticks <= 0:
            return False
        self.ticks -= 1
        return True
