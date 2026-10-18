"""The ship's current weapon: a kind and a level, changed by crystal colour."""

from dataclasses import dataclass

from scorched_core.tuning import DEATH_LEVEL_PENALTY, MAX_LEVEL
from scorched_core.weapons.pickup_outcome import PickupOutcome
from scorched_core.weapons.weapon_kind import WeaponKind


@dataclass(slots=True)
class WeaponLoadout:
    """Weapon ``kind`` and ``level`` (1..``MAX_LEVEL``); every crystal obeys the colour rules."""

    kind: WeaponKind = WeaponKind.VULCAN
    level: int = 1

    def collect(self, color: WeaponKind) -> PickupOutcome:
        """Apply a crystal of ``color`` (PLYR-05, D-07).

        The current colour raises the level by one up to ``MAX_LEVEL``; at the top it changes
        nothing and reports MAXED (D-06). Another colour switches the weapon and keeps the level.
        """
        if color is not self.kind:
            self.kind = color
            return PickupOutcome.SWITCHED
        if self.level >= MAX_LEVEL:
            return PickupOutcome.MAXED
        self.level += 1
        return PickupOutcome.RAISED

    def penalize(self) -> None:
        """Lose ``DEATH_LEVEL_PENALTY`` levels to a death, never below level 1 (D-04).

        The weapon kind is kept: only the power goes.
        """
        self.level = max(1, self.level - DEATH_LEVEL_PENALTY)
