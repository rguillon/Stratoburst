import math

import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.game.fault_mode import FaultMode
from scorched_core.protocol import H_FLOW
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_1 import STAGE_1
from scorched_core.tuning import AT_LEAD, BOMB_START_STOCK
from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_web.entrypoint import create_game
from scorched_web.web_game import WebGame


class FakeJsOptions:
    """Stands in for a JsProxy: converted with to_py()."""

    def to_py(self) -> dict[str, int]:
        return {"seed": 3, "stress": 750}


def test_dict_options() -> None:
    web = create_game({"seed": 5, "stress": 100})
    assert isinstance(web, WebGame)
    assert web.manifest()["channels"]["ebullets"]["cap"] == 1000


def test_options_with_to_py() -> None:
    web = create_game(FakeJsOptions())
    assert web.manifest()["channels"]["ebullets"]["cap"] == 1150


def test_none_options_use_defaults() -> None:
    assert create_game(None).manifest()["channels"]["ebullets"]["cap"] == 1000
    assert create_game().manifest()["protocol"] == 3


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


@pytest.mark.parametrize(
    ("weapon", "expected"),
    [
        ("vulcan", WeaponKind.VULCAN),
        ("laser", WeaponKind.LASER),
        ("homing", WeaponKind.HOMING),
        ("plasma", WeaponKind.VULCAN),
        ("LASER", WeaponKind.VULCAN),
        ("", WeaponKind.VULCAN),
        (None, WeaponKind.VULCAN),
        (1, WeaponKind.VULCAN),
        (["laser"], WeaponKind.VULCAN),
    ],
)
def test_the_weapon_option_is_allow_listed_and_anything_else_is_vulcan(
    weapon: object, expected: WeaponKind
) -> None:
    assert create_game({"weapon": weapon})._game.loadout.kind is expected


def test_no_weapon_or_level_option_means_vulcan_level_one() -> None:
    loadout = create_game({"seed": 1})._game.loadout
    assert (loadout.kind, loadout.level) == (WeaponKind.VULCAN, 1)


@pytest.mark.parametrize(
    ("level", "expected"),
    [
        (1, 1),
        (3, 3),
        ("4", 4),
        (5, 5),
        (99, 5),
        (0, 1),
        (-7, 1),
        (2.9, 2),
        ("2.9", 2),
        (math.nan, 1),
        (math.inf, 1),
        (-math.inf, 1),
        ("nan", 1),
        ("inf", 1),
        ("abc", 1),
        ("", 1),
        (None, 1),
        (True, 1),
        ([3], 1),
    ],
)
def test_the_level_option_is_truncated_and_clamped_and_junk_means_one(
    level: object, expected: int
) -> None:
    assert create_game({"level": level})._game.loadout.level == expected


def test_weapon_and_level_reach_the_game_together() -> None:
    game = create_game({"weapon": "homing", "level": "4"})._game
    assert (game.loadout.kind, game.loadout.level) == (WeaponKind.HOMING, 4)


@pytest.mark.parametrize(
    ("bombs", "expected"),
    [
        (7, 7),
        (0, 0),
        (5, 5),
        ("4", 4),
        (99, 7),
        (-2, 0),
        (2.9, 2),
        ("6.8", 6),
        (math.nan, 3),
        (math.inf, 3),
        (-math.inf, 3),
        ("nan", 3),
        ("x", 3),
        ("", 3),
        (None, 3),
        (True, 3),
        ([5], 3),
    ],
)
def test_the_bombs_option_is_truncated_and_clamped_and_junk_means_three(
    bombs: object, expected: int
) -> None:
    assert create_game({"bombs": bombs})._game.bomb.stock == expected


def test_no_bombs_option_means_the_default_stock() -> None:
    assert create_game({"seed": 1})._game.bomb.stock == BOMB_START_STOCK


@pytest.mark.parametrize(
    ("god", "expected"),
    [(True, True), (False, False), (1, False), ("yes", False), ("true", False), (None, False)],
)
def test_the_god_option_is_a_real_boolean_true_or_nothing(god: object, expected: bool) -> None:
    assert create_game({"god": god})._game.god is expected


def test_no_god_option_means_a_mortal_ship() -> None:
    assert create_game({"seed": 1})._game.god is False


def test_no_options_build_stage_one() -> None:
    for web in (create_game(), create_game({}), create_game(None)):
        manifest = web.manifest()
        assert web._game.stage is STAGE_1
        assert manifest["stage"]["number"] == 1
        web._game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
        assert web._game.buffers["header"][H_FLOW] == FlowState.PLAY


def test_the_gallery_option_builds_the_phase_two_gallery() -> None:
    game = create_game({"gallery": True})._game
    assert game.stage is None
    assert game.director is None


@pytest.mark.parametrize("value", [1, "yes", "true", None, False, 0, [True]])
def test_a_gallery_value_that_is_not_a_real_true_builds_the_stage(value: object) -> None:
    assert create_game({"gallery": value})._game.stage is STAGE_1


@pytest.mark.parametrize("marker", ["midboss", "boss"])
def test_the_at_option_starts_the_stage_just_before_the_marker(marker: str) -> None:
    game = create_game({"at": marker})._game
    assert game.stage is STAGE_1
    assert game.terrain.distance == STAGE_1.marker(marker) - AT_LEAD


@pytest.mark.parametrize("value", ["nowhere", "BOSS", "", 3, None, ["boss"], True])
def test_an_at_value_that_is_not_an_allow_listed_marker_starts_at_zero(value: object) -> None:
    game = create_game({"at": value})._game
    assert game.stage is STAGE_1
    assert game.terrain.distance == 0.0


def test_the_gallery_ignores_the_at_option() -> None:
    game = create_game({"gallery": True, "at": "boss"})._game
    assert game.stage is None
    assert game.terrain.distance == 0.0
