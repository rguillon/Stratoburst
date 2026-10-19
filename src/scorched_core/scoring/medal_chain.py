"""The medal chain: what the next medal pays and how many were caught in a row."""

from dataclasses import dataclass

from scorched_core.tuning import MEDAL_LADDER

_TOP: int = len(MEDAL_LADDER) - 1


@dataclass(slots=True)
class MedalChain:
    """Raiden II medal chain (SCOR-02, D-15, D-16).

    ``index`` is the rung of ``MEDAL_LADDER`` the next medal pays, ``chain`` the catches since the
    last miss and ``collected`` the catches since the last ``stage_reset`` (the stage tally). A
    catch climbs one rung and stops at the top rung; a miss or a death restarts the ladder but
    keeps ``collected``.
    """

    index: int = 0
    chain: int = 0
    collected: int = 0

    @property
    def value(self) -> int:
        """Return what the next medal pays."""
        return MEDAL_LADDER[self.index]

    def collect(self) -> int:
        """Pay the current value, then climb one rung (capped) and count the catch."""
        value = MEDAL_LADDER[self.index]
        self.index = min(self.index + 1, _TOP)
        self.chain += 1
        self.collected += 1
        return value

    def miss(self) -> None:
        """Restart the ladder: a medal scrolled off or the ship died."""
        self.index = 0
        self.chain = 0

    def stage_reset(self) -> None:
        """Start counting a new stage's catches; the ladder itself carries over."""
        self.collected = 0
