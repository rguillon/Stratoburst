from scorched_core.input.button import Button
from scorched_core.input.input_frame import InputFrame


def test_a_fresh_frame_has_nothing_pressed() -> None:
    frame = InputFrame()
    assert (frame.buttons, frame.prev) == (0, 0)
    assert not frame.pressed(Button.PAUSE)


def test_a_new_bit_reads_as_pressed_once_then_as_held() -> None:
    frame = InputFrame()
    frame.update(0)
    frame.update(Button.PAUSE)
    assert frame.pressed(Button.PAUSE)
    frame.update(Button.PAUSE)
    assert not frame.pressed(Button.PAUSE)


def test_releasing_and_pressing_again_is_a_second_edge() -> None:
    frame = InputFrame()
    frame.update(Button.PAUSE)
    frame.update(0)
    frame.update(Button.PAUSE)
    assert frame.pressed(Button.PAUSE)


def test_a_release_is_not_a_press() -> None:
    frame = InputFrame()
    frame.update(Button.PAUSE)
    frame.update(0)
    assert not frame.pressed(Button.PAUSE)


def test_only_the_asked_button_counts() -> None:
    frame = InputFrame()
    frame.update(Button.FIRE | Button.BOMB)
    assert frame.pressed(Button.FIRE)
    assert frame.pressed(Button.BOMB)
    assert not frame.pressed(Button.PAUSE)


def test_settle_makes_the_current_bits_old_news() -> None:
    frame = InputFrame()
    frame.update(Button.PAUSE)
    frame.settle()
    assert not frame.pressed(Button.PAUSE)
    frame.update(Button.PAUSE)
    assert not frame.pressed(Button.PAUSE)
    frame.update(0)
    frame.update(Button.PAUSE)
    assert frame.pressed(Button.PAUSE)
