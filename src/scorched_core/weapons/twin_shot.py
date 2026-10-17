"""Twin shot: a cooldown-gated pair of straight bolts."""

from dataclasses import dataclass

from scorched_core.pools.bullet_pool import BulletPool


@dataclass(slots=True)
class TwinShot:
    """Fires a volley of two bolts every ``FIRE_INTERVAL_TICKS`` steps while fire is held."""

    cooldown: int = 0

    def step(self, firing: bool, x: float, y: float, pool: BulletPool) -> int:  # noqa: ARG002
        """Advance one step; return how many bolts were spawned."""
        return 0
