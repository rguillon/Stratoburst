from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_EXPLOSION, EV_HIT, EVENT_CAP, EVENT_SOFT_CAP, EVENT_STRIDE


def test_a_new_ring_is_empty_and_preallocated() -> None:
    ring = EventRing()
    assert (ring.n, ring.dropped, ring.dropped_high) == (0, 0, 0)
    assert len(ring.buf) == EVENT_STRIDE * EVENT_CAP
    assert all(v == 0.0 for v in ring.buf)


def test_push_writes_six_floats_at_the_next_record_and_counts_it() -> None:
    ring = EventRing()
    assert ring.push(EV_EXPLOSION, 60.0, 90.0, 2.0, 1.0, 3.0) is True
    assert ring.n == 1
    assert list(ring.buf[:6]) == [EV_EXPLOSION, 60.0, 90.0, 2.0, 1.0, 3.0]
    assert ring.push(2, 1.5, 2.5) is True
    assert ring.n == 2
    assert list(ring.buf[6:12]) == [2.0, 1.5, 2.5, 0.0, 0.0, 0.0]


def test_clear_empties_the_ring_but_keeps_the_cumulative_dropped_count() -> None:
    ring = EventRing()
    for _ in range(EVENT_CAP + 3):
        ring.push(EV_EXPLOSION, 0.0, 0.0)
    assert ring.dropped == 3
    ring.clear()
    assert ring.n == 0
    assert ring.dropped == 3
    assert ring.push(EV_EXPLOSION, 1.0, 1.0) is True
    assert ring.buf[1] == 1.0


def test_the_ring_never_grows_past_its_capacity() -> None:
    ring = EventRing()
    results = [ring.push(EV_EXPLOSION, float(i), 0.0) for i in range(EVENT_CAP + 5)]
    assert results.count(True) == EVENT_CAP
    assert results[-5:] == [False] * 5
    assert ring.n == EVENT_CAP
    assert ring.dropped == 5
    assert len(ring.buf) == EVENT_STRIDE * EVENT_CAP


def test_soft_cap_refuses_low_priority_events_but_still_accepts_high_priority_ones() -> None:
    ring = EventRing()
    for _ in range(EVENT_SOFT_CAP):
        assert ring.push(EV_HIT, 0.0, 0.0, low=True) is True
    assert ring.push(EV_HIT, 1.0, 1.0, low=True) is False
    assert (ring.n, ring.dropped) == (EVENT_SOFT_CAP, 1)
    for _ in range(EVENT_CAP - EVENT_SOFT_CAP):
        assert ring.push(EV_EXPLOSION, 2.0, 2.0) is True
    assert ring.n == EVENT_CAP
    assert ring.push(EV_EXPLOSION, 3.0, 3.0) is False
    assert ring.dropped == 2


def test_soft_cap_drops_stay_cumulative_across_clears() -> None:
    ring = EventRing()
    for _ in range(EVENT_SOFT_CAP + 2):
        ring.push(EV_HIT, 0.0, 0.0, low=True)
    ring.clear()
    assert ring.dropped == 2
    assert ring.push(EV_HIT, 0.0, 0.0, low=True) is True
    for _ in range(EVENT_SOFT_CAP):
        ring.push(EV_HIT, 0.0, 0.0, low=True)
    assert ring.dropped == 3


def test_a_refused_high_priority_event_is_counted_apart_from_the_low_ones() -> None:
    ring = EventRing()
    for _ in range(EVENT_SOFT_CAP):
        ring.push(EV_HIT, 0.0, 0.0, low=True)
    assert ring.push(EV_HIT, 0.0, 0.0, low=True) is False
    assert (ring.dropped, ring.dropped_high) == (1, 0)  # a refused spark is never a lost kill
    for _ in range(EVENT_CAP - EVENT_SOFT_CAP):
        ring.push(EV_EXPLOSION, 0.0, 0.0)
    assert ring.push(EV_EXPLOSION, 0.0, 0.0) is False
    assert (ring.dropped, ring.dropped_high) == (2, 1)


def test_the_high_priority_drop_count_stays_cumulative_across_clears() -> None:
    ring = EventRing()
    for _ in range(EVENT_CAP + 2):
        ring.push(EV_EXPLOSION, 0.0, 0.0)
    ring.clear()
    assert ring.dropped_high == 2
