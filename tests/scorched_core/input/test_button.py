from scorched_core.input.button import Button


def test_button_bit_values_are_the_boundary_contract() -> None:
    assert (Button.FIRE.value, Button.BOMB.value, Button.PAUSE.value) == (1, 2, 4)


def test_buttons_combine_as_flags() -> None:
    held = Button.FIRE | Button.PAUSE
    assert held == 5
    assert Button.FIRE in held
    assert Button.BOMB not in held


def test_a_raw_integer_from_js_tests_against_the_flags() -> None:
    assert 3 & Button.FIRE
    assert 3 & Button.BOMB
    assert not 3 & Button.PAUSE


def test_every_button_is_a_distinct_single_bit() -> None:
    values = [b.value for b in Button]
    assert len(values) == len(set(values)) == 3
    assert all(v & (v - 1) == 0 and v > 0 for v in values)
