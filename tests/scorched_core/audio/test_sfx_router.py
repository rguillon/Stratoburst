import pytest

from scorched_core.audio.sfx_id import SfxId
from scorched_core.audio.sfx_router import route_sfx
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import (
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    EV_BOMB_DETONATE,
    EV_BOMB_LAUNCH,
    EV_DEATHBOMB_SAVE,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_HIT,
    EV_PICKUP,
    EV_PLAYER_DEATH,
    EV_PLAYER_HIT,
    EV_RESPAWN,
    EV_SFX,
    EV_SHOT,
    EVENT_CAP,
    EVENT_SOFT_CAP,
    EVENT_STRIDE,
)
from scorched_core.weapons.pickup_outcome import PickupOutcome
from scorched_core.weapons.weapon_kind import WeaponKind


def _records(ring: EventRing) -> list[tuple[float, ...]]:
    return [tuple(ring.buf[i * EVENT_STRIDE : (i + 1) * EVENT_STRIDE]) for i in range(ring.n)]


@pytest.mark.parametrize(
    ("blast", "sound"),
    [
        (BLAST_SMALL, SfxId.EXPLODE_SMALL),
        (BLAST_MEDIUM, SfxId.EXPLODE_MEDIUM),
        (BLAST_LARGE, SfxId.EXPLODE_LARGE),
    ],
)
def test_an_explosion_is_followed_by_an_sfx_event_for_its_blast_class(
    blast: int, sound: SfxId
) -> None:
    ring = EventRing()
    ring.push(EV_EXPLOSION, 60.0, 90.0, blast)
    assert route_sfx(ring, 0, ring.n) == 1
    assert _records(ring) == [
        (EV_EXPLOSION, 60.0, 90.0, blast, 0.0, 0.0),
        (EV_SFX, 60.0, 90.0, sound, 0.0, 0.0),
    ]


def test_an_out_of_range_blast_class_is_clamped_to_the_nearest_explosion_sound() -> None:
    ring = EventRing()
    ring.push(EV_EXPLOSION, 0.0, 0.0, 9.0)
    ring.push(EV_EXPLOSION, 0.0, 0.0, -4.0)
    assert route_sfx(ring, 0, 2) == 2
    assert [rec[3] for rec in _records(ring)[2:]] == [SfxId.EXPLODE_LARGE, SfxId.EXPLODE_SMALL]


def test_an_unknown_event_kind_adds_nothing() -> None:
    ring = EventRing()
    ring.push(99, 1.0, 2.0)
    assert route_sfx(ring, 0, 1) == 0
    assert ring.n == 1


def test_only_the_given_slice_is_read_and_the_routers_own_events_are_never_reread() -> None:
    ring = EventRing()
    ring.push(EV_EXPLOSION, 1.0, 1.0, BLAST_SMALL)
    ring.push(EV_EXPLOSION, 2.0, 2.0, BLAST_SMALL)
    assert route_sfx(ring, 1, ring.n) == 1
    assert ring.n == 3
    assert route_sfx(ring, 2, ring.n) == 0  # the SFX event itself is silent
    assert ring.n == 3


def test_an_empty_slice_routes_nothing() -> None:
    ring = EventRing()
    assert route_sfx(ring, 0, 0) == 0
    assert ring.n == 0


def test_a_full_ring_refuses_the_sfx_event_and_counts_a_drop() -> None:
    ring = EventRing()
    for _ in range(EVENT_CAP):
        ring.push(EV_EXPLOSION, 0.0, 0.0, BLAST_SMALL)
    assert route_sfx(ring, EVENT_CAP - 1, EVENT_CAP) == 0
    assert ring.n == EVENT_CAP
    assert ring.dropped == 1


