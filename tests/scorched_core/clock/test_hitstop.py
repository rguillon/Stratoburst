from scorched_core.clock.hitstop import Hitstop


def test_a_new_hitstop_is_idle_and_consumes_nothing() -> None:
    hitstop = Hitstop()
    assert hitstop.ticks == 0
    assert hitstop.consume() is False
    assert hitstop.ticks == 0


def test_trigger_then_a_smaller_trigger_keeps_the_larger_value() -> None:
    hitstop = Hitstop()
    hitstop.trigger(4)
    hitstop.trigger(2)
    assert hitstop.ticks == 4


def test_trigger_then_a_larger_trigger_keeps_the_larger_value() -> None:
    hitstop = Hitstop()
    hitstop.trigger(2)
    hitstop.trigger(4)
    assert hitstop.ticks == 4


def test_overlapping_triggers_never_add_up() -> None:
    hitstop = Hitstop()
    hitstop.trigger(4)
    hitstop.trigger(4)
    assert hitstop.ticks == 4


def test_consume_freezes_one_step_at_a_time_and_stops_at_zero() -> None:
    hitstop = Hitstop()
    hitstop.trigger(3)
    assert [hitstop.consume() for _ in range(5)] == [True, True, True, False, False]
    assert hitstop.ticks == 0


def test_a_trigger_after_the_freeze_ended_starts_a_new_one() -> None:
    hitstop = Hitstop()
    hitstop.trigger(1)
    assert hitstop.consume() is True
    assert hitstop.consume() is False
    hitstop.trigger(2)
    assert hitstop.ticks == 2
