"""The stage-clear bonus tally: four lines worked out once and revealed one by one."""

from dataclasses import dataclass, field
from typing import Final

from scorched_core.tuning import (
    TALLY_BOMB_BONUS,
    TALLY_BOSS_BONUS,
    TALLY_MEDAL_BONUS,
    TALLY_NO_MISS_BONUS,
)

LINES: Final = 4  # boss destroyed, medals collected, no miss, bombs left


@dataclass(slots=True)
class StageTally:
    """The four bonus lines of a cleared stage (SCOR-03, D-18).

    ``amounts`` holds the lines in their fixed order (boss, medals, no miss, bombs) and
    ``revealed`` how many of them the player has been shown (and paid) so far.
    """

    amounts: list[int] = field(default_factory=lambda: [0] * LINES)
    revealed: int = 0

    def compute(self, boss_destroyed: bool, medals: int, deaths: int, bombs: int) -> None:
        """Work out the four amounts from the stage's results and start revealing from the top.

        The boss line is nothing when the boss got away, the no-miss line pays only when no ship
        was lost this stage, and the bomb line is zero without bombs.
        """
        amounts = self.amounts
        amounts[0] = TALLY_BOSS_BONUS if boss_destroyed else 0
        amounts[1] = medals * TALLY_MEDAL_BONUS
        amounts[2] = TALLY_NO_MISS_BONUS if deaths == 0 else 0
        amounts[3] = bombs * TALLY_BOMB_BONUS
        self.revealed = 0

    def reveal_next(self) -> tuple[int, int]:
        """Reveal the next line and return its index and amount; raise once all are revealed."""
        index = self.revealed
        if index >= LINES:
            msg = "all tally lines are already revealed"
            raise ValueError(msg)
        self.revealed = index + 1
        return index, self.amounts[index]

    def reset(self) -> None:
        """Forget the tally: all zero, nothing revealed."""
        self.amounts[:] = [0] * LINES
        self.revealed = 0
