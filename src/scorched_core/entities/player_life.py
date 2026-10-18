"""The player's life cycle: hit, grace, death and a fly-in respawn, all counted in steps."""

from dataclasses import dataclass

from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.entities.player_ship import PlayerShip
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_PLAYER_DEATH, EV_PLAYER_HIT, EV_RESPAWN
from scorched_core.tuning import DEATHBOMB_TICKS, DYING_TICKS, INVULN_RESPAWN_TICKS


@dataclass(slots=True)
class PlayerLife:
    """ALIVE, then GRACE after a fatal hit, DYING after the grace window, RESPAWN, ALIVE again.

    Every window counts simulation steps, never frames or milliseconds. ``invuln`` is the
    number of ALIVE steps the ship still cannot be hit; ``deaths`` counts destroyed ships.
    """

    phase: PlayerPhase = PlayerPhase.ALIVE
    timer: int = 0
    invuln: int = 0
    deaths: int = 0

    @property
    def can_control(self) -> bool:
        """Return whether the player's move input reaches the ship (ALIVE and GRACE)."""
        return self.phase in (PlayerPhase.ALIVE, PlayerPhase.GRACE)

    @property
    def can_fire(self) -> bool:
        """Return whether the ship may shoot, which is exactly when it may be steered."""
        return self.phase in (PlayerPhase.ALIVE, PlayerPhase.GRACE)

    @property
    def vulnerable(self) -> bool:
        """Return whether a hit right now would start the grace window."""
        return self.phase == PlayerPhase.ALIVE and self.invuln == 0

    def grant_invuln(self, ticks: int) -> None:
        """Make the ship invulnerable for at least ``ticks`` more ALIVE steps.

        Sources do not add up: the larger remaining value wins, so a bomb and a respawn share
        one counter.
        """
        self.invuln = max(self.invuln, ticks)

    def hit(self, x: float, y: float, events: EventRing) -> bool:
        """Register a fatal hit at ``(x, y)``; return True when it opened the grace window.

        A hit is ignored (False, nothing changes) unless the ship is vulnerable.
        """
        if not self.vulnerable:
            return False
        self.phase = PlayerPhase.GRACE
        self.timer = DEATHBOMB_TICKS
        events.push(EV_PLAYER_HIT, x, y)
        return True

    def step(self, ship: PlayerShip, events: EventRing) -> bool:
        """Advance one 60 Hz step; return True only on the step the ship is destroyed."""
        destroyed = False
        match self.phase:
            case PlayerPhase.ALIVE:
                if self.invuln > 0:
                    self.invuln -= 1
            case PlayerPhase.GRACE:
                self.timer -= 1
                if self.timer <= 0:
                    self.phase = PlayerPhase.DYING
                    self.timer = DYING_TICKS
                    self.deaths += 1
                    events.push(EV_PLAYER_DEATH, ship.x, ship.y)
                    destroyed = True
            case PlayerPhase.DYING:
                self.timer -= 1
                if self.timer <= 0:
                    ship.respawn_start()
                    self.phase = PlayerPhase.RESPAWN
                    events.push(EV_RESPAWN, ship.x, ship.y)
            case PlayerPhase.RESPAWN:
                if ship.fly_in():
                    self.phase = PlayerPhase.ALIVE
                    self.grant_invuln(INVULN_RESPAWN_TICKS)
            case unknown:
                msg = f"unknown player phase {unknown}"
                raise ValueError(msg)
        return destroyed
