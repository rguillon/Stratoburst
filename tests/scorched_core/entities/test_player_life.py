from collections.abc import Callable

import pytest

from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.entities.player_ship import PlayerShip
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_PLAYER_DEATH, EV_PLAYER_HIT, EV_RESPAWN, EVENT_STRIDE
from scorched_core.tuning import (
    DEATHBOMB_TICKS,
    DYING_TICKS,
    INVULN_RESPAWN_TICKS,
    RESPAWN_SPEED,
    RESPAWN_START_Y,
    SHIP_START_X,
    SHIP_START_Y,
)


def _kinds(events: EventRing) -> list[int]:
    return [int(events.buf[i * EVENT_STRIDE]) for i in range(events.n)]


def _to_grace() -> tuple[PlayerLife, PlayerShip, EventRing]:
    life, ship, events = PlayerLife(), PlayerShip(), EventRing()
    assert life.hit(ship.x, ship.y, events)
    return life, ship, events


def _to_dying() -> tuple[PlayerLife, PlayerShip, EventRing]:
    life, ship, events = _to_grace()
    for _ in range(DEATHBOMB_TICKS):
        life.step(ship, events)
    return life, ship, events


def _to_respawn() -> tuple[PlayerLife, PlayerShip, EventRing]:
    life, ship, events = _to_dying()
    for _ in range(DYING_TICKS):
        life.step(ship, events)
    return life, ship, events


def test_a_new_life_is_alive_and_vulnerable() -> None:
    life = PlayerLife()
    assert life.phase == PlayerPhase.ALIVE
    assert life.vulnerable
    assert life.can_control
    assert life.can_fire
    assert life.deaths == 0


def test_hit_while_alive_opens_grace_and_pushes_player_hit() -> None:
    life, _, events = _to_grace()
    assert life.phase == PlayerPhase.GRACE
    assert life.timer == DEATHBOMB_TICKS
    assert _kinds(events) == [EV_PLAYER_HIT]
    assert not life.vulnerable


def test_grace_lasts_exactly_the_deathbomb_window() -> None:
    life, ship, events = _to_grace()
    for _ in range(DEATHBOMB_TICKS - 1):
        assert not life.step(ship, events)
        assert life.phase == PlayerPhase.GRACE
    assert life.step(ship, events)
    assert life.phase == PlayerPhase.DYING
    assert life.deaths == 1
    assert _kinds(events) == [EV_PLAYER_HIT, EV_PLAYER_DEATH]


def test_grace_keeps_control_and_fire() -> None:
    life, _, _ = _to_grace()
    assert life.can_control
    assert life.can_fire


def test_dying_has_no_control_and_no_fire_for_the_dying_window() -> None:
    life, ship, events = _to_dying()
    assert not life.can_control
    assert not life.can_fire
    for _ in range(DYING_TICKS - 1):
        assert not life.step(ship, events)
        assert life.phase == PlayerPhase.DYING
    assert not life.step(ship, events)
    assert life.phase == PlayerPhase.RESPAWN


def test_leaving_dying_places_the_ship_below_the_field_and_pushes_respawn() -> None:
    life, ship, events = _to_dying()
    ship.pending_x, ship.pending_y = 5.0, -3.0
    for _ in range(DYING_TICKS):
        life.step(ship, events)
    assert (ship.x, ship.y) == (SHIP_START_X, RESPAWN_START_Y)
    assert (ship.pending_x, ship.pending_y) == (0.0, 0.0)
    assert _kinds(events)[-1] == EV_RESPAWN
    assert not life.can_control
    assert not life.vulnerable


def test_respawn_rises_each_step_and_returns_to_alive_on_arrival() -> None:
    life, ship, events = _to_respawn()
    life.step(ship, events)
    assert ship.y == pytest.approx(RESPAWN_START_Y - RESPAWN_SPEED)
    assert life.phase == PlayerPhase.RESPAWN
    steps = 1
    while life.phase == PlayerPhase.RESPAWN:
        life.step(ship, events)
        steps += 1
        assert steps < 100
    assert ship.y == SHIP_START_Y
    assert life.phase == PlayerPhase.ALIVE
    assert life.invuln == INVULN_RESPAWN_TICKS
    assert life.can_control
    assert life.can_fire


