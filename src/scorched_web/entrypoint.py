"""The only symbol the JS side imports."""

import math
from collections.abc import Callable, Mapping
from typing import Any, Final

from scorched_core.game.fault_mode import FaultMode
from scorched_core.game.game import Game
from scorched_core.stages.stage_1 import STAGE_1
from scorched_core.tuning import (
    BOMB_MAX_STOCK,
    BOMB_START_STOCK,
    LIVES_CAP,
    LIVES_START,
    MAX_LEVEL,
)
from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_web.bridge.high_score_store import HighScoreStore, browser_storage
from scorched_web.bridge.render_sink import RenderSink
from scorched_web.web_game import WebGame

_WEAPONS: Final = {kind.name.lower(): kind for kind in WeaponKind}
_AT_MARKERS: Final = frozenset({"midboss", "boss"})
# A run that used any of these never writes a best score: cheat and test runs must not appear as
# the player's best (Phase 2 IN-05). ``debug`` alone is not a gameplay flag.
_TEST_FLAGS: Final = (
    "gallery",
    "god",
    "weapon",
    "level",
    "bombs",
    "lives",
    "at",
    "stress",
    "crash",
)


def create_game(
    options: Any = None,  # noqa: ANN401 - dict or JsProxy
    get_storage: Callable[[], Any] = browser_storage,
) -> WebGame:
    """Build a WebGame from ``options`` (a dict, a JsProxy with ``to_py``, or None).

    Stage 1 is the default game (D-29); ``gallery`` (a real ``True``) brings back the Phase 2
    shooting gallery. ``get_storage`` yields the browser's ``localStorage`` for the best score.
    """
    if options is not None and hasattr(options, "to_py"):
        options = options.to_py()
    opts = options or {}
    gallery = _flag(opts.get("gallery"))
    store = HighScoreStore(get_storage, enabled=not _test_run(opts))
    game = Game(
        seed=int(opts.get("seed", 1)),
        stress=int(opts.get("stress", 0)),
        fault=_fault_mode(opts.get("crash")),
        weapon=_weapon(opts.get("weapon")),
        level=_level(opts.get("level")),
        god=_flag(opts.get("god")),
        bombs=_bombs(opts.get("bombs")),
        lives=_lives(opts.get("lives")),
        stage=None if gallery else STAGE_1,
        at=None if gallery else _at(opts.get("at")),
        high_score=store.load(),
    )
    return WebGame(game, RenderSink(game.buffers), store)


def _test_run(opts: Mapping[str, object]) -> bool:
    """Whether any test flag is set (not None, False, 0 or empty); the URL is untrusted input."""
    return any(opts.get(name) for name in _TEST_FLAGS)


def _fault_mode(value: object) -> FaultMode:
    """The requested fault; an unknown value means no fault (the URL is untrusted input)."""
    try:
        return FaultMode(value)
    except ValueError:
        return FaultMode.NONE


def _weapon(value: object) -> WeaponKind:
    """The requested starting weapon; only the three lowercase names count (untrusted input)."""
    if isinstance(value, str):
        return _WEAPONS.get(value, WeaponKind.VULCAN)
    return WeaponKind.VULCAN


def _level(value: object) -> int:
    """The requested starting level, truncated and clamped to 1..MAX_LEVEL; junk means 1."""
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return 1
    try:
        number = float(value)
    except ValueError:
        return 1
    if not math.isfinite(number):
        return 1
    return min(max(int(number), 1), MAX_LEVEL)


def _bombs(value: object) -> int:
    """The requested starting bomb stock, truncated and clamped to 0..7; junk means 3."""
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return BOMB_START_STOCK
    try:
        number = float(value)
    except ValueError:
        return BOMB_START_STOCK
    if not math.isfinite(number):
        return BOMB_START_STOCK
    return min(max(int(number), 0), BOMB_MAX_STOCK)


def _lives(value: object) -> int:
    """The requested starting lives, truncated and clamped to 1..LIVES_CAP; junk means 3.

    A run never starts with no ship: zero is reached only through deaths.
    """
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return LIVES_START
    try:
        number = float(value)
    except ValueError:
        return LIVES_START
    if not math.isfinite(number):
        return LIVES_START
    return min(max(int(number), 1), LIVES_CAP)


def _at(value: object) -> str | None:
    """The requested start marker; only ``midboss`` and ``boss`` count (untrusted input)."""
    if isinstance(value, str) and value in _AT_MARKERS:
        return value
    return None


def _flag(value: object) -> bool:
    """A boolean test flag; only a real ``True`` counts (the URL is untrusted input)."""
    return value is True
