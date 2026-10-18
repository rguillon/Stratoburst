import pytest

from scorched_core.audio.sfx_id import SfxId
from scorched_core.audio.sfx_router import route_sfx
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import (
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    EV_EXPLOSION,
    EV_SFX,
    EVENT_CAP,
    EVENT_STRIDE,
)


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
