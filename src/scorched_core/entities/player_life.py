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
    ``arrival_invuln`` is what the current fly-in grants on arrival: the death respawn default,
    or the window a stage intro asked for (it falls back to the default once granted).
    """

    phase: PlayerPhase = PlayerPhase.ALIVE
    timer: int = 0
    invuln: int = 0
    deaths: int = 0
    final: bool = False
    arrival_invuln: int = INVULN_RESPAWN_TICKS

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

    def begin_fly_in(self, ship: PlayerShip, invuln: int) -> None:
        """Start a fly-in from below the playfield that grants ``invuln`` steps on arrival.

        The stage intro passes 0 (the ship does not blink at stage start); a death respawn keeps
        the default window. No event is pushed: the caller owns the announcement.
        """
        ship.respawn_start()
        self.phase = PlayerPhase.RESPAWN
        self.arrival_invuln = invuln

    def try_deathbomb(self) -> bool:
        """Cancel a fatal hit while the grace window is open; False in any other phase (D-11).

        The caller resolves the bomb press before ``step``, which is the call that lets the window
        expire, so a press on the last grace step still saves the ship.
        """
        if self.phase != PlayerPhase.GRACE:
            return False
        self.phase = PlayerPhase.ALIVE
        self.timer = 0
        return True

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
                    if self.final:
                        self.phase = PlayerPhase.OUT
                    else:
                        ship.respawn_start()
                        self.phase = PlayerPhase.RESPAWN
                        events.push(EV_RESPAWN, ship.x, ship.y)
            case PlayerPhase.RESPAWN:
                if ship.fly_in():
                    self.phase = PlayerPhase.ALIVE
                    self.grant_invuln(self.arrival_invuln)
                    self.arrival_invuln = INVULN_RESPAWN_TICKS
            case PlayerPhase.OUT:
                pass  # terminal: nothing moves until the run is restarted
            case unknown:
                msg = f"unknown player phase {unknown}"
                raise ValueError(msg)
        return destroyed

    def reset(self) -> None:
        """Return to a fresh ALIVE ship: no timer, no invulnerability, no deaths (a new run)."""
        self.phase = PlayerPhase.ALIVE
        self.timer = 0
        self.invuln = 0
        self.deaths = 0
        self.final = False
        self.arrival_invuln = INVULN_RESPAWN_TICKS
