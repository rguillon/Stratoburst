"""Where a boss fight is: the entrance, the fight, the death sequence, the retreat, or over."""

from enum import IntEnum


class BossState(IntEnum):
    """Boss controller states. Values never change: tests count them and they may cross the wire.

    ENTER descends to the hold line with every row shielded. FIGHT is the fight proper. DYING is
    the hull's death sequence and RETREAT the timeout's flight off screen; both end in GONE.
    """

    ENTER = 0
    FIGHT = 1
    DYING = 2
    RETREAT = 3
    GONE = 4