def test_invulnerability_counts_down_one_per_alive_step_and_ends_exactly_at_zero() -> None:
    life, ship, events = PlayerLife(), PlayerShip(), EventRing()
    life.grant_invuln(INVULN_RESPAWN_TICKS)
    for remaining in range(INVULN_RESPAWN_TICKS - 1, -1, -1):
        life.step(ship, events)
        assert life.invuln == remaining
        assert life.vulnerable is (remaining == 0)
    life.step(ship, events)
    assert life.invuln == 0


def test_hits_during_the_invulnerable_return_are_ignored() -> None:
    life, ship, events = _to_respawn()
    while life.phase == PlayerPhase.RESPAWN:
        assert not life.hit(ship.x, ship.y, events)
        life.step(ship, events)
    count = events.n
    assert not life.hit(ship.x, ship.y, events)
    assert life.phase == PlayerPhase.ALIVE
    assert events.n == count


def test_grant_invuln_takes_the_larger_remaining_value() -> None:
    life = PlayerLife()
    life.grant_invuln(100)
    life.grant_invuln(40)
    assert life.invuln == 100


def test_invuln_max_holds_whichever_order_the_sources_arrive_in() -> None:
    life = PlayerLife()
    life.grant_invuln(40)
    life.grant_invuln(100)
    assert life.invuln == 100
    life.grant_invuln(100)
    assert life.invuln == 100


def test_a_hit_while_invulnerable_changes_nothing() -> None:
    life, events = PlayerLife(), EventRing()
    life.grant_invuln(5)
    assert not life.hit(10.0, 20.0, events)
    assert life.phase == PlayerPhase.ALIVE
    assert life.timer == 0
    assert life.deaths == 0
    assert events.n == 0


@pytest.mark.parametrize("builder", [_to_grace, _to_dying, _to_respawn])
def test_a_hit_outside_alive_changes_nothing(
    builder: Callable[[], tuple[PlayerLife, PlayerShip, EventRing]],
) -> None:
    life, ship, events = builder()
    phase, timer, deaths, count = life.phase, life.timer, life.deaths, events.n
    assert not life.hit(ship.x, ship.y, events)
    assert (life.phase, life.timer, life.deaths, events.n) == (phase, timer, deaths, count)


def test_full_cycle_runs_hit_grace_death_fly_in_and_a_second_life() -> None:
    life, ship, events = PlayerLife(), PlayerShip(), EventRing()
    assert life.hit(ship.x, ship.y, events)
    phases: list[PlayerPhase] = []
    destroyed_steps = 0
    for _ in range(DEATHBOMB_TICKS + DYING_TICKS + 40):
        destroyed_steps += life.step(ship, events)
        if not phases or phases[-1] != life.phase:
            phases.append(life.phase)
    assert phases == [
        PlayerPhase.GRACE,
        PlayerPhase.DYING,
        PlayerPhase.RESPAWN,
        PlayerPhase.ALIVE,
    ]
    assert destroyed_steps == 1
    assert _kinds(events) == [EV_PLAYER_HIT, EV_PLAYER_DEATH, EV_RESPAWN]
    assert life.deaths == 1
    assert (ship.x, ship.y) == (SHIP_START_X, SHIP_START_Y)
    assert life.invuln > 0
    for _ in range(INVULN_RESPAWN_TICKS):
        life.step(ship, events)
    assert life.vulnerable
    assert life.hit(ship.x, ship.y, events)


def test_an_unknown_phase_fails_loudly() -> None:
    life = PlayerLife()
    life.phase = 99  # type: ignore[assignment]
    with pytest.raises(ValueError, match="unknown player phase 99"):
        life.step(PlayerShip(), EventRing())
