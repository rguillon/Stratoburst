"""The stage-clear bonus tally: four lines worked out once and revealed one by one."""

from dataclasses import dataclass, field

LINES = 4  # boss destroyed, medals collected, no miss, bombs left


@dataclass(slots=True)
class StageTally:
    """The four bonus lines of a cleared stage (SCOR-03, D-18)."""

    amounts: list[int] = field(default_factory=lambda: [0] * LINES)
    revealed: int = 0

    def compute(self, boss_destroyed: bool, medals: int, deaths: int, bombs: int) -> None:
        """Work out the four amounts from the stage's results and start revealing from the top."""
        raise NotImplementedError

    def reveal_next(self) -> tuple[int, int]:
        """Reveal the next line and return its index and amount; raise once all are revealed."""
        raise NotImplementedError

    def reset(self) -> None:
        """Forget the tally: all zero, nothing revealed."""
        raise NotImplementedError
