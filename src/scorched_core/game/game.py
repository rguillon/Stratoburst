"""Game facade: owns the simulation, the packed channel buffers and the manifest."""

import random
from array import array

from scorched_core.clock.fixed_step_runner import FixedStepRunner
from scorched_core.entities.player_ship import PlayerShip
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import (
    DRONE_CAP,
    DRONE_STRIDE,
    EBULLET_MAX_CAP,
    EBULLET_MIN_CAP,
    EBULLET_STRIDE,
    FLAG_FIRING,
    FLAG_PAUSED,
    H_ALPHA,
    H_DRONE_N,
    H_DRONES_DOWN,
    H_EBULLET_N,
    H_FLAGS,
    H_PBULLET_N,
    H_SCROLL_Y,
    H_SHIP_X,
    H_SHIP_Y,
    H_STEPS,
    H_STORM_HITS,
    H_TICK_COUNT,
    HEADER_LEN,
    PBULLET_CAP,
    PBULLET_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
    PROTOCOL_VERSION,
)
from scorched_core.stress.bullet_storm import BulletStorm
from scorched_core.tuning import HITBOX_RADIUS

_HEADER_SLOTS: dict[str, int] = {
    "STEPS": H_STEPS,
    "SCROLL_Y": H_SCROLL_Y,
    "ALPHA": H_ALPHA,
    "SHIP_X": H_SHIP_X,
    "SHIP_Y": H_SHIP_Y,
    "FLAGS": H_FLAGS,
    "PBULLET_N": H_PBULLET_N,
    "EBULLET_N": H_EBULLET_N,
    "DRONE_N": H_DRONE_N,
    "TICK_COUNT": H_TICK_COUNT,
    "STORM_HITS": H_STORM_HITS,
    "DRONES_DOWN": H_DRONES_DOWN,
}


class Game:
    """Pure simulation core; knows nothing about JS."""

    __slots__ = (
        "_move_x",
        "_move_y",
        "_runner",
        "buffers",
        "ebullet_cap",
        "ebullets",
        "rng",
        "ship",
        "storm",
        "storm_hits",
        "stress",
        "tick_count",
    )

    def __init__(self, *, seed: int = 1, stress: int = 0) -> None:
        self.rng = random.Random(seed)  # noqa: S311 - gameplay randomness, not security
        self.stress = min(max(stress, 0), EBULLET_MAX_CAP)
        self.ebullet_cap = min(EBULLET_MAX_CAP, max(EBULLET_MIN_CAP, self.stress))
        self.ship = PlayerShip()
        self.ebullets = BulletPool(self.ebullet_cap)
        self.storm = BulletStorm(self.ebullets, self.stress, self.rng) if self.stress > 0 else None
        self.storm_hits = 0
        self.tick_count = 0
        self._move_x = 0.0
        self._move_y = 0.0
        self._runner = FixedStepRunner(self._step)
        self.buffers: dict[str, array] = {
            "header": array("f", bytes(4 * HEADER_LEN)),
            "pbullets": array("f", bytes(4 * PBULLET_STRIDE * PBULLET_CAP)),
            "ebullets": array("f", bytes(4 * EBULLET_STRIDE * self.ebullet_cap)),
            "drones": array("f", bytes(4 * DRONE_STRIDE * DRONE_CAP)),
        }

    def manifest(self) -> dict[str, object]:
        """Describe the boundary layout so JS can allocate matching typed arrays."""
        return {
            "protocol": PROTOCOL_VERSION,
            "playfield": {"w": PLAYFIELD_W, "h": PLAYFIELD_H},
            "header": {"len": HEADER_LEN, "slots": dict(_HEADER_SLOTS)},
            "channels": {
                "pbullets": {"stride": PBULLET_STRIDE, "cap": PBULLET_CAP},
                "ebullets": {"stride": EBULLET_STRIDE, "cap": self.ebullet_cap},
                "drones": {"stride": DRONE_STRIDE, "cap": DRONE_CAP},
            },
            "flags": {"PAUSED": FLAG_PAUSED, "FIRING": FLAG_FIRING},
        }

    def tick(  # noqa: PLR0913, PLR0917 - frozen boundary signature (RESEARCH Pattern 2)
        self,
        dt_ms: float,
        buttons: int,  # noqa: ARG002 - consumed by plans 01-06 and 01-08
        move_x: float,
        move_y: float,
        drag_x: float,  # noqa: ARG002 - consumed by plans 01-06 and 01-08
        drag_y: float,  # noqa: ARG002 - consumed by plans 01-06 and 01-08
    ) -> int:
        """Advance the simulation by ``dt_ms`` and pack the header; return steps run."""
        self._move_x = move_x
        self._move_y = move_y
        steps = self._runner.advance(dt_ms)
        header = self.buffers["header"]
        header[H_STEPS] = steps
        header[H_ALPHA] = self._runner.alpha
        header[H_SHIP_X] = self.ship.x
        header[H_SHIP_Y] = self.ship.y
        header[H_TICK_COUNT] = self.tick_count
        header[H_EBULLET_N] = self.ebullets.n
        header[H_STORM_HITS] = self.storm_hits
        if steps > 0:
            self.ebullets.pack_into(self.buffers["ebullets"], 1.0)
        return steps

    def _step(self) -> None:
        self.ship.step(self._move_x, self._move_y)
        if self.storm is not None:
            self.storm_hits += self.storm.step(self.ship.x, self.ship.y, HITBOX_RADIUS)
        self.tick_count += 1
