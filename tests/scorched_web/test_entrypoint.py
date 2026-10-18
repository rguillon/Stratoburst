import pytest

from scorched_core.game.fault_mode import FaultMode
from scorched_web.entrypoint import create_game
from scorched_web.web_game import WebGame


class FakeJsOptions:
    """Stands in for a JsProxy: converted with to_py()."""

    def to_py(self) -> dict[str, int]:
        return {"seed": 3, "stress": 750}


def test_dict_options() -> None:
    web = create_game({"seed": 5, "stress": 100})
    assert isinstance(web, WebGame)
    assert web.manifest()["channels"]["ebullets"]["cap"] == 600


def test_options_with_to_py() -> None:
    web = create_game(FakeJsOptions())
    assert web.manifest()["channels"]["ebullets"]["cap"] == 750


def test_none_options_use_defaults() -> None:
    assert create_game(None).manifest()["channels"]["ebullets"]["cap"] == 600
    assert create_game().manifest()["protocol"] == 2


def test_no_crash_option_means_no_fault() -> None:
    assert create_game({"seed": 1})._game.fault is FaultMode.NONE


@pytest.mark.parametrize(
    ("crash", "expected"),
    [
        ("py", FaultMode.PY),
        ("js", FaultMode.JS),
        ("none", FaultMode.NONE),
        (None, FaultMode.NONE),
        ("", FaultMode.NONE),
        ("bogus", FaultMode.NONE),
        ("PY", FaultMode.NONE),
        (5, FaultMode.NONE),
    ],
)
def test_the_crash_option_selects_a_fault_and_anything_else_is_ignored(
    crash: object, expected: FaultMode
) -> None:
    assert create_game({"crash": crash})._game.fault is expected
