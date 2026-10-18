"""The ship's current weapon: a kind and a level, changed by crystal colour."""

from dataclasses import dataclass

from scorched_core.weapons.weapon_kind import WeaponKind


@dataclass(slots=True)
class WeaponLoadout:
    """Weapon ``kind`` and ``level`` (1..``MAX_LEVEL``)."""

    kind: WeaponKind = WeaponKind.VULCAN
    level: int = 1