_ROUTES = [
    pytest.param(EV_SHOT, WeaponKind.VULCAN, 0, SfxId.VULCAN, id="shot-vulcan"),
    pytest.param(EV_SHOT, WeaponKind.HOMING, 0, SfxId.MISSILE, id="shot-homing"),
    pytest.param(EV_HIT, 0, 0, SfxId.HIT, id="hit"),
    pytest.param(EV_PICKUP, 0, PickupOutcome.RAISED, SfxId.WEAPON_UP, id="pickup-raised"),
    pytest.param(EV_PICKUP, 0, PickupOutcome.SWITCHED, SfxId.WEAPON_SWITCH, id="pickup-switched"),
    pytest.param(EV_PICKUP, 0, PickupOutcome.MAXED, SfxId.MAX, id="pickup-maxed"),
    pytest.param(EV_PICKUP, 4, PickupOutcome.STOCKED, SfxId.BOMB_PICKUP, id="pickup-stocked"),
    pytest.param(EV_ENEMY_FIRE, 0, 0, SfxId.ENEMY_FIRE, id="enemy-fire"),
    pytest.param(EV_PLAYER_HIT, 0, 0, SfxId.PLAYER_HIT, id="player-hit"),
    pytest.param(EV_PLAYER_DEATH, 0, 0, SfxId.DEATH, id="player-death"),
    pytest.param(EV_RESPAWN, 0, 0, SfxId.RESPAWN, id="respawn"),
    pytest.param(EV_BOMB_LAUNCH, 0, 0, SfxId.BOMB_LAUNCH, id="bomb-launch"),
    pytest.param(EV_BOMB_DETONATE, 0, 0, SfxId.BOMB_BLAST, id="bomb-detonate"),
    pytest.param(EV_DEATHBOMB_SAVE, 0, 0, SfxId.DEATHBOMB, id="deathbomb-save"),
]

_NOISY = {SfxId.VULCAN, SfxId.MISSILE, SfxId.HIT, SfxId.ENEMY_FIRE}


@pytest.mark.parametrize(("kind", "a", "b", "sound"), _ROUTES)
def test_each_gameplay_event_routes_to_its_own_sound_at_the_same_position(
    kind: int, a: float, b: float, sound: SfxId
) -> None:
    ring = EventRing()
    ring.push(kind, 12.5, 34.5, a, b)
    assert route_sfx(ring, 0, 1) == 1
    assert _records(ring)[1] == (EV_SFX, 12.5, 34.5, sound, 0.0, 0.0)


@pytest.mark.parametrize(("kind", "a", "b", "sound"), _ROUTES)
def test_only_the_noisy_sounds_are_low_priority(
    kind: int, a: float, b: float, sound: SfxId
) -> None:
    ring = EventRing()
    for _ in range(EVENT_SOFT_CAP):
        ring.push(EV_EXPLOSION, 0.0, 0.0, BLAST_SMALL)  # filler up to the soft cap
    ring.push(kind, 0.0, 0.0, a, b)
    pushed = route_sfx(ring, EVENT_SOFT_CAP, ring.n)
    assert pushed == (0 if sound in _NOISY else 1)
    assert ring.dropped == (1 if sound in _NOISY else 0)


def test_a_laser_shot_is_silent_because_the_hum_is_state_driven() -> None:
    ring = EventRing()
    ring.push(EV_SHOT, 0.0, 0.0, WeaponKind.LASER)
    assert route_sfx(ring, 0, 1) == 0
    assert ring.n == 1


def test_an_unknown_weapon_or_pickup_outcome_adds_nothing() -> None:
    ring = EventRing()
    ring.push(EV_SHOT, 0.0, 0.0, 7.0)
    ring.push(EV_PICKUP, 0.0, 0.0, 0.0, 9.0)
    assert route_sfx(ring, 0, 2) == 0
    assert ring.n == 2


def test_a_frame_with_no_audible_events_pushes_nothing() -> None:
    ring = EventRing()
    ring.push(99, 0.0, 0.0)
    ring.push(EV_SFX, 0.0, 0.0, SfxId.HIT)
    assert route_sfx(ring, 0, 2) == 0
    assert ring.n == 2
