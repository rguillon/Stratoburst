"""Twin shot: a cooldown-gated pair of straight bolts."""

from dataclasses import dataclass

from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.tuning import FIRE_INTERVAL_TICKS, MUZZLE_AHEAD, PBULLET_SPEED, TWIN_OFFSET


@dataclass(slots=True)
class TwinShot:
    """Fires a volley of two bolts every ``FIRE_INTERVAL_TICKS`` steps while fire is held."""

    cooldown: int = 0

    def step(self, firing: bool, x: float, y: float, pool: BulletPool) -> int:
        """Advance one step; return how many bolts were spawned.

        The cooldown runs down whether or not fire is held, so releasing and pressing again
        never beats the fire interval. A volley that does not fit in the pool is dropped.
        """
        spawned = 0
        if firing and self.cooldown == 0:
            muzzle_y = y - MUZZLE_AHEAD
            spawned += pool.spawn(x - TWIN_OFFSET, muzzle_y, 0.0, -PBULLET_SPEED)
            spawned += pool.spawn(x + TWIN_OFFSET, muzzle_y, 0.0, -PBULLET_SPEED)
            self.cooldown = FIRE_INTERVAL_TICKS
        if self.cooldown > 0:
            self.cooldown -= 1
        return spawned
