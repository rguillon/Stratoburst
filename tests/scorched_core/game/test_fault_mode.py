import pytest

from scorched_core.game.fault_mode import FAULT_TICK, FaultMode


def test_the_modes_are_none_py_and_js() -> None:
    assert [mode.value for mode in FaultMode] == ["none", "py", "js"]


def test_a_mode_is_found_by_its_url_value() -> None:
    assert FaultMode("py") is FaultMode.PY
    assert FaultMode("js") is FaultMode.JS
    assert FaultMode("none") is FaultMode.NONE


def test_a_mode_is_its_own_string() -> None:
    assert FaultMode.PY == "py"


@pytest.mark.parametrize("bogus", ["", "bogus", "PY", " py"])
def test_an_unknown_value_is_not_a_mode(bogus: str) -> None:
    with pytest.raises(ValueError, match="is not a valid FaultMode"):
        FaultMode(bogus)


def test_the_fault_fires_on_tick_one_hundred_twenty() -> None:
    assert FAULT_TICK == 120
